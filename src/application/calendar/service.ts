import { calendarWindow, emptyCalendar, type CalendarSnapshot } from '../../domain/calendar';
import { AppError } from '../../domain/validation';
import type { MailAuth, MailVault } from '../email/ports';
import type { MailService } from '../email/service';
import type { CalendarProvider, CalendarRepository } from './ports';

export class CalendarService {
  private busy = false;
  private error: string | null = null;
  private needsReconnect = false;
  constructor(
    private mail: MailService,
    private vault: MailVault,
    private auth: MailAuth,
    private provider: CalendarProvider,
    private repository: CalendarRepository,
    private now: () => Date = () => new Date(),
  ) {}
  async snapshot(): Promise<CalendarSnapshot> {
    const state = await this.vault.load();
    const cache = state.account ? await this.repository.get(state.account.id) : emptyCalendar();
    return {
      ...cache,
      connected: !!state.account,
      autoSync: state.config?.autoSync ?? false,
      busy: this.busy,
      needsReconnect: !!state.account && this.needsReconnect,
      error: state.account ? this.error : null,
    };
  }
  connect() {
    return this.exclusive(async () => {
      await this.mail.connectUsing(this.auth);
      await this.synchronize(true);
    });
  }
  sync() {
    return this.exclusive(() => this.synchronize(false));
  }
  async syncIfEnabled() {
    if (this.busy || (await this.mail.status()).busy) return;
    const state = await this.snapshot();
    if (state.connected && state.enabled && state.autoSync && !state.needsReconnect)
      await this.sync();
  }
  private synchronize(enable: boolean) {
    return this.mail.withAccount(this.auth, async (accountId, token, signal) => {
      const cache = await this.repository.get(accountId);
      if (!enable && !cache.enabled)
        throw new AppError('AUTH_REQUIRED', 'Autoriza el calendario antes de sincronizar.');
      if (enable) await this.repository.save(accountId, { ...cache, enabled: true });
      const range = calendarWindow(this.now());
      const events = await this.provider.events(token, range.start, range.end, signal);
      if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
      // Replace only a complete successful snapshot: cancelled/deleted/rescheduled events cannot accumulate.
      await this.repository.save(accountId, {
        enabled: true,
        ...range,
        events,
        lastSyncedAt: this.now().toISOString(),
      });
    });
  }
  private async exclusive(run: () => Promise<void>) {
    if (this.busy) throw new AppError('CONFLICT', 'El calendario ya tiene una operación en curso.');
    this.busy = true;
    this.error = null;
    try {
      await run();
      this.needsReconnect = false;
    } catch (reason) {
      const error =
        reason instanceof AppError
          ? reason
          : new AppError(
              'NETWORK',
              'No se pudo actualizar el calendario. La última agenda descargada sigue disponible.',
            );
      this.error = error.message;
      if (error.code === 'AUTH_REQUIRED') this.needsReconnect = true;
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
