import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/app/App';
import type { QaApi } from '../../src/shared/api';
import { defaultSettings } from '../../src/domain/models';
import { overview } from '../../src/domain/overview';
import { mailConfigData, mailContent } from '../mail-fixtures';
import { taskData } from '../fixtures';

function setup() {
  const api = {
    calendar: {
      snapshot: vi.fn(async () => ({
        ok: true,
        value: { connected: false, enabled: false, events: [] },
      })),
    },
    snapshot: vi.fn(async () => ({
      ok: true,
      value: {
        projects: [],
        tasks: [],
        settings: defaultSettings,
        today: '2026-09-29',
        overview: overview([], [], '2026-09-29', 3, new Date('2026-09-29T15:00:00Z')),
      },
    })),
    mail: {
      suggestions: vi.fn(async () => ({ ok: true, value: [] })),
      status: vi.fn(async () => ({
        ok: true,
        value: {
          config: mailConfigData,
          address: 'qa@example.test',
          connected: true,
          needsReconnect: false,
          lastSyncedAt: null,
          busy: null,
          hasMore: false,
          error: null,
        },
      })),
      list: vi.fn(async () => ({
        ok: true,
        value: {
          messages: [{ ...mailContent, id: 'fake-id', providerId: 'fake-provider' }],
          total: 1,
          page: 0,
          pageSize: 50,
        },
      })),
      taskDraft: vi.fn(async () => ({
        ok: true,
        value: {
          input: {
            ...taskData,
            title: 'Revisar correo',
            description: '',
            dueDate: null,
            dueTime: null,
          },
          existing: null,
        },
      })),
      createTask: vi.fn(async () => ({
        ok: true,
        value: { task: { ...taskData, id: 'created' }, created: true },
      })),
    },
  };
  window.qa = api as unknown as QaApi;
  return api;
}
it('abre un borrador revisable desde Inicio y solo crea la tarea al guardar', async () => {
  const api = setup();
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: /Evidencia de pruebas/ }, { timeout: 5000 }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea desde correo' }));
  expect(
    await screen.findByRole('heading', { name: 'Crear tarea desde correo' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Título de la tarea')).toHaveValue('Revisar correo');
  expect(screen.getByLabelText('Fecha límite')).toHaveValue('');
  expect(screen.getByText(/El cuerpo del correo no se copia/)).toBeInTheDocument();
  expect(api.mail.createTask).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(api.mail.createTask).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /Evidencia de pruebas/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea desde correo' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Guardar tarea' }));
  await waitFor(() => expect(api.mail.createTask).toHaveBeenCalledOnce());
  expect(api.mail.createTask).toHaveBeenCalledWith(
    'fake-id',
    expect.objectContaining({ title: 'Revisar correo', dueDate: null }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.snapshot).toHaveBeenCalledTimes(2);
});
it('expone un fallo de borrador sin abrir un formulario ni crear datos', async () => {
  const api = setup();
  api.mail.taskDraft.mockRejectedValue(new Error('El correo ya no está disponible.'));
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: /Evidencia de pruebas/ }, { timeout: 5000 }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea desde correo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El correo ya no está disponible.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.mail.createTask).not.toHaveBeenCalled();
});
