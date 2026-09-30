import type { CalendarEvent, CalendarSnapshot } from '../src/domain/calendar';
export const calendarEvent: CalendarEvent = {
  id: 'fake-meeting',
  subject: 'Revisión de certificación',
  start: '2026-09-30T15:00:00.000Z',
  end: '2026-09-30T16:00:00.000Z',
  allDay: false,
  organizer: 'Equipo QA',
  location: 'Teams',
  response: 'accepted',
  teamsUrl: 'https://teams.microsoft.com/l/meetup-join/fake-meeting',
};
export const calendarSnapshot: CalendarSnapshot = {
  connected: true,
  enabled: true,
  autoSync: false,
  busy: false,
  needsReconnect: false,
  error: null,
  start: '2026-09-23T05:00:00.000Z',
  end: '2026-10-31T05:00:00.000Z',
  lastSyncedAt: '2026-09-30T14:00:00.000Z',
  events: [calendarEvent],
};
export const graphEvent = {
  id: calendarEvent.id,
  subject: calendarEvent.subject,
  start: { dateTime: '2026-09-30T15:00:00.0000000', timeZone: 'UTC' },
  end: { dateTime: '2026-09-30T16:00:00.0000000', timeZone: 'UTC' },
  isAllDay: false,
  isCancelled: false,
  responseStatus: { response: 'accepted' },
  sensitivity: 'normal',
  type: 'occurrence',
  organizer: { emailAddress: { name: 'Equipo QA' } },
  location: { displayName: 'Teams' },
  onlineMeeting: { joinUrl: calendarEvent.teamsUrl },
};
