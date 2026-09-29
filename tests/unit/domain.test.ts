import { describe, expect, it } from 'vitest';
import { projectInput, taskInput, settingsInput } from '../../src/domain/validation';
import {
  isOverdue,
  localDate,
  needsNextAction,
  overview,
  todayTasks,
} from '../../src/domain/overview';
import type { Project, Task } from '../../src/domain/models';
import { projectData, taskData } from '../fixtures';

const at = '2026-09-29T15:00:00.000Z';
const project: Project = {
  ...projectData,
  id: 'p',
  createdAt: at,
  updatedAt: at,
  lastActivityAt: at,
  closedAt: null,
};
const task: Task = {
  ...taskData,
  id: 't',
  source: 'MANUAL',
  sourceReference: null,
  createdAt: at,
  updatedAt: at,
  completedAt: null,
};
describe('validación del dominio', () => {
  it('recorta nombres y completa el avance al cerrar un proyecto', () => {
    expect(
      projectInput({ ...projectData, name: '  Certificación  ', status: 'COMPLETED' }),
    ).toMatchObject({ name: 'Certificación', progress: 100 });
  });
  it.each([
    { name: '  ' },
    { progress: 101 },
    { progress: -1 },
    { progress: 0.5 },
    { status: 'inventado' },
    { password: 'sensitive-placeholder' },
    { id: 'injected' },
  ])('rechaza proyecto inválido: %j', (invalid) =>
    expect(() => projectInput({ ...projectData, ...invalid })).toThrow(),
  );
  it.each([
    { title: '' },
    { dueDate: '2026-02-30' },
    { dueDate: '2026-13-01' },
    { dueDate: 'invalid' },
    { dueTime: '24:00' },
    { dueDate: null, dueTime: '10:00' },
    { projectId: '../../file' },
    { source: 'AI' },
  ])('rechaza tarea inválida: %j', (invalid) =>
    expect(() => taskInput({ ...taskData, ...invalid })).toThrow(),
  );
  it('acepta tareas sin fecha ni hora', () =>
    expect(taskInput({ ...taskData, dueDate: null, dueTime: null }).dueDate).toBeNull());
  it('valida configuración', () => {
    expect(() =>
      settingsInput({ notifications: true, minimizeToTray: true, followUpDays: 0 }),
    ).toThrow();
  });
});
describe('Mi Día y atención', () => {
  it('usa fecha local sin conversión UTC de fechas de vencimiento', () => {
    const local = new Date(2026, 8, 29, 23, 59);
    expect(localDate(local)).toBe('2026-09-29');
    expect(isOverdue(task, '2026-09-29')).toBe(false);
    expect(isOverdue(task, '2026-09-30')).toBe(true);
  });
  it('incluye vencidas y bloqueadas pero excluye completadas, canceladas y futuras', () => {
    const tasks: Task[] = [
      task,
      { ...task, id: 'late', dueDate: '2026-09-28' },
      { ...task, id: 'blocked', dueDate: null, status: 'BLOCKED' },
      { ...task, id: 'done', status: 'COMPLETED' },
      { ...task, id: 'cancelled', status: 'CANCELLED' },
      { ...task, id: 'future', dueDate: '2026-10-01' },
    ];
    expect(todayTasks(tasks, '2026-09-29').map((item) => item.id)).toEqual([
      'late',
      't',
      'blocked',
    ]);
  });
  it('marca proyectos activos sin próxima acción, excepto bloqueados o en espera', () => {
    expect(needsNextAction({ ...project, nextAction: '' })).toBe(true);
    for (const status of ['BLOCKED', 'WAITING_THIRD_PARTY', 'COMPLETED', 'CANCELLED'] as const)
      expect(needsNextAction({ ...project, nextAction: '', status })).toBe(false);
  });
  it('sugiere seguimientos solo a terceros y excluye proyectos cerrados', () => {
    const waiting: Task = {
      ...task,
      status: 'WAITING',
      waitingFor: 'PROVIDER',
      updatedAt: '2026-09-20T15:00:00Z',
    };
    const result = overview(
      [{ ...project, status: 'COMPLETED' }],
      [
        waiting,
        { ...waiting, id: 'self', waitingFor: 'USER' },
        { ...waiting, id: 'closed', projectId: 'p' },
      ],
      '2026-09-29',
      3,
      new Date(at),
    );
    expect(result.followUps.map((item) => item.id)).toEqual(['t']);
  });
});
