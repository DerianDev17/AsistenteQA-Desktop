import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { MailRepository, TextCipher } from '../../application/email/ports';
import type { MailContent } from '../../domain/email';
import { sanitizeMailText } from '../../domain/sanitize';

export function mailRepository(db: PrismaClient, cipher: TextCipher): MailRepository {
  const decode = (bytes: Uint8Array): MailContent =>
    JSON.parse(cipher.decrypt(bytes)) as MailContent;
  return {
    apply: (accountId, changes, since) =>
      db.$transaction(async (tx) => {
        await tx.mailMessage.deleteMany({ where: { accountId, receivedAt: { lt: since } } });
        for (const change of changes) {
          const where = { accountId_providerId: { accountId, providerId: change.providerId } };
          if (change.deleted) {
            await tx.mailMessage.deleteMany({
              where: { accountId, providerId: change.providerId },
            });
            continue;
          }
          const previous = await tx.mailMessage.findUnique({ where });
          if (!previous && !change.data.receivedAt) continue; // Read-state-only changes outside the initial window.
          const data: MailContent = {
            threadId: change.providerId,
            subject: '(Sin asunto)',
            sender: '',
            senderName: '',
            preview: '',
            receivedAt: '',
            isRead: false,
            hasAttachments: false,
            importance: 'normal',
            ...(previous ? decode(previous.content) : {}),
            ...change.data,
          };
          if (data.receivedAt < since) {
            await tx.mailMessage.deleteMany({
              where: { accountId, providerId: change.providerId },
            });
            continue;
          }
          for (const key of ['subject', 'sender', 'senderName', 'preview'] as const)
            data[key] = sanitizeMailText(data[key]);
          const content = new Uint8Array(cipher.encrypt(JSON.stringify(data)));
          await tx.mailMessage.upsert({
            where,
            create: {
              id: randomUUID(),
              accountId,
              providerId: change.providerId,
              receivedAt: data.receivedAt,
              content,
            },
            update: { receivedAt: data.receivedAt, content },
          });
        }
      }),
    list: async (accountId, page) => {
      const pageSize = 50;
      const [rows, total] = await db.$transaction([
        db.mailMessage.findMany({
          where: { accountId },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          skip: page * pageSize,
          take: pageSize,
        }),
        db.mailMessage.count({ where: { accountId } }),
      ]);
      return {
        messages: rows.map((row) => ({
          ...decode(row.content),
          id: row.id,
          providerId: row.providerId,
        })),
        total,
        page,
        pageSize,
      };
    },
    clear: async () => {
      await db.mailMessage.deleteMany();
    },
  };
}
