import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Dashboard, type Actions } from '../../src/renderer/pages/Dashboard';
import type { Snapshot } from '../../src/application/workspace';
import { defaultSettings, type Project, type Task } from '../../src/domain/models';
import { localDate, overview } from '../../src/domain/overview';
import type { QaApi } from '../../src/shared/api';
import { calendarSnapshot, calendarEvent } from '../calendar-fixtures';
import { mailConfigData, mailContent } from '../mail-fixtures';
import { projectData, taskData } from '../fixtures';

const now = new Date('2026-09-30T14:55:00Z');
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
  dueDate: localDate(now),
  projectId: project.id,
  source: 'MANUAL',
  sourceReference: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  completedAt: null,
};
const message = { ...mailContent, id: 'mail', providerId: 'mail' };
function setup(tasks = [task], projects = [project]) {
  const calendar = {
    snapshot: vi.fn().mockResolvedValue({ ok: true, value: calendarSnapshot }),
    openMeeting: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    sync: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
  const status = {
    config: mailConfigData,
    address: 'qa@example.test',
    connected: true,
    needsReconnect: false,
    lastSyncedAt: null,
    busy: null,
    hasMore: false,
    error: null,
  };
  const mail = {
    status: vi.fn().mockResolvedValue({ ok: true, value: status }),
    list: vi.fn().mockResolvedValue({
      ok: true,
      value: { messages: [message], total: 51, page: 0, pageSize: 50 },
    }),
    suggestions: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    configure: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    sync: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
  window.qa = { calendar, mail } as unknown as QaApi;
  const data: Snapshot = {
    tasks,
    projects,
    settings: defaultSettings,
    today: localDate(now),
    overview: overview(projects, tasks, localDate(now), 3, now),
  };
  const actions: Actions = {
    openProject: vi.fn(),
    taskFromEmail: vi.fn(),
    editProject: vi.fn(),
    deleteProject: vi.fn(),
    editTask: vi.fn(),
    deleteTask: vi.fn(),
    completeTask: vi.fn(),
    newProject: vi.fn(),
    newTask: vi.fn(),
    navigate: vi.fn(),
    prepareMeeting: vi.fn(),
    busy: false,
  };
  const onSettings = vi.fn().mockResolvedValue(undefined);
  return { data, actions, onSettings, calendar, mail, status };
}
afterEach(() => vi.useRealTimers());

it('cuenta tareas y agenda, permite completar y abre proyectos, correos y Teams', async () => {
  vi.setSystemTime(now);
  const props = setup();
  render(<Dashboard {...props} />);
  const metric = await screen.findByRole('button', { name: /Actividades de hoy.*2.*1 tareas/ });
  expect(metric).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Correos locales.*51/ })).toBeInTheDocument();
  expect(screen.getByRole('timer')).toHaveTextContent('En 5 minutos');
  await userEvent.click(screen.getByRole('button', { name: 'Completar: Validar el servicio' }));
  expect(props.actions.completeTask).toHaveBeenCalledWith(task);
  await userEvent.click(
    screen.getByRole('button', { name: /Proyecto de pruebas.*Validar resultados/ }),
  );
  expect(props.actions.openProject).toHaveBeenCalledWith(project);
  await userEvent.click(
    screen.getByRole('button', { name: `Abrir Teams: ${calendarEvent.subject}` }),
  );
  expect(props.calendar.openMeeting).toHaveBeenCalledWith(calendarEvent.id);
  await userEvent.click(
    screen
      .getAllByRole('button', { name: 'Preparar reunión' })
      .find((button) => button.classList.contains('secondary'))!,
  );
  expect(props.actions.prepareMeeting).toHaveBeenCalledWith(calendarEvent);
  await userEvent.click(screen.getByRole('button', { name: /Correos locales.*51/ }));
  expect(props.actions.navigate).toHaveBeenCalledWith('Correos');
  await userEvent.click(screen.getByRole('button', { name: /Evidencia de pruebas/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea desde correo' }));
  expect(props.actions.taskFromEmail).toHaveBeenCalledWith(message);
});
it('la tarjeta de atención reúne tareas sin duplicarlas y proyectos sin próxima acción', async () => {
  const props = setup(
    [{ ...task, dueDate: '2026-09-29', status: 'BLOCKED' }],
    [{ ...project, nextAction: '' }],
  );
  render(<Dashboard {...props} />);
  await userEvent.click(await screen.findByRole('button', { name: /Requieren atención.*2/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByRole('button', { name: /Validar el servicio/ })).toHaveLength(1);
  expect(within(dialog).getByText('Falta definir la próxima acción')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: /Validar el servicio/ }));
  expect(props.actions.editTask).toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('guarda automatizaciones y actualiza correo antes de agenda sin llamadas concurrentes', async () => {
  const props = setup();
  render(<Dashboard {...props} />);
  await screen.findByText('51 correos descargados');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorios automáticos' }));
  expect(props.onSettings).toHaveBeenCalledWith({ ...defaultSettings, notifications: true });
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Sincronización automática de correo y agenda' }),
  );
  expect(props.mail.configure).toHaveBeenCalledWith({ ...mailConfigData, autoSync: true });
  let finish!: (value: unknown) => void;
  props.mail.sync.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar todo' }));
  expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();
  expect(props.calendar.sync).not.toHaveBeenCalled();
  await act(async () => finish({ ok: true, value: undefined }));
  expect(props.calendar.sync).toHaveBeenCalledOnce();
  expect(await screen.findByText('Copia local actualizada.')).toBeInTheDocument();
});
it('muestra fallos, conserva acciones locales y permite reintentar la agenda', async () => {
  const props = setup([], []);
  props.calendar.snapshot.mockResolvedValue({
    ok: false,
    error: { code: 'NETWORK', message: 'Agenda no disponible.' },
  });
  props.mail.status.mockResolvedValue({
    ok: false,
    error: { code: 'NETWORK', message: 'Correo no disponible.' },
  });
  render(<Dashboard {...props} />);
  expect(await screen.findByText('Agenda no disponible.')).toBeInTheDocument();
  expect(await screen.findByText('Correo no disponible.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Correos locales.*—/ })).toBeInTheDocument();
  props.calendar.snapshot.mockResolvedValue({ ok: true, value: calendarSnapshot });
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar agenda' }));
  expect(await screen.findByRole('button', { name: /Reuniones hoy.*1/ })).toBeInTheDocument();
  props.onSettings.mockRejectedValue(new Error('No se pudo guardar.'));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorios automáticos' }));
  expect(await screen.findByText('No se pudo guardar.')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Recordatorios automáticos' })).not.toBeChecked();
});
it('actualiza la cuenta regresiva y los datos al recuperar foco', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const props = setup();
  const view = render(<Dashboard {...props} />);
  await act(async () => {});
  expect(screen.getByRole('timer')).toHaveTextContent('En 5 minutos');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60000);
  });
  expect(screen.getByRole('timer')).toHaveTextContent('En curso');
  props.calendar.snapshot.mockResolvedValue({
    ok: true,
    value: { ...calendarSnapshot, events: [] },
  });
  await act(async () => fireEvent.focus(window));
  expect(screen.getByText('Sin reuniones próximas')).toBeInTheDocument();
  expect(props.mail.sync).not.toHaveBeenCalled();
  view.unmount();
});
