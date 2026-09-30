import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Agenda } from '../../src/renderer/components/Agenda';
import { ActivitySuggestions } from '../../src/renderer/components/ActivitySuggestions';
import type { QaApi } from '../../src/shared/api';
import { calendarSnapshot } from '../calendar-fixtures';
import { mailContent } from '../mail-fixtures';

it('solicita autorización de calendario únicamente por acción del usuario', async () => {
  const connect = vi.fn().mockResolvedValue({ ok: true });
  const sync = vi.fn();
  window.qa = {
    calendar: {
      snapshot: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...calendarSnapshot, enabled: false, events: [] },
      }),
      connect,
      sync,
    },
  } as unknown as QaApi;
  render(<Agenda onMail={vi.fn()} />);
  expect(await screen.findByText(/Calendars.Read/)).toBeInTheDocument();
  expect(connect).not.toHaveBeenCalled();
  expect(sync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Autorizar calendario' }));
  expect(connect).toHaveBeenCalledOnce();
});
it('muestra invitación pendiente, abre por identificador y conserva eventos cuando falla la sincronización', async () => {
  const openMeeting = vi.fn().mockResolvedValue({ ok: true });
  window.qa = {
    calendar: {
      snapshot: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...calendarSnapshot,
          events: [{ ...calendarSnapshot.events[0], response: 'notResponded' }],
        },
      }),
      openMeeting,
      sync: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { code: 'NETWORK', message: 'Sin conexión.' } }),
    },
  } as unknown as QaApi;
  render(<Agenda onMail={vi.fn()} />);
  expect(await screen.findByText('Revisión de certificación')).toBeInTheDocument();
  expect(screen.getByText('Por responder')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Abrir Teams' }));
  expect(openMeeting).toHaveBeenCalledWith(calendarSnapshot.events[0].id);
  await userEvent.click(screen.getByRole('button', { name: 'Sincronizar agenda' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión.');
  expect(screen.getByText('Revisión de certificación')).toBeInTheDocument();
});
it('presenta propuestas de correo sin crear tareas hasta revisión explícita', async () => {
  const onReview = vi.fn();
  const message = { ...mailContent, id: 'fake-message' };
  window.qa = {
    mail: {
      suggestions: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          {
            message,
            category: 'CERTIFICATION',
            reason: 'Revisa la acción antes de guardar.',
            projectId: null,
            projectName: null,
          },
        ],
      }),
    },
  } as unknown as QaApi;
  render(<ActivitySuggestions onReview={onReview} busy={false} />);
  expect(await screen.findByText('Evidencia de pruebas')).toBeInTheDocument();
  expect(onReview).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Revisar actividad' }));
  expect(onReview).toHaveBeenCalledWith(message);
});
