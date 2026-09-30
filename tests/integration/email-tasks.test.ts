import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { openDatabase } from '../../src/infrastructure/database/client';
import { repositories } from '../../src/infrastructure/database/repositories';
import { mailRepository } from '../../src/infrastructure/database/mail-repository';
import { emailTaskSource } from '../../src/infrastructure/email/task-source';
import { EncryptedMailVault } from '../../src/infrastructure/security/mail-vault';
import { EmailTasks } from '../../src/application/email/tasks';
import { Workspace } from '../../src/application/workspace';
import { emailTaskHandlers } from '../../src/main/ipc/email-tasks.ipc';
import { channels } from '../../src/shared/api';
import { mailState, mailContent, testCipher } from '../mail-fixtures';
import { projectData, taskData } from '../fixtures';

let dir: string;
let db: PrismaClient;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qa-email-tasks-'));
  db = await openDatabase(join(dir, 'test.db'));
});
afterEach(async () => {
  await db?.$disconnect();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
async function setup() {
  const cipher = testCipher();
  const vault = new EncryptedMailVault(join(dir, 'account.bin'), cipher);
  await vault.save(mailState);
  const messages = mailRepository(db, cipher);
  await messages.apply(
    'fake-account',
    [{ providerId: 'fake-provider', deleted: false, data: mailContent }],
    '2026-08-30T00:00:00Z',
  );
  const message = (await messages.list('fake-account', 0)).messages[0];
  const repos = repositories(db);
  const service = new EmailTasks(
    emailTaskSource(vault, messages),
    repos.tasks,
    repos.projects,
    randomUUID,
    () => new Date('2026-09-29T15:00:00Z'),
  );
  const workspace = new Workspace(
    repos.projects,
    repos.tasks,
    repos.settings,
    randomUUID,
    () => new Date('2026-09-29T15:00:00Z'),
  );
  return { vault, messages, message, repos, service, workspace };
}
it('crea desde IPC, actualiza proyecto y Mi Día, y conserva origen al editar y reabrir', async () => {
  const { service, message, workspace } = await setup();
  const project = await workspace.createProject(projectData);
  const api = emailTaskHandlers(service);
  const draft = await api[channels.mailTaskDraft](message.id);
  expect(draft.input.title).toContain(mailContent.subject);
  const created = await api[channels.mailTaskCreate]({
    id: message.id,
    data: { ...taskData, projectId: project.id },
  });
  expect(created.created).toBe(true);
  expect(created.task.sourceReference).toMatch(/^[a-f0-9]{64}$/);
  expect((await workspace.snapshot()).overview.today[0].id).toBe(created.task.id);
  await workspace.updateTask({
    id: created.task.id,
    data: { ...taskData, projectId: project.id, title: 'Título revisado' },
  });
  await db.$disconnect();
  db = await openDatabase(join(dir, 'test.db'));
  const stored = await repositories(db).tasks.get(created.task.id);
  expect(stored).toMatchObject({
    source: 'EMAIL',
    title: 'Título revisado',
    projectId: project.id,
    sourceReference: created.task.sourceReference,
  });
});
it('dos creaciones simultáneas producen una sola tarea y nunca sobrescriben la existente', async () => {
  const { service, message } = await setup();
  const results = await Promise.all([
    service.create({ id: message.id, data: taskData }),
    service.create({ id: message.id, data: taskData }),
  ]);
  expect(results.map((result) => result.created).sort()).toEqual([false, true]);
  expect(new Set(results.map((result) => result.task.id)).size).toBe(1);
  expect(await db.task.count()).toBe(1);
  const again = await service.create({
    id: message.id,
    data: { ...taskData, title: 'No sobrescribir' },
  });
  expect(again.task.title).toBe(taskData.title);
});
it('sugiere certificación, propone un proyecto único y excluye tareas ya creadas', async () => {
  const { service, messages, message, workspace, vault } = await setup();
  const project = await workspace.createProject(projectData);
  await messages.apply(
    'fake-account',
    [
      {
        providerId: 'fake-provider',
        deleted: false,
        data: {
          ...mailContent,
          subject: 'Certificación QA-001',
        },
      },
    ],
    '2026-08-30T00:00:00Z',
  );
  const api = emailTaskHandlers(service);
  await expect(api[channels.mailSuggestions]({ accountId: 'other-account' })).rejects.toMatchObject(
    { code: 'VALIDATION' },
  );
  expect(await api[channels.mailSuggestions](undefined)).toEqual([
    expect.objectContaining({
      category: 'CERTIFICATION',
      projectId: project.id,
    }),
  ]);
  const draft = await service.draft(message.id);
  expect(draft.input).toMatchObject({ projectId: project.id, dueDate: null, description: '' });
  expect(await db.task.count()).toBe(0);
  await service.create({ id: message.id, data: draft.input });
  expect(await service.suggestions()).toEqual([]);
  await vault.save({ ...mailState, account: null });
  expect(await service.suggestions()).toEqual([]);
});
it('deduplica después de reconstruir el correo local y conserva tareas al desconectar', async () => {
  const { service, messages, message, vault } = await setup();
  const created = await service.create({ id: message.id, data: taskData });
  await messages.clear();
  await messages.apply(
    'fake-account',
    [{ providerId: 'fake-provider', deleted: false, data: mailContent }],
    '2026-08-30T00:00:00Z',
  );
  const restored = (await messages.list('fake-account', 0)).messages[0];
  expect(restored.id).not.toBe(message.id);
  expect((await service.draft(restored.id)).existing?.id).toBe(created.task.id);
  await vault.save({ ...mailState, account: null });
  await messages.clear();
  expect(await db.task.count()).toBe(1);
  await expect(service.create({ id: restored.id, data: taskData })).rejects.toMatchObject({
    code: 'AUTH_REQUIRED',
  });
});
it('rechaza correos de otra cuenta y mensajes eliminados', async () => {
  const { service, messages, message } = await setup();
  await messages.apply(
    'other-account',
    [{ providerId: 'fake-provider', deleted: false, data: mailContent }],
    '2026-08-30T00:00:00Z',
  );
  const other = (await messages.list('other-account', 0)).messages[0];
  await expect(service.draft(other.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await messages.clear();
  await expect(service.create({ id: message.id, data: taskData })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  expect(await db.task.count()).toBe(0);
});
it('migra sin perder tareas manuales y respalda la base anterior', async () => {
  const { workspace } = await setup();
  await workspace.createTask(taskData);
  await workspace.createTask(taskData);
  await db.$executeRawUnsafe('DROP INDEX Task_source_sourceReference_key');
  await db.$executeRawUnsafe("DELETE FROM _qa_migrations WHERE name = '202609290003_email_tasks'");
  await db.$disconnect();
  db = await openDatabase(join(dir, 'test.db'));
  expect(await db.task.count()).toBe(2);
  expect(
    (await readdir(dir)).some((file) => file.includes('before-202609290003_email_tasks')),
  ).toBe(true);
});
