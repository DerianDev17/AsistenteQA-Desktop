import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ProjectDetail } from '../../src/renderer/pages/ProjectDetail';
import type { Actions } from '../../src/renderer/pages/Dashboard';
import type { Project, Task } from '../../src/domain/models';
import { projectData, taskData } from '../fixtures';

const project: Project = {
  ...projectData,
  id: 'project',
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
  lastActivityAt: '2026-09-29T10:00:00Z',
  closedAt: null,
};
function actions(): Actions {
  return {
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
    busy: false,
  };
}
it('muestra solo tareas del proyecto, filtra origen y permite editar o completar', async () => {
  const task: Task = {
    ...taskData,
    id: 'email-task',
    title: 'Revisar correo',
    projectId: project.id,
    source: 'EMAIL',
    sourceReference: 'opaque',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    completedAt: null,
  };
  const callbacks = actions();
  render(
    <ProjectDetail
      project={project}
      tasks={[
        task,
        { ...task, id: 'manual', title: 'Tarea manual', source: 'MANUAL', status: 'COMPLETED' },
        { ...task, id: 'other', projectId: 'other', title: 'Otro proyecto' },
      ]}
      today="2026-09-29"
      actions={callbacks}
      onBack={vi.fn()}
      onNewTask={vi.fn()}
    />,
  );
  expect(screen.queryByText('Otro proyecto')).not.toBeInTheDocument();
  expect(
    screen.getByText('1 tareas activas · 0 vencidas · 1 completadas · 1 desde correo'),
  ).toBeInTheDocument();
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Filtrar tareas del proyecto' })).getByRole('button', {
      name: 'Desde correo',
    }),
  );
  expect(screen.getByRole('heading', { name: 'Tareas del proyecto · 1' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Editar Revisar correo' }));
  expect(callbacks.editTask).toHaveBeenCalledWith(task);
  await userEvent.click(screen.getByRole('button', { name: 'Completar Revisar correo' }));
  expect(callbacks.completeTask).toHaveBeenCalledWith(task);
});
it('ofrece crear la primera tarea y volver a proyectos', async () => {
  const onNewTask = vi.fn();
  const onBack = vi.fn();
  render(
    <ProjectDetail
      project={project}
      tasks={[]}
      today="2026-09-29"
      actions={actions()}
      onBack={onBack}
      onNewTask={onNewTask}
    />,
  );
  expect(screen.getByText('Todo despejado por aquí')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Añadir tarea al proyecto' }));
  expect(onNewTask).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Volver a proyectos' }));
  expect(onBack).toHaveBeenCalledOnce();
});
