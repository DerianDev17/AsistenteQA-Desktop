import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ProjectForm, TaskForm } from '../../src/renderer/components/Forms';
import { projectData } from '../fixtures';

it('crea proyecto con próxima acción y valores iniciales', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ProjectForm onSave={onSave} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText('Nombre del proyecto'), 'Validación QA');
  await user.type(screen.getByLabelText('Próxima acción'), 'Ejecutar pruebas');
  await user.click(screen.getByRole('button', { name: 'Guardar proyecto' }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      name: 'Validación QA',
      nextAction: 'Ejecutar pruebas',
      progress: 0,
      status: 'NEW',
    }),
  );
});

it('vincula una tarea con el proyecto seleccionado', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const project = {
    ...projectData,
    id: 'aaaabbbb-cccc-4ddd-8eee-ffffffffffff',
    createdAt: '',
    updatedAt: '',
    lastActivityAt: '',
    closedAt: null,
  };
  render(<TaskForm projects={[project]} today="2026-09-29" onSave={onSave} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText('Título de la tarea'), 'Validar servicio');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Proyecto' }), project.id);
  await user.click(screen.getByRole('button', { name: 'Guardar tarea' }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ projectId: project.id, title: 'Validar servicio' }),
  );
});
it('muestra error al guardar y conserva el texto del usuario', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('No se pudo guardar en disco.'));
  const user = userEvent.setup();
  render(<TaskForm projects={[]} today="2026-09-29" onSave={onSave} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText('Título de la tarea'), 'Revisar evidencia');
  await user.click(screen.getByRole('button', { name: 'Guardar tarea' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar en disco.');
  expect(screen.getByLabelText('Título de la tarea')).toHaveValue('Revisar evidencia');
});
it('rechaza nombres de espacios y bloquea el formulario durante guardado', async () => {
  let finish!: () => void;
  const onSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<ProjectForm onSave={onSave} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText('Nombre del proyecto'), '   ');
  await user.click(screen.getByRole('button', { name: 'Guardar proyecto' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nombre');
  expect(onSave).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Nombre del proyecto'), 'QA');
  await user.click(screen.getByRole('button', { name: 'Guardar proyecto' }));
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  finish();
  expect(await screen.findByRole('button', { name: 'Guardar proyecto' })).toBeEnabled();
});
