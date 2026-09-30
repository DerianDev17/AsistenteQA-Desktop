import { expect, it, vi } from 'vitest';
import { calendarWindow, eventsOnDay } from '../../src/domain/calendar';
import {
  calendarUrl,
  MicrosoftCalendar,
  parseEvent,
  teamsUrl,
} from '../../src/infrastructure/calendar/microsoft-calendar';
import { calendarEvent, graphEvent } from '../calendar-fixtures';

it('interpreta UTC, ocurrencias y respuestas pendientes sin aceptar invitaciones', () => {
  expect(parseEvent(graphEvent)).toEqual(calendarEvent);
  expect(
    parseEvent({ ...graphEvent, responseStatus: { response: 'notResponded' } })?.response,
  ).toBe('notResponded');
  expect(parseEvent({ ...graphEvent, isCancelled: true })).toBeNull();
  expect(parseEvent({ ...graphEvent, responseStatus: { response: 'declined' } })).toBeNull();
  expect(() => parseEvent({ ...graphEvent, end: graphEvent.start })).toThrow();
  expect(() =>
    parseEvent({ ...graphEvent, start: { ...graphEvent.start, timeZone: 'unknown' } }),
  ).toThrow();
});
it('protege eventos privados y bloquea URLs de cursor o Teams ajenas', () => {
  expect(parseEvent({ ...graphEvent, sensitivity: 'private' })).toMatchObject({
    subject: 'Evento privado',
    teamsUrl: null,
    organizer: '',
    location: '',
  });
  for (const url of [
    'https://evil.test/v1.0/me/calendarView',
    'https://graph.microsoft.com/v1.0/me/messages',
    'https://user@graph.microsoft.com/v1.0/me/calendarView',
  ])
    expect(() => calendarUrl(url)).toThrow();
  for (const url of [
    'javascript:alert(1)',
    'https://teams.microsoft.com.evil.test/x',
    'https://user@teams.microsoft.com/x',
    'http://teams.microsoft.com/x',
  ])
    expect(teamsUrl(url)).toBeNull();
  expect(teamsUrl(calendarEvent.teamsUrl)).toBe(calendarEvent.teamsUrl);
});
it('incluye cruces de medianoche y días completos con final exclusivo', () => {
  const start = new Date(2026, 8, 30);
  const end = new Date(2026, 9, 1);
  const allDay = {
    ...calendarEvent,
    allDay: true,
    start: start.toISOString(),
    end: end.toISOString(),
  };
  expect(eventsOnDay([allDay], '2026-09-30')).toHaveLength(1);
  expect(eventsOnDay([allDay], '2026-10-01')).toHaveLength(0);
  const overnight = {
    ...calendarEvent,
    start: new Date(2026, 8, 29, 23).toISOString(),
    end: new Date(2026, 8, 30, 1).toISOString(),
  };
  expect(eventsOnDay([overnight], '2026-09-30')).toHaveLength(1);
  expect(calendarWindow(new Date(2026, 8, 30, 12))).toEqual({
    start: new Date(2026, 8, 23).toISOString(),
    end: new Date(2026, 9, 31).toISOString(),
  });
});
it('pagina eventos recurrentes, deduplica y evita descargar cuerpos o asistentes', async () => {
  const next = 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=fake';
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        value: [graphEvent, { ...graphEvent, id: 'cancelled' }],
        '@odata.nextLink': next,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        value: [
          graphEvent,
          { ...graphEvent, id: 'occurrence-2' },
          { ...graphEvent, id: 'cancelled', isCancelled: true },
        ],
      }),
    );
  const events = await new MicrosoftCalendar(fetcher).events(
    'fake-token',
    '2026-09-01T00:00:00Z',
    '2026-10-31T00:00:00Z',
    new AbortController().signal,
  );
  expect(events).toHaveLength(2);
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get('$select')).not.toMatch(/body|attendees/);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    redirect: 'error',
    headers: { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' },
  });
  expect(fetcher.mock.calls[1][0]).toBe(next);
});
it('respeta Retry-After entre intentos y rechaza permisos insuficientes', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '60' } }));
  const provider = new MicrosoftCalendar(fetcher, vi.fn());
  const run = () =>
    provider.events(
      'fake-token',
      calendarEvent.start,
      calendarEvent.end,
      new AbortController().signal,
    );
  await expect(run()).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  await expect(run()).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  expect(fetcher).toHaveBeenCalledOnce();
  const denied = new MicrosoftCalendar(
    vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
  );
  await expect(
    denied.events(
      'fake-token',
      calendarEvent.start,
      calendarEvent.end,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
});
it('conserva el límite de páginas, rechaza cursores repetidos y responde a cancelación', async () => {
  const link = 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=fake';
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      Response.json({ value: [graphEvent], '@odata.nextLink': link }),
    );
  await expect(
    new MicrosoftCalendar(fetcher).events(
      'fake',
      calendarEvent.start,
      calendarEvent.end,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: 'NETWORK' });
  const controller = new AbortController();
  controller.abort();
  await expect(
    new MicrosoftCalendar(fetcher).events(
      'fake',
      calendarEvent.start,
      calendarEvent.end,
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
});
