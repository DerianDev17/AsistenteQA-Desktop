import { createHash } from 'node:crypto';
import type { EmailTaskSource } from '../../application/email/tasks';
import type { MailRepository, MailVault } from '../../application/email/ports';
import { AppError } from '../../domain/validation';

export function emailTaskSource(vault: MailVault, messages: MailRepository): EmailTaskSource {
  return {
    async resolve(id) {
      const { account } = await vault.load();
      if (!account)
        throw new AppError(
          'AUTH_REQUIRED',
          'Conecta una cuenta para consultar el correo de origen.',
        );
      const message = await messages.get(account.id, id);
      if (!message)
        throw new AppError(
          'NOT_FOUND',
          'El correo ya no está en la copia local. Actualiza la bandeja.',
        );
      return {
        message,
        reference: createHash('sha256')
          .update(JSON.stringify([account.id, message.providerId]))
          .digest('hex'),
      };
    },
  };
}
