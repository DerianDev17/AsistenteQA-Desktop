import type { PrismaClient } from '@prisma/client';
import type { CalendarRepository } from '../../application/calendar/ports';
import type { TextCipher } from '../../application/email/ports';
import { emptyCalendar, type CalendarCache } from '../../domain/calendar';
import { AppError } from '../../domain/validation';

export function calendarRepository(db: PrismaClient, cipher: TextCipher): CalendarRepository {
  return {
    async get(accountId) {
      const rows = await db.$queryRaw<
        { content: Uint8Array }[]
      >`SELECT content FROM CalendarCache WHERE accountId = ${accountId}`;
      if (!rows.length) return emptyCalendar();
      try {
        const value = JSON.parse(cipher.decrypt(rows[0].content)) as CalendarCache;
        if (
          typeof value.enabled !== 'boolean' ||
          !Array.isArray(value.events) ||
          value.events.length > 2000
        )
          throw new Error('invalid');
        return value;
      } catch {
        throw new AppError('SECURE_STORAGE', 'No se pudo leer la agenda cifrada en este equipo.');
      }
    },
    async save(accountId, cache) {
      const bytes = new Uint8Array(cipher.encrypt(JSON.stringify(cache)));
      await db.$executeRaw`INSERT INTO CalendarCache (accountId, content) VALUES (${accountId}, ${bytes}) ON CONFLICT(accountId) DO UPDATE SET content = excluded.content`;
    },
    async clear() {
      await db.$executeRaw`DELETE FROM CalendarCache`;
    },
  };
}
