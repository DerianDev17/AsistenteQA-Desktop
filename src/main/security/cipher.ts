import { safeStorage } from 'electron';
import type { TextCipher } from '../../application/email/ports';
import { AppError } from '../../domain/validation';

export const systemCipher: TextCipher = {
  assertAvailable() {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
    )
      throw new AppError(
        'SECURE_STORAGE',
        'El almacén seguro del sistema no está disponible. No se guardarán credenciales sin cifrar.',
      );
  },
  encrypt(value) {
    this.assertAvailable();
    return safeStorage.encryptString(value);
  },
  decrypt(value) {
    this.assertAvailable();
    return safeStorage.decryptString(Buffer.from(value));
  },
};
