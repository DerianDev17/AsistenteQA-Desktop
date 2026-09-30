import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/infrastructure/database/client';
import { reminderReceipts } from '../../src/infrastructure/database/reminder-receipts';
import { Workspace } from '../../src/application/workspace';
import { repositories } from '../../src/infrastructure/database/repositories';
import { projectData, taskData } from '../fixtures';
import { randomUUID } from 'node:crypto';

it('conserva recibos al reiniciar, rechaza duplicados concurrentes y guarda solo hashes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-reminders-'));
  const path = join(dir, 'test.db');
  let db = await openDatabase(path);
  try {
    const receipts = reminderReceipts(db);
    const key = 'meeting:private-event:2026-09-30T15:00:00Z';
    const at = '2026-09-30T14:50:00Z';
    expect((await Promise.all([receipts.claim(key, at), receipts.claim(key, at)])).sort()).toEqual([
      false,
      true,
    ]);
    const row = await db.reminderReceipt.findFirstOrThrow();
    expect(row.key).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain('private-event');
    await db.$disconnect();
    db = await openDatabase(path);
    const reopened = reminderReceipts(db);
    expect(await reopened.claim(key, at)).toBe(false);
    expect(await reopened.claim('meeting:private-event:2026-10-01T15:00:00Z', at)).toBe(true);
    await reopened.prune('2026-10-01T00:00:00Z');
    expect(await db.reminderReceipt.count()).toBe(0);
  } finally {
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

it('migra una base anterior sin alterar proyectos ni tareas y crea una copia previa', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-reminders-upgrade-'));
  const path = join(dir, 'test.db');
  let db = await openDatabase(path);
  try {
    const repos = repositories(db);
    const workspace = new Workspace(repos.projects, repos.tasks, repos.settings, randomUUID);
    const project = await workspace.createProject(projectData);
    const task = await workspace.createTask({ ...taskData, projectId: project.id });
    const beforeProject = await repos.projects.get(project.id);
    expect(beforeProject).not.toBeNull();
    // Simulate the schema and migration ledger shipped before reminder receipts.
    await db.$executeRawUnsafe('DROP TABLE "ReminderReceipt"');
    await db.$executeRaw`DELETE FROM _qa_migrations WHERE name = ${'202609300002_reminders'}`;
    await db.$disconnect();
    db = await openDatabase(path);
    expect(await repositories(db).projects.get(project.id)).toEqual(beforeProject);
    expect(await repositories(db).tasks.get(task.id)).toEqual(task);
    expect(await db.reminderReceipt.count()).toBe(0);
    expect(
      (await readdir(dir)).filter((name) => name.includes('before-202609300002_reminders')),
    ).toHaveLength(1);
  } finally {
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
