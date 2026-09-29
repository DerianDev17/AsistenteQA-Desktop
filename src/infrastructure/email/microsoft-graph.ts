import { setTimeout as delay } from 'node:timers/promises';
import type { MailProvider } from '../../application/email/ports';
import type { MailChange, MailContent } from '../../domain/email';
import { AppError, record } from '../../domain/validation';

const base = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta';
export function graphUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('FORBIDDEN', 'Microsoft devolvió un cursor de sincronización no válido.');
  }
  if (
    url.origin !== 'https://graph.microsoft.com' ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/v1\.0\/(?:me|users\/[^/]+)\/mailFolders(?:\/[^/]+|\('[^']+'\))\/messages\/delta$/i.test(
      url.pathname,
    )
  )
    throw new AppError('FORBIDDEN', 'La dirección de sincronización no está permitida.');
  return url.href;
}
function graphText(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max)
    throw new AppError('NETWORK', 'Microsoft devolvió datos de correo no válidos.');
  return value;
}
export function parseChange(value: unknown): MailChange {
  const message = record(value);
  const providerId = graphText(message.id, 4096);
  if (!providerId) throw new AppError('NETWORK', 'Microsoft devolvió un correo sin identificador.');
  if (message['@removed']) return { providerId, deleted: true };
  const data: Partial<MailContent> = {};
  if ('conversationId' in message) data.threadId = graphText(message.conversationId, 4096);
  if ('subject' in message) data.subject = graphText(message.subject ?? '', 4096) || '(Sin asunto)';
  if ('bodyPreview' in message) data.preview = graphText(message.bodyPreview ?? '', 10000);
  if ('receivedDateTime' in message) {
    const received = graphText(message.receivedDateTime, 64);
    if (!Number.isFinite(Date.parse(received)))
      throw new AppError('NETWORK', 'Microsoft devolvió una fecha de correo no válida.');
    data.receivedAt = new Date(received).toISOString();
  }
  if (message.from) {
    const address = record(record(message.from).emailAddress);
    data.sender = graphText(address.address ?? '', 512);
    data.senderName = graphText(address.name ?? '', 1024);
  }
  for (const key of ['isRead', 'hasAttachments'] as const)
    if (key in message) {
      if (typeof message[key] !== 'boolean')
        throw new AppError('NETWORK', 'Microsoft devolvió un estado de correo no válido.');
      data[key] = message[key];
    }
  if ('importance' in message) {
    if (!['low', 'normal', 'high'].includes(String(message.importance)))
      throw new AppError('NETWORK', 'Microsoft devolvió una prioridad no válida.');
    data.importance = message.importance as MailContent['importance'];
  }
  return { providerId, deleted: false, data };
}
export function retryDelay(header: string | null, attempt: number, now = Date.now()): number {
  if (header !== null) {
    const seconds = Number(header);
    const wait =
      header.trim() && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
    if (Number.isFinite(wait)) return Math.max(0, wait);
  }
  return 1000 * 2 ** attempt;
}
export class MicrosoftGraph implements MailProvider {
  private retryUntil = 0;
  constructor(
    private fetcher: typeof fetch = fetch,
    private sleep: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) =>
      delay(ms, undefined, { signal }),
  ) {}
  async page(token: string, cursor: string | null, since: string, signal: AbortSignal) {
    if (Date.now() < this.retryUntil)
      throw new AppError(
        'RATE_LIMIT',
        'Microsoft solicitó esperar antes de volver a consultar. Intenta sincronizar más tarde.',
      );
    const initial = new URL(base);
    initial.searchParams.set(
      '$select',
      'id,conversationId,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance',
    );
    initial.searchParams.set('$filter', `receivedDateTime ge ${since}`);
    initial.searchParams.set('$orderby', 'receivedDateTime desc');
    const url = graphUrl(cursor ?? initial.href);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'odata.maxpagesize=50, IdType="ImmutableId"',
          },
          redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
        });
      } catch {
        if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
        if (attempt < 2) {
          await this.sleep(1000 * 2 ** attempt, signal);
          continue;
        }
        throw new AppError(
          'NETWORK',
          'No se pudo conectar con Microsoft Graph. Los correos descargados siguen disponibles.',
        );
      }
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        const wait = retryDelay(response.headers.get('retry-after'), attempt);
        await response.body?.cancel();
        if (attempt === 2 || wait > 30000) {
          this.retryUntil = Date.now() + wait;
          throw new AppError(
            'RATE_LIMIT',
            'Microsoft está limitando las consultas o no está disponible. Espera unos minutos antes de sincronizar.',
          );
        }
        await this.sleep(wait, signal);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401)
          throw new AppError(
            'AUTH_REQUIRED',
            'Microsoft requiere renovar la autorización. Vuelve a conectar la cuenta.',
          );
        if (response.status === 403)
          throw new AppError(
            'AUTH_REQUIRED',
            'Tu institución no permitió leer el correo. Solicita a TI el permiso delegado Mail.Read y revisa el acceso condicional.',
          );
        if (response.status === 410)
          throw new AppError(
            'SYNC_RESET',
            'Microsoft renovó el historial de cambios. Vuelve a sincronizar para reconstruir los últimos 30 días.',
          );
        throw new AppError(
          'NETWORK',
          'Microsoft no pudo devolver la bandeja de entrada. Revisa que la cuenta tenga un buzón de Exchange Online.',
        );
      }
      const raw = await response.text();
      if (raw.length > 2000000)
        throw new AppError('NETWORK', 'La respuesta de Microsoft excede el tamaño permitido.');
      let payload: Record<string, unknown>;
      try {
        payload = record(JSON.parse(raw));
      } catch {
        throw new AppError('NETWORK', 'La respuesta de Microsoft no es válida.');
      }
      if (!Array.isArray(payload.value) || payload.value.length > 1000)
        throw new AppError('NETWORK', 'La página de Microsoft no es válida.');
      const next = payload['@odata.nextLink'];
      const delta = payload['@odata.deltaLink'];
      if (typeof (next ?? delta) !== 'string')
        throw new AppError('NETWORK', 'Microsoft no devolvió un cursor de sincronización.');
      return {
        changes: payload.value.map(parseChange),
        cursor: graphUrl(String(next ?? delta)),
        hasMore: typeof next === 'string',
      };
    }
    throw new AppError('NETWORK', 'No se pudo sincronizar el correo.');
  }
}
