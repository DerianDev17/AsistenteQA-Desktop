import { expect, it, vi } from 'vitest';
import { reminders } from '../../src/domain/reminders';
import { overview } from '../../src/domain/overview';
import { localDate } from '../../src/domain/overview';
import { deliverReminders } from '../../src/application/reminders';
import { calendarEvent } from '../calendar-fixtures';
import type { Task } from '../../src/domain/models';
import { taskData } from '../fixtures';

const now = new Date('2026-09-30T14:50:00Z');
const empty = overview([], [], localDate(now), 3, now);
it('avisa de reuniones dentro de diez minutos, excluye las empezadas y todo el día', () => {
  const events = [
    calendarEvent,
    { ...calendarEvent, id: 'later', start: '2026-09-30T15:00:01Z' },
    { ...calendarEvent, id: 'started', start: now.toISOString() },
    { ...calendarEvent, id: 'day', allDay: true },
    { ...calendarEvent, id: 'minute', start: '2026-09-30T14:50:30Z' },
  ];
  expect(reminders(empty, events, now).map((reminder) => reminder.key)).toEqual([
    `meeting:${calendarEvent.id}:${calendarEvent.start}`,
    'meeting:minute:2026-09-30T14:50:30Z',
  ]);
  expect(reminders(empty, events, now)[1].body).toContain('1 minuto.');
  expect(reminders(empty, events, now)[0].body).not.toContain(calendarEvent.subject);
});

it('no entrega un aviso si se desactivan recordatorios mientras reclama el recibo', async () => {
  let enabled = true;
  const receipts = {
    claim: vi.fn(async () => {
      enabled = false;
      return true;
    }),
    prune: vi.fn(),
  };
  const deliver = vi.fn();
  await deliverReminders(
    reminders(empty, [calendarEvent], now),
    receipts,
    deliver,
    now,
    () => enabled,
  );
  expect(deliver).not.toHaveBeenCalled();
});
it('genera un resumen diario de vencidas y seguimientos sin copiar títulos', () => {
  const task: Task = {
    ...taskData,
    id: 'test',
    status: 'WAITING',
    waitingFor: 'PROVIDER',
    source: 'MANUAL',
    sourceReference: null,
    createdAt: '2026-09-20T12:00:00Z',
    updatedAt: '2026-09-20T12:00:00Z',
    completedAt: null,
  };
  const result = reminders(overview([], [task], localDate(now), 3, now), [], now);
  expect(result).toHaveLength(2);
  expect(result[0].key).toContain('overdue:');
  expect(result[1].key).toContain('follow-ups:');
  expect(result.map((entry) => entry.body).join()).not.toContain(task.title);
});
it('reclama antes de notificar y no entrega avisos duplicados ni desactivados', async () => {
  const entries = reminders(empty, [calendarEvent], now);
  const receipts = { claim: vi.fn().mockResolvedValue(false), prune: vi.fn() };
  const deliver = vi.fn();
  await deliverReminders(entries, receipts, deliver, now, () => true);
  expect(deliver).not.toHaveBeenCalled();
  receipts.claim.mockResolvedValue(true);
  await deliverReminders(entries, receipts, deliver, now, () => false);
  expect(receipts.claim).toHaveBeenCalledTimes(1);
  await deliverReminders(entries, receipts, deliver, now, () => true);
  expect(deliver).toHaveBeenCalledWith(entries[0]);
  expect(receipts.prune).toHaveBeenCalledWith('2026-08-29T14:50:00.000Z');
});
