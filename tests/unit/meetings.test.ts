import { expect, it } from 'vitest';
import {
  meetingInProgress,
  meetingTasks,
  suggestedMeetingProjects,
  upcomingMeetings,
} from '../../src/domain/meetings';
import type { Project, Task } from '../../src/domain/models';
import { calendarEvent } from '../calendar-fixtures';
import { projectData, taskData } from '../fixtures';

const now = new Date('2026-09-30T15:30:00Z');
const project: Project = {
  ...projectData,
  id: 'project',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  lastActivityAt: now.toISOString(),
  closedAt: null,
};
const task: Task = {
  ...taskData,
  id: 'task',
  projectId: project.id,
  source: 'MANUAL',
  sourceReference: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  completedAt: null,
};

it('incluye reuniones en curso y próximas, excluye finalizadas y todo el día, y ordena sin mutar', () => {
  const future = {
    ...calendarEvent,
    id: 'future',
    start: '2026-10-01T15:00:00Z',
    end: '2026-10-01T16:00:00Z',
  };
  const events = [
    future,
    { ...calendarEvent, id: 'ended', end: now.toISOString() },
    { ...future, id: 'all-day', allDay: true },
    calendarEvent,
  ];
  expect(upcomingMeetings(events, now).map((event) => event.id)).toEqual([
    calendarEvent.id,
    'future',
  ]);
  expect(events[0]).toBe(future);
  expect(meetingInProgress(calendarEvent, now)).toBe(true);
  expect(meetingInProgress(calendarEvent, new Date(calendarEvent.start))).toBe(true);
  expect(meetingInProgress(calendarEvent, new Date(calendarEvent.end))).toBe(false);
  expect(meetingInProgress(future, now)).toBe(false);
});

it('filtra por Teams, invitaciones pendientes y texto sin distinguir mayúsculas', () => {
  const pending = {
    ...calendarEvent,
    id: 'pending',
    response: 'notResponded' as const,
    teamsUrl: null,
    location: 'Sala Quito',
  };
  const events = [calendarEvent, pending];
  expect(upcomingMeetings(events, now, 'teams')).toEqual([calendarEvent]);
  expect(upcomingMeetings(events, now, 'unanswered', ' QUITO ')).toEqual([pending]);
  expect(upcomingMeetings(events, now, 'teams', 'quito')).toEqual([]);
  expect(upcomingMeetings(events, now, 'all', 'equipo QA')).toHaveLength(2);
});

it('sugiere proyectos activos por título y código completos, sin asociaciones por fragmentos', () => {
  const projects = [
    project,
    { ...project, id: 'accent', code: '', name: 'Certificación Visa' },
    { ...project, id: 'closed', status: 'COMPLETED' as const },
    { ...project, id: 'short', code: 'QA', name: 'AB' },
  ];
  const meeting = { ...calendarEvent, subject: 'Seguimiento QA-001 y certificacion visa' };
  expect(suggestedMeetingProjects(meeting, projects).map((item) => item.id)).toEqual([
    'project',
    'accent',
  ]);
  expect(
    suggestedMeetingProjects(
      { ...meeting, subject: 'Seguimiento QA-0019 y recertificacion visa' },
      projects,
    ),
  ).toEqual([]);
});

it('prepara solo tareas abiertas del proyecto, con prioridad y vencimiento, sin cambiar el historial', () => {
  const tasks: Task[] = [
    { ...task, id: 'low', priority: 'LOW' },
    { ...task, id: 'no-date', dueDate: null },
    { ...task, id: 'late', dueDate: '2026-10-01' },
    { ...task, id: 'early', dueDate: '2026-09-29' },
    { ...task, id: 'done', status: 'COMPLETED' },
    { ...task, id: 'cancelled', status: 'CANCELLED' },
    { ...task, id: 'other', projectId: 'other' },
  ];
  expect(meetingTasks(project.id, tasks).map((item) => item.id)).toEqual([
    'early',
    'late',
    'no-date',
    'low',
  ]);
  expect(tasks[0].id).toBe('low');
  expect(meetingTasks('unknown', tasks)).toEqual([]);
});
