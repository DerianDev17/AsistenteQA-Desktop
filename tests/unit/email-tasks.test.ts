import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { EmailTasks } from '../../src/application/email/tasks';
import type { Task } from '../../src/domain/models';
import { emailTaskHandlers } from '../../src/main/ipc/email-tasks.ipc';
import { respond } from '../../src/main/ipc/handlers';
import { channels } from '../../src/shared/api';
import { mailContent } from '../mail-fixtures';
import { taskData } from '../fixtures';

function setup() {
  const source = {
    recent: vi.fn(async () => []),
    resolve: vi.fn(async () => ({
      reference: 'opaque-reference',
      message: {
        ...mailContent,
        importance: 'high' as const,
        id: randomUUID(),
        providerId: 'fake-provider',
      },
    })),
  };
  const tasks = {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findEmail: vi.fn(async (): Promise<Task | null> => null),
    createEmail: vi.fn(async (task: Task) => ({ task, created: true })),
  };
  const projects = { list: vi.fn(async () => []), get: vi.fn(), save: vi.fn(), delete: vi.fn() };
  const service = new EmailTasks(
    source,
    tasks,
    projects,
    randomUUID,
    () => new Date('2026-09-29T15:00:00Z'),
  );
  return { source, tasks, projects, service };
}
it('propone un borrador sin copiar cuerpo ni inventar fecha y sin crear tareas', async () => {
  const { service, tasks } = setup();
  const draft = await service.draft(randomUUID());
  expect(draft.input).toMatchObject({
    title: 'Revisar: Evidencia de pruebas',
    description: '',
    priority: 'HIGH',
    dueDate: null,
    projectId: null,
  });
  expect(draft.existing).toBeNull();
  expect(tasks.createEmail).not.toHaveBeenCalled();
});
it('valida el contrato IPC y rechaza origen o contenido extra proporcionado por el renderer', async () => {
  const { service, source } = setup();
  const api = emailTaskHandlers(service);
  expect(
    await respond('draft', () => api[channels.mailTaskDraft]('wrong-id'), vi.fn()),
  ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  await expect(
    service.create({ id: randomUUID(), data: { ...taskData, source: 'EMAIL' } }),
  ).rejects.toMatchObject({ code: 'VALIDATION' });
  await expect(
    service.create({ id: randomUUID(), data: taskData, sourceReference: 'spoof' }),
  ).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(source.resolve).not.toHaveBeenCalled();
});
it('crea solo el texto revisado, redacta secretos y comprueba el proyecto', async () => {
  const { service, projects, tasks } = setup();
  const projectId = randomUUID();
  await expect(
    service.create({ id: randomUUID(), data: { ...taskData, projectId } }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(tasks.createEmail).not.toHaveBeenCalled();
  projects.get.mockResolvedValue({ id: projectId });
  const result = await service.create({
    id: randomUUID(),
    data: { ...taskData, projectId, description: 'password=synthetic-value' },
  });
  expect(result.task).toMatchObject({
    source: 'EMAIL',
    sourceReference: 'opaque-reference',
    projectId,
    description: 'password=[REDACTED]',
    title: taskData.title,
  });
});
it('abre y conserva la tarea existente ante intentos repetidos', async () => {
  const { service, tasks } = setup();
  const first = await service.create({ id: randomUUID(), data: taskData });
  tasks.findEmail.mockResolvedValue(first.task);
  expect((await service.draft(randomUUID())).existing).toEqual(first.task);
  const repeated = await service.create({
    id: randomUUID(),
    data: { ...taskData, title: 'No sobrescribir' },
  });
  expect(repeated).toEqual({ task: first.task, created: false });
  expect(tasks.createEmail).toHaveBeenCalledTimes(1);
});
