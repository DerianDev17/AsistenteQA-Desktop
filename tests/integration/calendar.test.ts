import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { openDatabase } from '../../src/infrastructure/database/client';
import { calendarRepository } from '../../src/infrastructure/database/calendar-repository';
import { mailRepository } from '../../src/infrastructure/database/mail-repository';
import { EncryptedMailVault } from '../../src/infrastructure/security/mail-vault';
import { MailService } from '../../src/application/email/service';
import { CalendarService } from '../../src/application/calendar/service';
import { calendarHandlers } from '../../src/main/ipc/calendar.ipc';
import { channels } from '../../src/shared/api';
import { AppError } from '../../src/domain/validation';
import { mailState, testCipher } from '../mail-fixtures';
import { calendarEvent } from '../calendar-fixtures';
let dir: string;
let db: PrismaClient;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qa-calendar-'));
  db = await openDatabase(join(dir, 'test.db'));
});
afterEach(async () => {
  await db?.$disconnect();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
async function setup(autoSync = false) {
  const cipher = testCipher();
  const vault = new EncryptedMailVault(join(dir, 'account.bin'), cipher);
  await vault.save({ ...mailState, config: { ...mailState.config!, autoSync } });
  const repository = calendarRepository(db, cipher);
  const auth = {
    connect: vi.fn(async () => ({
      id: 'fake-account',
      address: 'qa@example.test',
      cache: 'calendar-cache',
    })),
    token: vi.fn(async () => ({ accessToken: 'fake-token', cache: 'refreshed-cache' })),
  };
  const mail = new MailService(
    vault,
    auth,
    { page: vi.fn() },
    mailRepository(db, cipher),
    () => new Date('2026-09-30T14:00:00Z'),
    () => repository.clear(),
  );
  const provider = { events: vi.fn(async () => [calendarEvent]) };
  const service = new CalendarService(
    mail,
    vault,
    auth,
    provider,
    repository,
    () => new Date('2026-09-30T14:00:00Z'),
  );
  return { cipher, vault, repository, auth, mail, provider, service };
}
it('autoriza, cifra agenda y reemplaza cambios sin duplicar reuniones', async () => {
  const { service, provider, repository } = await setup();
  expect((await service.snapshot()).enabled).toBe(false);
  await service.connect();
  expect((await service.snapshot()).events).toEqual([calendarEvent]);
  const rows = await db.$queryRaw<{ content: Uint8Array }[]>`SELECT content FROM CalendarCache`;
  expect(Buffer.from(rows[0].content).toString()).not.toContain(calendarEvent.subject);
  provider.events.mockResolvedValue([
    { ...calendarEvent, start: '2026-09-30T17:00:00Z', end: '2026-09-30T18:00:00Z' },
  ]);
  await service.sync();
  expect((await service.snapshot()).events).toHaveLength(1);
  expect((await service.snapshot()).events[0].start).toContain('17:00');
  provider.events.mockResolvedValue([]);
  await service.sync();
  expect((await repository.get('fake-account')).events).toEqual([]);
  expect((await repository.get('other-account')).events).toEqual([]);
});
it('fallos conservan la agenda y permisos de calendario no invalidan el correo', async () => {
  const { service, provider, mail } = await setup();
  await service.connect();
  provider.events.mockRejectedValue(new AppError('NETWORK', 'Sin red.'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'NETWORK' });
  expect((await service.snapshot()).events).toHaveLength(1);
  provider.events.mockRejectedValue(new AppError('AUTH_REQUIRED', 'Falta Calendars.Read.'));
  await expect(service.sync()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  expect((await service.snapshot()).needsReconnect).toBe(true);
  expect((await mail.status()).needsReconnect).toBe(false);
});
it('serializa la caché OAuth, cancela la descarga y limpia agenda al desconectar', async () => {
  const { service, provider, mail, repository } = await setup();
  await service.connect();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  provider.events.mockImplementation(
    (_token?: string, _start?: string, _end?: string, signal?: AbortSignal) =>
      new Promise((_resolve, reject) => {
        started();
        signal!.addEventListener('abort', () => reject(new AppError('CANCELLED', 'Cancelado.')), {
          once: true,
        });
      }),
  );
  const running = service.sync();
  await ready;
  await expect(mail.disconnect()).rejects.toMatchObject({ code: 'CONFLICT' });
  const failed = expect(running).rejects.toMatchObject({ code: 'CANCELLED' });
  mail.cancel();
  await failed;
  expect((await repository.get('fake-account')).events).toHaveLength(1);
  await mail.disconnect();
  expect((await repository.get('fake-account')).events).toHaveLength(0);
  expect((await service.snapshot()).connected).toBe(false);
});
it('automatiza solo tras autorización y abre únicamente Teams desde un evento guardado', async () => {
  const { service, provider } = await setup(true);
  await service.syncIfEnabled();
  expect(provider.events).not.toHaveBeenCalled();
  await service.connect();
  await service.syncIfEnabled();
  expect(provider.events).toHaveBeenCalledTimes(2);
  const open = vi.fn(async () => {});
  const cancel = vi.fn();
  const api = calendarHandlers(service, open, cancel);
  await api[channels.calendarOpen](calendarEvent.id);
  expect(open).toHaveBeenCalledWith(calendarEvent.teamsUrl);
  await expect(api[channels.calendarOpen]('https://evil.test')).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await expect(api[channels.calendarSync]({ token: 'fake' })).rejects.toMatchObject({
    code: 'VALIDATION',
  });
  expect(open).toHaveBeenCalledTimes(1);
});
