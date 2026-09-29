import { expect, it, vi } from 'vitest';
import { respond, trustedSender } from '../../src/main/ipc/handlers';
import { AppError } from '../../src/domain/validation';

it('oculta detalles internos y nunca registra contenido de la solicitud', async () => {
  const log = vi.fn();
  const result = await respond(
    'project:create',
    async () => {
      throw new Error('sensitive-payload-placeholder');
    },
    log,
  );
  expect(result).toEqual({
    ok: false,
    error: { code: 'INTERNAL', message: 'No se pudo completar la operación. Intenta nuevamente.' },
  });
  expect(log).toHaveBeenCalledExactlyOnceWith('project:create', 'INTERNAL');
});
it('devuelve errores de validación útiles', async () => {
  expect(
    await respond(
      'task:create',
      async () => {
        throw new AppError('VALIDATION', 'Título requerido.');
      },
      vi.fn(),
    ),
  ).toEqual({ ok: false, error: { code: 'VALIDATION', message: 'Título requerido.' } });
});
it('solo admite el frame principal de la ventana y URL esperadas', () => {
  const url = 'file:///app/index.html';
  expect(trustedSender(1, 1, url, url, true)).toBe(true);
  expect(trustedSender(2, 1, url, url, true)).toBe(false);
  expect(trustedSender(1, 1, url, url, false)).toBe(false);
  expect(trustedSender(1, 1, `${url}?other`, url, true)).toBe(false);
  expect(trustedSender(1, 1, 'https://example.org', url, true)).toBe(false);
});
