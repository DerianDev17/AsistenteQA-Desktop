import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardMail } from '../../src/renderer/components/DashboardMail';
import type { MailPage, MailStatus } from '../../src/domain/email';
import type { QaApi } from '../../src/shared/api';
import { mailConfigData, mailContent } from '../mail-fixtures';

const connected: MailStatus = {
  config: mailConfigData,
  address: 'qa@example.test',
  connected: true,
  needsReconnect: false,
  lastSyncedAt: null,
  busy: null,
  hasMore: false,
  error: null,
};
const inbox: MailPage = {
  messages: Array.from({ length: 6 }, (_, index) => ({
    ...mailContent,
    subject: `Correo ${index + 1}`,
    id: `fake-${index}`,
    providerId: `fake-${index}`,
    preview: '<img src=x onerror=alert(1)>',
    importance: 'high',
  })),
  total: 76,
  page: 0,
  pageSize: 50,
};
function mockMail(status = connected, page = inbox) {
  const mail = {
    status: vi.fn().mockResolvedValue({ ok: true, value: status }),
    list: vi.fn().mockResolvedValue({ ok: true, value: page }),
    sync: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
  window.qa = { mail } as unknown as QaApi;
  return mail;
}
afterEach(() => vi.useRealTimers());

it('muestra total real, los cinco recientes, importancia y vista previa segura', async () => {
  const mail = mockMail();
  const onOpenInbox = vi.fn();
  render(<DashboardMail onOpenInbox={onOpenInbox} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando resumen');
  expect(await screen.findByText('76 correos descargados')).toBeInTheDocument();
  expect(screen.getByText('Sincronización manual')).toBeInTheDocument();
  expect(screen.queryByText('Correo 6')).not.toBeInTheDocument();
  expect(screen.getAllByText('Importante')).toHaveLength(5);
  await userEvent.click(screen.getByRole('button', { name: /Correo 1/ }));
  expect(screen.getByRole('dialog')).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ver correos' }));
  expect(onOpenInbox).toHaveBeenCalledOnce();
  expect(mail.list).toHaveBeenCalledWith(0);
  expect(mail.sync).not.toHaveBeenCalled();
});

it('refresca tras sincronizar y distingue una cuenta conectada sin descarga', async () => {
  const mail = mockMail(connected, { ...inbox, messages: [], total: 0 });
  render(<DashboardMail onOpenInbox={vi.fn()} />);
  expect(await screen.findByText('Todavía no hay correos descargados')).toBeInTheDocument();
  expect(screen.getByText('Aún no se ha completado una sincronización')).toBeInTheDocument();
  let complete!: (value: unknown) => void;
  mail.sync.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Sincronizar correo' }));
  expect(screen.getByRole('button', { name: 'Sincronizando…' })).toBeDisabled();
  mail.list.mockResolvedValue({ ok: true, value: inbox });
  mail.status.mockResolvedValue({
    ok: true,
    value: { ...connected, lastSyncedAt: mailContent.receivedAt },
  });
  await act(async () => complete({ ok: true, value: undefined }));
  expect(await screen.findByText('76 correos descargados')).toBeInTheDocument();
  expect(screen.getByText(/Última sincronización:/)).toBeInTheDocument();
});

it('observa sincronización en segundo plano y limpia mensajes al desconectar sin llamar a Microsoft', async () => {
  vi.useFakeTimers();
  const mail = mockMail(connected, { ...inbox, messages: [], total: 0 });
  const view = render(<DashboardMail onOpenInbox={vi.fn()} />);
  await act(async () => {});
  mail.list.mockResolvedValue({ ok: true, value: inbox });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.getByText('76 correos descargados')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Correo 1/ }));
  mail.status.mockResolvedValue({
    ok: true,
    value: { ...connected, connected: false, address: null },
  });
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(screen.getByText('Conecta tu correo institucional')).toBeInTheDocument();
  expect(screen.queryByText('76 correos descargados')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mail.sync).not.toHaveBeenCalled();
  view.unmount();
  const calls = mail.status.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
    window.dispatchEvent(new Event('focus'));
  });
  expect(mail.status).toHaveBeenCalledTimes(calls);
});

it('conserva la copia local ante fallos y permite renovar una autorización vencida', async () => {
  const mail = mockMail({ ...connected, hasMore: true });
  const navigate = vi.fn();
  render(<DashboardMail onOpenInbox={navigate} />);
  expect(await screen.findByText(/La descarga está incompleta/)).toBeInTheDocument();
  mail.sync.mockResolvedValue({
    ok: false,
    error: { code: 'NETWORK', message: 'Sin conexión a Microsoft.' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar sincronización' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión a Microsoft.');
  expect(screen.getByText('76 correos descargados')).toBeInTheDocument();
  mail.status.mockResolvedValue({ ok: true, value: { ...connected, needsReconnect: true } });
  fireEvent.focus(window);
  await userEvent.click(await screen.findByRole('button', { name: 'Renovar acceso' }));
  expect(navigate).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Sincronizar correo' })).not.toBeInTheDocument();
});

it('permite recuperar un error de carga sin presentar cifras falsas', async () => {
  const mail = mockMail();
  mail.status.mockResolvedValue({
    ok: false,
    error: { code: 'INTERNAL', message: 'No se pudo cargar el correo.' },
  });
  render(<DashboardMail onOpenInbox={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el correo.');
  expect(screen.queryByText(/correos descargados/)).not.toBeInTheDocument();
  mail.status.mockResolvedValue({ ok: true, value: connected });
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado del correo' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByText('76 correos descargados')).toBeInTheDocument();
});

it('explica una bandeja vacía ya sincronizada y deshabilita acciones mientras trabaja el servicio', async () => {
  const mail = mockMail(
    { ...connected, lastSyncedAt: mailContent.receivedAt, busy: 'sync' },
    { ...inbox, total: 0, messages: [] },
  );
  render(<DashboardMail onOpenInbox={vi.fn()} />);
  expect(await screen.findByText('Sin correos recientes en la bandeja')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sincronizando…' })).toBeDisabled();
  expect(mail.sync).not.toHaveBeenCalled();
});
