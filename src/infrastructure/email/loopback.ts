import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppError } from '../../domain/validation';

export interface AuthorizationListener {
  redirectUri: string;
  code: Promise<string>;
  close(): void;
}
export async function authorizationListener(
  state: string,
  signal: AbortSignal,
  timeoutMs = 180000,
): Promise<AuthorizationListener> {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // A handler is attached immediately; caller may still be awaiting getAuthCodeUrl.
  void code.catch(() => undefined);
  let settled = false;
  let redirectUri = '';
  const server = createServer((request, response) => {
    let url: URL;
    try {
      url = new URL(request.url ?? '/', redirectUri);
    } catch {
      response.writeHead(400);
      response.end('Solicitud no válida.');
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (
      request.method !== 'GET' ||
      url.pathname !== '/' ||
      request.headers.host !== new URL(redirectUri).host ||
      url.searchParams.get('state') !== state ||
      settled
    ) {
      response.writeHead(400);
      response.end('Solicitud no válida. Regresa a QA Assistant.');
      return;
    }
    const result = url.searchParams.get('code');
    if (!result || result.length > 16384 || url.searchParams.has('error')) {
      response.end(
        '<h1>No se completó el acceso</h1><p>Regresa a QA Assistant para revisar la configuración de Microsoft 365.</p>',
      );
      finish(
        new AppError(
          'AUTH_REQUIRED',
          'Microsoft no autorizó el acceso. Revisa los permisos y las políticas de tu institución.',
        ),
      );
      return;
    }
    response.end(
      '<h1>Regresa a QA Assistant</h1><p>La aplicación está completando la conexión. Puedes cerrar esta pestaña.</p>',
    );
    settled = true;
    cleanup();
    resolveCode(result);
  });
  function cleanup() {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    server.close();
  }
  function finish(error: Error) {
    if (settled) return;
    settled = true;
    cleanup();
    rejectCode(error);
  }
  function abort() {
    finish(new AppError('CANCELLED', 'Inicio de sesión cancelado.'));
  }
  if (signal.aborted) throw new AppError('CANCELLED', 'Inicio de sesión cancelado.');
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  redirectUri = `http://localhost:${(server.address() as AddressInfo).port}/`;
  server.on('error', () =>
    finish(new AppError('NETWORK', 'No se pudo recibir la respuesta de Microsoft en este equipo.')),
  );
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(
    () =>
      finish(new AppError('CANCELLED', 'El inicio de sesión expiró. Vuelve a conectar tu cuenta.')),
    timeoutMs,
  );
  if (signal.aborted) abort();
  return {
    redirectUri,
    code,
    close: () => finish(new AppError('CANCELLED', 'Inicio de sesión cancelado.')),
  };
}
