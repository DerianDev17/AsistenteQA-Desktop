import { expect, it } from 'vitest';
import { dayPlan } from '../../src/domain/day-plan';
import type { Task } from '../../src/domain/models';
import { taskData } from '../fixtures';
import { calendarEvent } from '../calendar-fixtures';

const day = '2026-09-30';
const task: Task = {
  ...taskData,
  id: 'task',
  dueDate: day,
  source: 'MANUAL',
  sourceReference: null,
  createdAt: '2026-09-29T12:00:00Z',
  updatedAt: '2026-09-29T12:00:00Z',
  completedAt: null,
};
it('combina las tareas y reuniones del día por hora local con las vencidas primero', () => {
  const event = { ...calendarEvent, start: `${day}T10:00:00`, end: `${day}T11:00:00` };
  const plan = dayPlan(
    [
      task,
      { ...task, id: 'overdue', dueDate: '2026-09-29', dueTime: '15:00' },
      { ...task, id: 'no-time', dueTime: null },
      { ...task, id: 'completed', status: 'COMPLETED' },
      { ...task, id: 'tomorrow', dueDate: '2026-10-01' },
    ],
    [event, { ...event, id: 'tomorrow', start: '2026-10-01T10:00:00', end: '2026-10-01T11:00:00' }],
    day,
  );
  expect(plan.map((entry) => (entry.kind === 'task' ? entry.task.id : entry.meeting.id))).toEqual([
    'overdue',
    'task',
    'fake-meeting',
    'no-time',
  ]);
  expect(plan[0].overdue).toBe(true);
});
it('incluye reservas de todo el día y eventos que cruzan medianoche una sola vez', () => {
  const events = [
    { ...calendarEvent, start: '2026-09-29T23:00:00', end: '2026-09-30T01:00:00' },
    {
      ...calendarEvent,
      id: 'all-day',
      allDay: true,
      start: `${day}T00:00:00`,
      end: '2026-10-01T00:00:00',
    },
    { ...calendarEvent, id: 'ends', start: '2026-09-29T23:00:00', end: `${day}T00:00:00` },
  ];
  expect(dayPlan([], events, day).map((entry) => entry.time)).toEqual(['00:00', '00:00']);
});
