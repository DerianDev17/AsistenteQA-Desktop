import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { openDatabase } from '../../src/infrastructure/database/client';
import { repositories } from '../../src/infrastructure/database/repositories';
import { Workspace } from '../../src/application/workspace';
import { handlers, respond } from '../../src/main/ipc/handlers';
import { channels } from '../../src/shared/api';
import { projectData, taskData } from '../fixtures';

let dir: string;
let db: PrismaClient;
let workspace: Workspace;
let clock = new Date('2026-09-29T15:00:00Z');
function createWorkspace() {
  const repos = repositories(db);
  return new Workspace(repos.projects, repos.tasks, repos.settings, randomUUID, () => clock);
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qa-assistant-integration-'));
  db = await openDatabase(join(dir, 'test.db'));
  clock = new Date('2026-09-29T15:00:00Z');
  workspace = createWorkspace();
});
afterEach(async () => {
  await db?.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('SQLite, aplicación y contratos IPC', () => {
  it('crea, modifica, vincula, completa y conserva datos al reabrir', async () => {
    const project = await workspace.createProject(projectData);
    const task = await workspace.createTask({ ...taskData, projectId: project.id });
    expect((await workspace.snapshot()).overview.today).toHaveLength(1);
    clock = new Date('2026-09-29T16:00:00Z');
    await workspace.updateTask({
      id: task.id,
      data: { ...taskData, projectId: project.id, title: 'Revisar evidencia' },
    });
    expect((await workspace.snapshot()).projects[0].lastActivityAt).toBe(clock.toISOString());
    const completed = await workspace.completeTask(task.id);
    clock = new Date('2026-09-29T17:00:00Z');
    expect((await workspace.completeTask(task.id)).completedAt).toBe(completed.completedAt);
    expect((await workspace.snapshot()).overview.today).toHaveLength(0);
    await workspace.saveSettings({ minimizeToTray: false, notifications: true, followUpDays: 5 });
    await db.$disconnect();
    db = await openDatabase(join(dir, 'test.db'));
    workspace = createWorkspace();
    const persisted = await workspace.snapshot();
    expect(persisted.projects[0].id).toBe(project.id);
    expect(persisted.tasks[0]).toMatchObject({
      id: task.id,
      title: 'Revisar evidencia',
      status: 'COMPLETED',
      projectId: project.id,
      source: 'MANUAL',
    });
    expect(persisted.settings).toEqual({
      minimizeToTray: false,
      notifications: true,
      followUpDays: 5,
    });
    expect(await db.$queryRawUnsafe('SELECT name FROM _qa_migrations')).toEqual([
      { name: '202609290001_initial' },
      { name: '202609290002_mail' },
    ]);
  });
  it('protege referencias y permite eliminar después de desvincular', async () => {
    const project = await workspace.createProject(projectData);
    const task = await workspace.createTask({ ...taskData, projectId: project.id });
    await expect(workspace.deleteProject(project.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await workspace.updateTask({ id: task.id, data: { ...taskData, projectId: null } });
    await workspace.deleteProject(project.id);
    await workspace.deleteTask(task.id);
    expect((await workspace.snapshot()).tasks).toHaveLength(0);
    expect((await workspace.snapshot()).projects).toHaveLength(0);
  });
  it('registra cierre y permite reactivar proyectos y tareas', async () => {
    const project = await workspace.createProject(projectData);
    expect(
      await workspace.updateProject({
        id: project.id,
        data: { ...projectData, status: 'COMPLETED' },
      }),
    ).toMatchObject({ progress: 100, closedAt: clock.toISOString() });
    expect(await workspace.updateProject({ id: project.id, data: projectData })).toMatchObject({
      closedAt: null,
    });
    const task = await workspace.createTask({ ...taskData, status: 'CANCELLED' });
    await expect(workspace.completeTask(task.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await workspace.updateTask({ id: task.id, data: taskData });
    await workspace.completeTask(task.id);
    expect(await workspace.updateTask({ id: task.id, data: taskData })).toMatchObject({
      status: 'PENDING',
      completedAt: null,
    });
  });
  it('valida payloads del IPC y rechaza referencias inexistentes', async () => {
    const routes = handlers(workspace);
    const log = vi.fn();
    const request = (channel: string, data?: unknown) =>
      respond(channel, () => routes[channel](data), log);
    expect(await request(channels.projectCreate, projectData)).toMatchObject({
      ok: true,
      value: { name: projectData.name },
    });
    expect(await request(channels.taskCreate, { ...taskData, title: ' ' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(
      await request(channels.taskCreate, { ...taskData, projectId: randomUUID() }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await request(channels.snapshot, { sql: 'arbitrary' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(await request(channels.taskComplete, randomUUID())).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect((await workspace.snapshot()).tasks).toHaveLength(0);
  });
  it('detecta migraciones alteradas sin descartar la base', async () => {
    await workspace.createProject(projectData);
    await db.$executeRawUnsafe("UPDATE _qa_migrations SET checksum = 'changed'");
    await db.$disconnect();
    await expect(openDatabase(join(dir, 'test.db'))).rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
    await db.$connect();
    expect(await db.project.count()).toBe(1);
  });
});
