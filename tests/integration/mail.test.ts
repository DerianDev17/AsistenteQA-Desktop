import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { openDatabase } from '../../src/infrastructure/database/client';
import { mailRepository } from '../../src/infrastructure/database/mail-repository';
import { EncryptedMailVault } from '../../src/infrastructure/security/mail-vault';
import { authorizationListener } from '../../src/infrastructure/email/loopback';
import { mailState, mailContent, testCipher } from '../mail-fixtures';

let dir: string;
let db: PrismaClient;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qa-mail-test-'));
  db = await openDatabase(join(dir, 'test.db'));
});
afterEach(async () => {
  await db?.$disconnect();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
it('cifra mensajes, aplica cambios idempotentes y conserva contenido al cambiar leído', async () => {
  const repository = mailRepository(db, testCipher());
  const change = {
    providerId: 'fake-id',
    deleted: false as const,
    data: { ...mailContent, preview: 'password=synthetic-value' },
  };
  await repository.apply('account', [change, change], '2026-08-30T00:00:00.000Z');
  expect(await db.mailMessage.count()).toBe(1);
  expect(Buffer.from((await db.mailMessage.findFirstOrThrow()).content).toString()).not.toContain(
    mailContent.subject,
  );
  const saved = (await repository.list('account', 0)).messages[0];
  expect(saved.preview).toBe('password=[REDACTED]');
  await repository.apply(
    'account',
    [{ providerId: 'fake-id', deleted: false, data: { isRead: true } }],
    '2026-08-30T00:00:00.000Z',
  );
  expect((await repository.list('account', 0)).messages[0]).toMatchObject({
    id: saved.id,
    subject: mailContent.subject,
    isRead: true,
  });
  expect((await repository.list('another-account', 0)).messages).toHaveLength(0);
  await repository.apply(
    'account',
    [{ providerId: 'fake-id', deleted: true }],
    '2026-08-30T00:00:00.000Z',
  );
  expect((await repository.list('account', 0)).total).toBe(0);
});
it('recorta a 30 días y pagina sin cargar todo el buzón', async () => {
  const repository = mailRepository(db, testCipher());
  await repository.apply(
    'account',
    Array.from({ length: 51 }, (_, index) => ({
      providerId: `fake-${index}`,
      deleted: false,
      data: mailContent,
    })),
    '2026-08-30T00:00:00.000Z',
  );
  expect((await repository.list('account', 0)).messages).toHaveLength(50);
  expect((await repository.list('account', 1)).messages).toHaveLength(1);
  await repository.apply('account', [], '2026-10-01T00:00:00.000Z');
  expect((await repository.list('account', 0)).total).toBe(0);
});
it('guarda credenciales solo cifradas y falla con otro usuario/cifrado', async () => {
  const path = join(dir, 'account.bin');
  const cipher = testCipher();
  const vault = new EncryptedMailVault(path, cipher);
  expect(await vault.load()).toEqual({ config: null, account: null });
  await vault.save(mailState);
  expect(await vault.load()).toEqual(mailState);
  const raw = await readFile(path);
  expect(raw.toString()).not.toContain('synthetic-cache');
  expect(raw.toString()).not.toContain('qa@example.test');
  await expect(new EncryptedMailVault(path, testCipher()).load()).rejects.toMatchObject({
    code: 'SECURE_STORAGE',
  });
  await vault.save({ ...mailState, account: null });
  expect((await vault.load()).account).toBeNull();
  expect((await readdir(dir)).some((file) => file.endsWith('.tmp'))).toBe(false);
  await writeFile(path, 'not-encrypted');
  await expect(vault.load()).rejects.toMatchObject({ code: 'SECURE_STORAGE' });
});
it('migra una base existente conservando datos y crea respaldo', async () => {
  await db.mailMessage.deleteMany();
  await db.$executeRawUnsafe('DROP TABLE MailMessage');
  await db.$executeRawUnsafe("DELETE FROM _qa_migrations WHERE name = '202609290002_mail'");
  await db.settings.create({ data: { id: 1, followUpDays: 7 } });
  await db.$disconnect();
  db = await openDatabase(join(dir, 'test.db'));
  expect((await db.settings.findUniqueOrThrow({ where: { id: 1 } })).followUpDays).toBe(7);
  expect(await db.mailMessage.count()).toBe(0);
  expect((await readdir(dir)).some((file) => file.includes('before-202609290002_mail'))).toBe(true);
});
it('OAuth local rechaza state ajeno y recibe únicamente el código esperado', async () => {
  const listener = await authorizationListener('test-state', new AbortController().signal);
  try {
    const bad = await fetch(`${listener.redirectUri}?state=other&code=wrong`);
    expect(bad.status).toBe(400);
    const good = await fetch(`${listener.redirectUri}?state=test-state&code=fake-code`);
    expect(good.status).toBe(200);
    expect(good.headers.get('cache-control')).toBe('no-store');
    expect(await listener.code).toBe('fake-code');
  } finally {
    listener.close();
  }
});
it('OAuth libera el listener al cancelar y al agotar el tiempo', async () => {
  const controller = new AbortController();
  const listener = await authorizationListener('test-state', controller.signal);
  const cancelled = expect(listener.code).rejects.toMatchObject({ code: 'CANCELLED' });
  controller.abort();
  await cancelled;
  const expired = await authorizationListener('test-state', new AbortController().signal, 20);
  await expect(expired.code).rejects.toMatchObject({ code: 'CANCELLED' });
});
