import { createHash } from 'node:crypto';
import type { EmailTaskSource } from '../../application/email/tasks';
import type { MailRepository, MailVault } from '../../application/email/ports';
import { AppError } from '../../domain/validation';

export function emailTaskSource(vault: MailVault, messages: MailRepository): EmailTaskSource {
  const reference = (accountId: string, providerId: string) =>
    createHash('sha256')
      .update(JSON.stringify([accountId, providerId]))
      .digest('hex');
  return {
    async recent() {
      const { account } = await vault.load();
      if (!account) return [];
      const items: Awaited<ReturnType<EmailTaskSource['recent']>> = [];
      for (let page = 0; page < 3; page++) {
        const result = await messages.list(account.id, page);
        items.push(
          ...result.messages.map((message) => ({
            message,
            reference: reference(account.id, message.providerId),
          })),
        );
        if ((page + 1) * result.pageSize >= result.total) break;
      }
      return items;
    },
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
        reference: reference(account.id, message.providerId),
      };
    },
  };
}
