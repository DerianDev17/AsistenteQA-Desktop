import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import initial from '../../../prisma/migrations/202609290001_initial/migration.sql?raw';
import mail from '../../../prisma/migrations/202609290002_mail/migration.sql?raw';
import emailTasks from '../../../prisma/migrations/202609290003_email_tasks/migration.sql?raw';
import calendar from '../../../prisma/migrations/202609300001_calendar/migration.sql?raw';

// Bundled SQL keeps startup independent of a globally installed Prisma CLI.
const migrations = [
  { name: '202609290001_initial', sql: initial },
  { name: '202609290002_mail', sql: mail },
  { name: '202609290003_email_tasks', sql: emailTasks },
  { name: '202609300001_calendar', sql: calendar },
];
export async function openDatabase(path: string) {
  const client = new PrismaClient({
    datasources: { db: { url: `file:${path.replaceAll('\\', '/')}` } },
  });
  try {
    await client.$connect();
    await client.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await client.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await client.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS _qa_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, appliedAt TEXT NOT NULL)',
    );
    const applied = await client.$queryRawUnsafe<{ name: string; checksum: string }[]>(
      'SELECT name, checksum FROM _qa_migrations',
    );
    for (const migration of migrations) {
      const checksum = createHash('sha256')
        .update(migration.sql.replaceAll('\r\n', '\n'))
        .digest('hex');
      const existing = applied.find((entry) => entry.name === migration.name);
      if (existing && existing.checksum !== checksum)
        throw new Error('MIGRATION_CHECKSUM_MISMATCH');
      if (existing) continue;
      if (applied.length) {
        const backup = `${path}.before-${migration.name}-${randomUUID()}.bak`.replaceAll("'", "''");
        await client.$executeRawUnsafe(`VACUUM INTO '${backup}'`);
      }
      await client.$transaction(async (tx) => {
        for (const statement of migration.sql
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean))
          await tx.$executeRawUnsafe(statement);
        await tx.$executeRaw`INSERT INTO _qa_migrations (name, checksum, appliedAt) VALUES (${migration.name}, ${checksum}, ${new Date().toISOString()})`;
      });
    }
    return client;
  } catch (error) {
    await client.$disconnect();
    throw error;
  }
}
