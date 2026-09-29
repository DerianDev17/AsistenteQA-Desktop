import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Emails } from '../../src/renderer/pages/Emails';
import type { QaApi } from '../../src/shared/api';
import type { MailStatus } from '../../src/domain/email';
import { mailConfigData, mailContent } from '../mail-fixtures';

const disconnected: MailStatus = {
  config: null,
  address: null,
  connected: false,
  needsReconnect: false,
  lastSyncedAt: null,
  busy: null,
  hasMore: false,
  error: null,
};
function mockApi(status = disconnected) {
  const mail: QaApi['mail'] = {
    status: vi.fn(async () => ({ ok: true as const, value: status })),
    list: vi.fn(async () => ({
      ok: true as const,
      value: { messages: [], total: 0, page: 0, pageSize: 50 },
    })),
    configure: vi.fn(async () => ({ ok: true as const, value: undefined })),
    connect: vi.fn(async () => ({ ok: true as const, value: undefined })),
    sync: vi.fn(async () => ({ ok: true as const, value: undefined })),
    cancel: vi.fn(async () => ({ ok: true as const, value: undefined })),
    disconnect: vi.fn(async () => ({ ok: true as const, value: undefined })),
  };
  window.qa = { mail } as QaApi;
  return mail;
}
it('guía el registro y valida IDs antes de guardar sin pedir contraseña', async () => {
  const mail = mockApi();
  const user = userEvent.setup();
  render(<Emails />);
  expect(await screen.findByText('Tu bandeja está lista para conectar')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Conectar y sincronizar' })).toBeDisabled();
  await user.type(screen.getByLabelText('Application (client) ID'), 'wrong');
  await user.type(screen.getByLabelText('Directory (tenant) ID'), mailConfigData.tenantId);
  await user.click(screen.getByRole('button', { name: 'Guardar conexión' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('GUID');
  expect(mail.configure).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText('Application (client) ID'));
  await user.type(screen.getByLabelText('Application (client) ID'), mailConfigData.clientId);
  await user.click(screen.getByRole('button', { name: 'Guardar conexión' }));
  expect(mail.configure).toHaveBeenCalledWith({ ...mailConfigData, autoSync: true });
  expect(document.querySelector('input[type=password]')).toBeNull();
});
it('muestra errores de sincronización y permite desconectar con confirmación', async () => {
  const mail = mockApi({
    ...disconnected,
    config: mailConfigData,
    connected: true,
    address: 'qa@example.test',
  });
  vi.mocked(mail.sync).mockResolvedValue({
    ok: false,
    error: { code: 'NETWORK', message: 'Sin conexión a Microsoft.' },
  });
  const user = userEvent.setup();
  render(<Emails />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión a Microsoft.');
  await user.click(screen.getByRole('button', { name: 'Desconectar cuenta' }));
  expect(mail.disconnect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirmar desconexión' }));
  await waitFor(() => expect(mail.disconnect).toHaveBeenCalledTimes(1));
});
it('muestra la vista previa como texto sin ejecutar HTML ni marcar leído', async () => {
  const mail = mockApi({
    ...disconnected,
    config: mailConfigData,
    connected: true,
    address: 'qa@example.test',
  });
  vi.mocked(mail.list).mockResolvedValue({
    ok: true,
    value: {
      messages: [
        {
          ...mailContent,
          id: 'fake-id',
          providerId: 'fake-provider',
          preview: '<img src=x onerror=alert(1)>',
        },
      ],
      total: 1,
      page: 0,
      pageSize: 50,
    },
  });
  const user = userEvent.setup();
  render(<Emails />);
  await user.click(await screen.findByRole('button', { name: /Evidencia de pruebas/ }));
  expect(screen.getByRole('dialog')).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img')).toBeNull();
  expect(mail.sync).not.toHaveBeenCalled();
});
