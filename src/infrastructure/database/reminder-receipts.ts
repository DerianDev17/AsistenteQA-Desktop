import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { ReminderReceipts } from '../../application/reminders';

export function reminderReceipts(db: PrismaClient): ReminderReceipts {
  return {
    claim: async (key, at) => {
      // Store only a digest, never calendar subjects, event IDs or email content.
      const digest = createHash('sha256').update(key).digest('hex');
      try {
        await db.reminderReceipt.create({ data: { key: digest, deliveredAt: at } });
        return true;
      } catch (reason) {
        if (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === 'P2002')
          return false;
        throw reason;
      }
    },
    prune: async (before) => {
      await db.reminderReceipt.deleteMany({ where: { deliveredAt: { lt: before } } });
    },
  };
}
