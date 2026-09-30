import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Meetings } from '../../src/renderer/pages/Meetings';
import type { Project, Task } from '../../src/domain/models';
import type { QaApi } from '../../src/shared/api';
import { calendarEvent, calendarSnapshot } from '../calendar-fixtures';
import { projectData, taskData } from '../fixtures';

const project: Project = {
  ...projectData,
  id: 'project',
  createdAt: calendarEvent.start,
  updatedAt: calendarEvent.start,
  lastActivityAt: calendarEvent.start,
  closedAt: null,
};
const task: Task = {
  ...taskData,
  id: 'task',
  projectId: project.id,
  source: 'MANUAL',
  sourceReference: null,
  createdAt: calendarEvent.start,
  updatedAt: calendarEvent.start,
  completedAt: null,
};
beforeEach(() =>
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-09-30T15:30:00Z')),
);
afterEach(() => vi.useRealTimers());
function setup(snapshot = calendarSnapshot) {
  const calendar = {
    snapshot: vi.fn().mockResolvedValue({ ok: true, value: snapshot }),
    sync: vi.fn().mockResolvedValue({ ok: true }),
    connect: vi.fn().mockResolvedValue({ ok: true }),
    cancel: vi.fn().mockResolvedValue({ ok: true }),
    openMeeting: vi.fn().mockResolvedValue({ ok: true }),
  };
  window.qa = { calendar } as unknown as QaApi;
  const props = {
    projects: [project],
    tasks: [task],
    onCalendar: vi.fn(),
    onProject: vi.fn(),
    onTask: vi.fn(),
  };
  return { calendar, props };
}

it('muestra carga y permite reintentar un error al consultar el calendario', async () => {
  const { calendar, props } = setup();
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  calendar.snapshot.mockImplementationOnce(() => pending);
  render(<Meetings {...props} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando reuniones');
  await act(async () => {
    finish({ ok: false, error: { message: 'No se pudo leer la agenda.' } });
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer la agenda.');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar reuniones' }));
  expect(await screen.findByText(calendarEvent.subject)).toBeInTheDocument();
});

it('ofrece abrir el calendario cuando falta autorizarlo', async () => {
  const { props } = setup({ ...calendarSnapshot, enabled: false, events: [] });
  render(<Meetings {...props} />);
  expect(
    await screen.findByText('Autoriza el calendario para consultar reuniones'),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Abrir configuración del calendario' }));
  expect(props.onCalendar).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Sincronizar reuniones' })).not.toBeInTheDocument();
});

it('filtra reuniones pendientes y Teams, busca y muestra reuniones en curso', async () => {
  const pending = {
    ...calendarEvent,
    id: 'pending',
    subject: 'Planificación de pruebas',
    response: 'notResponded' as const,
    teamsUrl: null,
  };
  const { props } = setup({
    ...calendarSnapshot,
    events: [
      calendarEvent,
      pending,
      { ...calendarEvent, id: 'day', allDay: true, subject: 'Todo el día' },
      { ...calendarEvent, id: 'past', end: '2026-09-30T15:00:00Z', subject: 'Ya terminó' },
    ],
  });
  render(<Meetings {...props} />);
  expect(await screen.findByText(calendarEvent.subject)).toBeInTheDocument();
  expect(screen.getAllByText('En curso')).toHaveLength(2);
  expect(screen.queryByText('Todo el día')).not.toBeInTheDocument();
  expect(screen.queryByText('Ya terminó')).not.toBeInTheDocument();
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Filtrar reuniones' })).getByRole('button', {
      name: 'Por responder',
    }),
  );
  expect(screen.queryByText(calendarEvent.subject)).not.toBeInTheDocument();
  expect(screen.getByText(pending.subject)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Teams' }));
  expect(screen.queryByText(pending.subject)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Buscar reuniones'), 'sin coincidencias');
  expect(screen.getByText('Sin reuniones próximas en esta vista')).toBeInTheDocument();
});

it('abre Teams por identificador y conserva la lista si falla la apertura', async () => {
  const { calendar, props } = setup();
  calendar.openMeeting.mockResolvedValue({
    ok: false,
    error: { message: 'No se pudo abrir Teams.' },
  });
  render(<Meetings {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: `Abrir Teams: ${calendarEvent.subject}` }),
  );
  expect(calendar.openMeeting).toHaveBeenCalledWith(calendarEvent.id);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir Teams.');
  expect(screen.getByText(calendarEvent.subject)).toBeInTheDocument();
});

it('permite preparar una reunión y editar solo pendientes del proyecto elegido', async () => {
  const { props } = setup({
    ...calendarSnapshot,
    events: [{ ...calendarEvent, subject: 'Seguimiento QA-001' }],
  });
  props.tasks = [
    task,
    { ...task, id: 'done', title: 'Completada', status: 'COMPLETED' },
    { ...task, id: 'other', title: 'Otro proyecto', projectId: 'other' },
  ];
  render(<Meetings {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Preparar reunión: Seguimiento QA-001' }),
  );
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Elige el proyecto que revisarás')).toBeInTheDocument();
  expect(dialog.getByRole('option', { name: /Coincide con el título/ })).toBeInTheDocument();
  await userEvent.selectOptions(dialog.getByLabelText('Proyecto para consultar'), project.id);
  expect(dialog.getByText(project.nextAction)).toBeInTheDocument();
  expect(dialog.queryByText('Completada')).not.toBeInTheDocument();
  expect(dialog.queryByText('Otro proyecto')).not.toBeInTheDocument();
  await userEvent.click(dialog.getByRole('button', { name: task.title }));
  expect(props.onTask).toHaveBeenCalledWith(task);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('abre la ficha del proyecto desde la preparación y permite renovar el acceso', async () => {
  const { calendar, props } = setup({ ...calendarSnapshot, needsReconnect: true });
  render(<Meetings {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Volver a autorizar reuniones' }),
  );
  expect(calendar.connect).toHaveBeenCalledOnce();
  expect(calendar.sync).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: `Preparar reunión: ${calendarEvent.subject}` }),
  );
  await userEvent.selectOptions(screen.getByLabelText('Proyecto para consultar'), project.id);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir ficha del proyecto' }));
  expect(props.onProject).toHaveBeenCalledWith(project);
});

it('cancela una operación pendiente y deshabilita sincronización y apertura', async () => {
  const { calendar, props } = setup({ ...calendarSnapshot, busy: true });
  render(<Meetings {...props} />);
  expect(await screen.findByRole('button', { name: 'Sincronizar reuniones' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: `Abrir Teams: ${calendarEvent.subject}` }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar operación' }));
  expect(calendar.cancel).toHaveBeenCalledOnce();
});
