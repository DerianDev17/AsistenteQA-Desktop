import { setTimeout as delay } from 'node:timers/promises';
import type { CalendarProvider } from '../../application/calendar/ports';
import type { CalendarEvent } from '../../domain/calendar';
import { AppError, record } from '../../domain/validation';
import { sanitizeMailText } from '../../domain/sanitize';
import { retryDelay } from '../email/microsoft-graph';

export function teamsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function calendarUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('FORBIDDEN', 'Cursor de calendario no válido.');
  }
  if (
    url.origin !== 'https://graph.microsoft.com' ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/v1\.0\/(?:me|users\/[^/]+)\/(?:calendar\/)?calendarView$/i.test(url.pathname)
  )
    throw new AppError('FORBIDDEN', 'La dirección de calendario no está permitida.');
  return url.href;
}
function text(value: unknown, max = 4096) {
  if (typeof value !== 'string' || value.length > max)
    throw new AppError('NETWORK', 'Microsoft devolvió un evento no válido.');
  return value;
}
function instant(value: unknown) {
  const data = record(value);
  if (data.timeZone !== 'UTC' && data.timeZone !== 'Etc/UTC')
    throw new AppError('NETWORK', 'Microsoft no devolvió el horario en UTC.');
  const raw = text(data.dateTime, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)?$/.test(raw))
    throw new AppError('NETWORK', 'Horario de calendario no válido.');
  const date = new Date(/(?:Z|\+00:00)$/.test(raw) ? raw : `${raw}Z`);
  if (!Number.isFinite(date.getTime()))
    throw new AppError('NETWORK', 'Fecha de calendario no válida.');
  return date.toISOString();
}
export function parseEvent(value: unknown): CalendarEvent | null {
  const raw = record(value);
  const response = raw.responseStatus ? record(raw.responseStatus).response : 'none';
  if (raw.isCancelled === true || response === 'declined' || raw.type === 'seriesMaster')
    return null;
  const id = text(raw.id);
  if (!id) throw new AppError('NETWORK', 'Evento sin identificador.');
  const start = instant(raw.start);
  const end = instant(raw.end);
  if (end <= start) throw new AppError('NETWORK', 'El evento tiene un intervalo no válido.');
  const privateEvent = ['private', 'confidential'].includes(String(raw.sensitivity));
  const organizer = raw.organizer ? record(record(raw.organizer).emailAddress) : {};
  return {
    id,
    start,
    end,
    allDay: raw.isAllDay === true,
    subject: privateEvent
      ? 'Evento privado'
      : sanitizeMailText(text(raw.subject ?? '') || '(Sin título)'),
    organizer: privateEvent
      ? ''
      : sanitizeMailText(text(organizer.name ?? organizer.address ?? '', 1024)),
    location: privateEvent
      ? ''
      : sanitizeMailText(text(raw.location ? (record(raw.location).displayName ?? '') : '', 1024)),
    response: ['accepted', 'tentativelyAccepted', 'notResponded', 'organizer'].includes(
      String(response),
    )
      ? (response as CalendarEvent['response'])
      : 'none',
    teamsUrl: privateEvent
      ? null
      : teamsUrl(raw.onlineMeeting ? record(raw.onlineMeeting).joinUrl : null),
  };
}
export class MicrosoftCalendar implements CalendarProvider {
  private retryUntil = 0;
  constructor(
    private fetcher: typeof fetch = fetch,
    private sleep: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) =>
      delay(ms, undefined, { signal }),
  ) {}
  async events(token: string, start: string, end: string, signal: AbortSignal) {
    const initial = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
    initial.searchParams.set('startDateTime', start);
    initial.searchParams.set('endDateTime', end);
    initial.searchParams.set('$top', '100');
    initial.searchParams.set(
      '$select',
      'id,subject,start,end,isAllDay,isCancelled,responseStatus,organizer,location,onlineMeeting,sensitivity,type',
    );
    const result = new Map<string, CalendarEvent>();
    const visited = new Set<string>();
    let next: string | null = initial.href;
    for (let page = 0; next && page < 20; page++) {
      const url = calendarUrl(next);
      if (visited.has(url))
        throw new AppError('NETWORK', 'Microsoft repitió una página del calendario.');
      visited.add(url);
      const payload = await this.request(url, token, signal);
      if (!Array.isArray(payload.value) || payload.value.length > 1000)
        throw new AppError('NETWORK', 'La página de calendario no es válida.');
      for (const raw of payload.value) {
        const event = parseEvent(raw);
        if (event && event.start < end && event.end > start) result.set(event.id, event);
        else if (typeof record(raw).id === 'string') result.delete(record(raw).id as string);
      }
      if (result.size > 2000)
        throw new AppError(
          'NETWORK',
          'La agenda supera el límite de 2000 eventos. Se conserva la última copia completa.',
        );
      next =
        payload['@odata.nextLink'] === undefined
          ? null
          : calendarUrl(text(payload['@odata.nextLink'], 20000));
    }
    if (next)
      throw new AppError(
        'NETWORK',
        'La agenda supera el límite de páginas. Se conserva la última copia completa.',
      );
    return [...result.values()].sort(
      (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    );
  }
  private async request(
    url: string,
    token: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    if (Date.now() < this.retryUntil)
      throw new AppError(
        'RATE_LIMIT',
        'Microsoft pidió esperar antes de volver a consultar el calendario.',
      );
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"',
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
          'No se pudo conectar al calendario de Microsoft. Se conserva la agenda descargada.',
        );
      }
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        const wait = retryDelay(response.headers.get('retry-after'), attempt);
        await response.body?.cancel();
        if (attempt === 2 || wait > 30000) {
          this.retryUntil = Date.now() + wait;
          throw new AppError(
            'RATE_LIMIT',
            'Microsoft está limitando las consultas de calendario. Intenta más tarde.',
          );
        }
        await this.sleep(wait, signal);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if ([401, 403].includes(response.status))
          throw new AppError(
            'AUTH_REQUIRED',
            'Autoriza el permiso delegado Calendars.Read en Microsoft Entra y vuelve a conectar el calendario.',
          );
        throw new AppError(
          'NETWORK',
          'Microsoft no pudo devolver el calendario. Revisa el acceso a Exchange Online.',
        );
      }
      const raw = await response.text();
      if (raw.length > 2000000)
        throw new AppError('NETWORK', 'La respuesta de calendario es demasiado grande.');
      try {
        return record(JSON.parse(raw));
      } catch {
        throw new AppError('NETWORK', 'La respuesta de calendario no es válida.');
      }
    }
    throw new AppError('NETWORK', 'No se pudo sincronizar el calendario.');
  }
}
