import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/app/App';
import { defaultSettings } from '../../src/domain/models';
import { overview } from '../../src/domain/overview';
import type { QaApi } from '../../src/shared/api';

it('muestra carga, estado vacío y navegación a módulos pendientes', async () => {
  let finish!: (value: Awaited<ReturnType<QaApi['snapshot']>>) => void;
  window.qa = {
    mail: {
      status: vi.fn().mockResolvedValue({ ok: true, value: { connected: false } }),
    },
    snapshot: vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  } as unknown as QaApi;
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo tu espacio');
  finish({
    ok: true,
    value: {
      projects: [],
      tasks: [],
      settings: defaultSettings,
      today: '2026-09-29',
      overview: overview([], [], '2026-09-29', 3, new Date()),
    },
  });
  expect(await screen.findByText('Un espacio para tus proyectos')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Calendario' }));
  expect(screen.getByText('Este módulo llegará en una próxima fase')).toBeInTheDocument();
});
it('permite reintentar cuando falla la carga', async () => {
  const snapshot = vi.fn().mockResolvedValue({
    ok: false,
    error: { code: 'INTERNAL', message: 'No se pudo abrir el espacio.' },
  });
  window.qa = { snapshot } as unknown as QaApi;
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir el espacio.');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(snapshot).toHaveBeenCalledTimes(2);
});
