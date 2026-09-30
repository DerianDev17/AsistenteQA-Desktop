import { mailConfig, mailPageInput, type MailStatus } from '../../domain/email';
import { AppError } from '../../domain/validation';
import type { MailVault, MailAuth, MailProvider, MailRepository } from './ports';

export class MailService {
  private operation: MailStatus['busy'] = null;
  private controller: AbortController | null = null;
  private lastError: string | null = null;
  private stopped = false;
  private idleWaiters: (() => void)[] = [];
  constructor(
    private vault: MailVault,
    private auth: MailAuth,
    private provider: MailProvider,
    private repository: MailRepository,
    private now: () => Date = () => new Date(),
    private clearRelated: () => Promise<void> = async () => {},
  ) {}
  async status(): Promise<MailStatus> {
    const state = await this.vault.load();
    return {
      config: state.config,
      address: state.account?.address ?? null,
      connected: !!state.account,
      needsReconnect: state.account?.needsReconnect ?? false,
      lastSyncedAt: state.account?.lastSyncedAt ?? null,
      hasMore: state.account?.hasMore ?? false,
      busy: this.operation,
      error: this.lastError,
    };
  }
  async list(input: unknown) {
    const page = mailPageInput(input);
    const state = await this.vault.load();
    return state.account
      ? this.repository.list(state.account.id, page)
      : { messages: [], total: 0, page, pageSize: 50 };
  }
  configure(input: unknown) {
    const config = mailConfig(input);
    return this.exclusive('configure', async () => {
      this.vault.assertAvailable();
      const state = await this.vault.load();
      if (
        state.account &&
        (state.config?.clientId !== config.clientId || state.config?.tenantId !== config.tenantId)
      )
        throw new AppError(
          'CONFLICT',
          'Desconecta la cuenta antes de cambiar su registro de Microsoft Entra.',
        );
      await this.vault.save({ ...state, config });
    });
  }
  connect() {
    return this.connectUsing(this.auth);
  }
  connectUsing(auth: MailAuth) {
    return this.exclusive('connect', async (signal) => {
      this.vault.assertAvailable();
      const state = await this.vault.load();
      if (!state.config)
        throw new AppError(
          'VALIDATION',
          'Guarda primero el client ID y tenant ID de tu institución.',
        );
      const connected = await auth.connect(state.config, signal);
      this.check(signal);
      if (state.account && state.account.id !== connected.id)
        throw new AppError(
          'CONFLICT',
          'Elegiste otra cuenta. Desconecta la cuenta actual antes de cambiar de buzón.',
        );
      if (!state.account) {
        await this.repository.clear();
        await this.clearRelated();
      }
      await this.vault.save({
        ...state,
        account: {
          ...connected,
          cursor: state.account?.cursor ?? null,
          lastSyncedAt: state.account?.lastSyncedAt ?? null,
          hasMore: state.account?.hasMore ?? false,
          needsReconnect: false,
        },
      });
    });
  }
  sync() {
    return this.exclusive('sync', async (signal) => {
      const state = await this.vault.load();
      if (!state.config || !state.account || state.account.needsReconnect)
        throw new AppError('AUTH_REQUIRED', 'Conecta tu cuenta de Microsoft 365 para sincronizar.');
      const account = state.account;
      try {
        const credentials = await this.auth.token(state.config, account, signal);
        this.check(signal);
        account.cache = credentials.cache;
        await this.vault.save(state);
        const since = new Date(this.now().getTime() - 30 * 86400000).toISOString();
        // Bound every run; persist nextLink so large inboxes resume on the next run.
        for (let index = 0; index < 10; index++) {
          this.check(signal);
          const page = await this.provider.page(
            credentials.accessToken,
            account.cursor,
            since,
            signal,
          );
          this.check(signal);
          if (account.cursor === null) await this.repository.clear();
          await this.repository.apply(account.id, page.changes, since);
          // Advance only after the database transaction commits. A crash safely replays the page.
          account.cursor = page.cursor;
          account.hasMore = page.hasMore;
          if (!page.hasMore) account.lastSyncedAt = this.now().toISOString();
          await this.vault.save(state);
          if (!page.hasMore) break;
        }
      } catch (error) {
        if (error instanceof AppError && error.code === 'AUTH_REQUIRED') {
          account.needsReconnect = true;
          await this.vault.save(state);
        }
        if (error instanceof AppError && error.code === 'SYNC_RESET') {
          account.cursor = null;
          account.lastSyncedAt = null;
          account.hasMore = true;
          // Reset checkpoint before clearing, so a crash can never skip the rebuild.
          await this.vault.save(state);
          await this.repository.clear();
        }
        throw error;
      }
    });
  }
  disconnect() {
    return this.exclusive('disconnect', async () => {
      const state = await this.vault.load();
      await this.vault.save({ config: state.config, account: null });
      await this.repository.clear();
      await this.clearRelated();
    });
  }
  // Calendar and mail share one MSAL cache and one operation lock. Tokens never cross IPC.
  withAccount(
    auth: MailAuth,
    run: (accountId: string, token: string, signal: AbortSignal) => Promise<void>,
  ) {
    return this.exclusive('sync', async (signal) => {
      const state = await this.vault.load();
      if (!state.config || !state.account)
        throw new AppError('AUTH_REQUIRED', 'Conecta tu cuenta institucional desde Correos.');
      const credentials = await auth.token(state.config, state.account, signal);
      this.check(signal);
      state.account.cache = credentials.cache;
      await this.vault.save(state);
      await run(state.account.id, credentials.accessToken, signal);
    });
  }
  cancel() {
    this.controller?.abort();
  }
  stop(): Promise<void> {
    this.stopped = true;
    this.cancel();
    return this.operation
      ? new Promise((resolve) => this.idleWaiters.push(resolve))
      : Promise.resolve();
  }
  async syncIfEnabled() {
    if (this.operation || this.stopped) return;
    const state = await this.vault.load();
    if (state.config?.autoSync && state.account && !state.account.needsReconnect) await this.sync();
  }
  private check(signal: AbortSignal) {
    if (signal.aborted || this.stopped) throw new AppError('CANCELLED', 'Operación cancelada.');
  }
  private async exclusive(
    kind: NonNullable<MailStatus['busy']>,
    run: (signal: AbortSignal) => Promise<void>,
  ) {
    if (this.operation)
      throw new AppError('CONFLICT', 'Hay una operación de correo en curso. Espera o cancélala.');
    if (this.stopped) throw new AppError('CANCELLED', 'La aplicación se está cerrando.');
    this.operation = kind;
    this.lastError = null;
    const controller = new AbortController();
    this.controller = controller;
    try {
      await run(controller.signal);
    } catch (error) {
      const safeError = controller.signal.aborted
        ? new AppError('CANCELLED', 'Operación cancelada.')
        : error instanceof AppError
          ? error
          : new AppError(
              'INTERNAL',
              'No se pudo completar la operación de correo. Tus proyectos y tareas siguen disponibles.',
            );
      this.lastError = safeError.message;
      throw safeError;
    } finally {
      this.operation = null;
      this.controller = null;
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
  }
}
