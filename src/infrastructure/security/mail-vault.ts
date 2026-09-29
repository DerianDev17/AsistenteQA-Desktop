import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { MailVault, MailState, TextCipher } from '../../application/email/ports';
import { mailConfig } from '../../domain/email';
import { AppError, record } from '../../domain/validation';

export class EncryptedMailVault implements MailVault {
  constructor(
    private path: string,
    private cipher: TextCipher,
  ) {}
  assertAvailable() {
    this.cipher.assertAvailable();
  }
  async load(): Promise<MailState> {
    let bytes: Buffer;
    try {
      bytes = await readFile(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { config: null, account: null };
      throw new AppError(
        'SECURE_STORAGE',
        'No se pudo leer la configuración protegida del correo.',
      );
    }
    try {
      const value = record(JSON.parse(this.cipher.decrypt(bytes)));
      const config = value.config === null ? null : mailConfig(value.config);
      if (value.account === null) return { config, account: null };
      const account = record(value.account);
      if (
        !config ||
        typeof account.id !== 'string' ||
        !account.id ||
        typeof account.address !== 'string' ||
        typeof account.cache !== 'string' ||
        !(account.cursor === null || typeof account.cursor === 'string') ||
        !(
          account.lastSyncedAt === null ||
          (typeof account.lastSyncedAt === 'string' &&
            Number.isFinite(Date.parse(account.lastSyncedAt)))
        ) ||
        typeof account.hasMore !== 'boolean' ||
        typeof account.needsReconnect !== 'boolean'
      )
        throw new Error('INVALID_STATE');
      return {
        config,
        account: {
          id: account.id,
          address: account.address,
          cache: account.cache,
          cursor: account.cursor,
          lastSyncedAt: account.lastSyncedAt,
          hasMore: account.hasMore,
          needsReconnect: account.needsReconnect,
        },
      };
    } catch {
      throw new AppError(
        'SECURE_STORAGE',
        'No se pudo descifrar la cuenta. Abre la aplicación con el mismo usuario de Windows que la conectó.',
      );
    }
  }
  async save(state: MailState) {
    this.assertAvailable();
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, this.cipher.encrypt(JSON.stringify(state)), { mode: 0o600 });
      await rename(temporary, this.path);
    } catch {
      throw new AppError(
        'SECURE_STORAGE',
        'No se pudo guardar la cuenta de correo de forma segura.',
      );
    } finally {
      await unlink(temporary).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw new AppError('SECURE_STORAGE', 'No se pudo limpiar el archivo cifrado temporal.');
      });
    }
  }
}
