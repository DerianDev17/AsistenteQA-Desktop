import { expect, it, vi } from 'vitest';
import { MailService } from '../../src/application/email/service';
import type {
  MailAuth,
  MailProvider,
  MailRepository,
  MailState,
  MailVault,
} from '../../src/application/email/ports';
import { AppError } from '../../src/domain/validation';
import { mailConfig, mailPageInput } from '../../src/domain/email';
import { sanitizeMailText } from '../../src/domain/sanitize';
import { mailHandlers } from '../../src/main/ipc/mail.ipc';
import { respond } from '../../src/main/ipc/handlers';
import { channels } from '../../src/shared/api';
import { mailConfigData, mailState, mailContent } from '../mail-fixtures';

function setup(initial = mailState) {
  let state = structuredClone(initial);
  const vault: MailVault = {
    assertAvailable: vi.fn(),
    load: vi.fn(async () => structuredClone(state)),
    save: vi.fn(async (next) => {
      state = structuredClone(next);
    }),
  };
  const auth: MailAuth = {
    connect: vi.fn(async () => ({
      id: 'fake-account',
      address: 'qa@example.test',
      cache: 'new-fake-cache',
    })),
    token: vi.fn(async () => ({ accessToken: 'fake-token', cache: 'refreshed-fake-cache' })),
  };
  const provider: MailProvider = {
    page: vi.fn(async () => ({
      changes: [{ providerId: 'fake-message', deleted: false, data: mailContent }],
      cursor: 'next',
      hasMore: false,
    })),
  };
  const repository: MailRepository = {
    get: vi.fn(async () => null),
    apply: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    list: vi.fn(async (_account, page) => ({ messages: [], page, total: 0, pageSize: 50 })),
  };
  const service = new MailService(
    vault,
    auth,
    provider,
    repository,
    () => new Date('2026-09-29T15:00:00Z'),
  );
  return { vault, auth, provider, repository, service, state: () => state };
}
it('valida IDs públicos y rechaza secretos y páginas inválidas', () => {
  expect(mailConfig(mailConfigData)).toEqual(mailConfigData);
  expect(() => mailConfig({ ...mailConfigData, clientSecret: 'fake' })).toThrow();
  expect(() => mailConfig({ ...mailConfigData, tenantId: 'https://wrong.test' })).toThrow();
  expect(() => mailPageInput({ page: -1 })).toThrow();
  expect(() => mailPageInput({ page: 1, token: 'fake' })).toThrow();
});
it('redacta patrones de credenciales y números de tarjeta', () => {
  const card = '4' + '1'.repeat(15);
  const sanitized = sanitizeMailText(
    `Bearer fake.example.token password="test value" PIN Block: ABCDEF ${card} ZPK=ABCDEF`,
  );
  expect(sanitized).not.toContain(card);
  expect(sanitized).not.toContain('ABCDEF');
  expect(sanitized).not.toContain('test value');
  expect(sanitized).not.toContain('fake.example.token');
});
it('persiste cursor solo después de guardar datos y jamás devuelve credenciales', async () => {
  const { service, vault, repository, state } = setup();
  await service.sync();
  expect(repository.apply).toHaveBeenCalled();
  const applyOrder = vi.mocked(repository.apply).mock.invocationCallOrder[0];
  const lastSaveOrder = vi.mocked(vault.save).mock.invocationCallOrder.at(-1)!;
  expect(applyOrder).toBeLessThan(lastSaveOrder);
  expect(state().account).toMatchObject({
    cursor: 'next',
    lastSyncedAt: '2026-09-29T15:00:00.000Z',
    cache: 'refreshed-fake-cache',
  });
  const status = await service.status();
  expect(JSON.stringify(status)).not.toMatch(/cache|fake-token|cursor/);
});
it('un fallo de persistencia no adelanta el cursor ni pierde la página', async () => {
  const { service, repository, state } = setup();
  vi.mocked(repository.apply).mockRejectedValue(new Error('fake internal content'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'INTERNAL' });
  expect(state().account?.cursor).toBeNull();
  expect((await service.status()).error).not.toContain('fake internal content');
});
it('limita páginas por ejecución y reanuda con el cursor guardado', async () => {
  const { service, provider, state } = setup();
  vi.mocked(provider.page).mockResolvedValue({ changes: [], cursor: 'more', hasMore: true });
  await service.sync();
  expect(provider.page).toHaveBeenCalledTimes(10);
  expect(state().account).toMatchObject({ cursor: 'more', hasMore: true, lastSyncedAt: null });
  vi.mocked(provider.page).mockResolvedValue({ changes: [], cursor: 'done', hasMore: false });
  await service.sync();
  expect(vi.mocked(provider.page).mock.calls[10][1]).toBe('more');
});
it('bloquea operaciones concurrentes, permite cancelar y espera al cerrar', async () => {
  const { service, auth } = setup();
  vi.mocked(auth.connect).mockImplementation(
    (_config, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  );
  const connecting = service.connect();
  await vi.waitFor(async () => expect((await service.status()).busy).toBe('connect'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'CONFLICT' });
  const rejection = expect(connecting).rejects.toMatchObject({ code: 'CANCELLED' });
  await service.stop();
  await rejection;
  expect((await service.status()).busy).toBeNull();
  await expect(service.connect()).rejects.toMatchObject({ code: 'CANCELLED' });
});
it('mantiene correo local sin red y pide reautenticación si el permiso expira', async () => {
  const { service, provider, repository, state } = setup();
  vi.mocked(provider.page).mockRejectedValue(new AppError('AUTH_REQUIRED', 'Renueva la sesión.'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  expect(state().account?.needsReconnect).toBe(true);
  await service.list({ page: 0 });
  expect(repository.list).toHaveBeenCalledWith('fake-account', 0);
  expect(repository.clear).not.toHaveBeenCalled();
});
it('reinicia delta expirado y elimina credenciales al desconectar', async () => {
  const { service, provider, state, repository } = setup();
  vi.mocked(provider.page).mockRejectedValue(new AppError('SYNC_RESET', 'Reconstruir.'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'SYNC_RESET' });
  expect(state().account).toMatchObject({ cursor: null, hasMore: true });
  expect(repository.clear).toHaveBeenCalledTimes(1);
  await service.disconnect();
  expect(state().account).toBeNull();
  expect(repository.clear).toHaveBeenCalledTimes(2);
});
it('respeta pausa automática y evita cambiar de cuenta implícitamente', async () => {
  const { service, provider, auth, state } = setup();
  await service.syncIfEnabled();
  expect(provider.page).not.toHaveBeenCalled();
  await expect(
    service.configure({ ...mailConfigData, clientId: mailConfigData.tenantId }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  vi.mocked(auth.connect).mockResolvedValue({
    id: 'another-account',
    address: 'other@example.test',
    cache: 'fake',
  });
  await expect(service.connect()).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(state().account?.id).toBe('fake-account');
});
it('IPC admite solo configuración y operaciones explícitas', async () => {
  const initial: MailState = { config: null, account: null };
  const { service } = setup(initial);
  const routes = mailHandlers(service);
  const log = vi.fn();
  expect(
    await respond('mail', () => routes[channels.mailConfigure](mailConfigData), log),
  ).toMatchObject({ ok: true });
  expect(
    await respond('mail', () => routes[channels.mailSync]({ token: 'fake' }), log),
  ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(
    await respond('mail', () => routes[channels.mailList]({ page: 'all' }), log),
  ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
});
