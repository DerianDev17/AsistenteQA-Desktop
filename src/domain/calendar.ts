export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  allDay: boolean;
  organizer: string;
  location: string;
  response: 'accepted' | 'tentativelyAccepted' | 'notResponded' | 'organizer' | 'none';
  teamsUrl: string | null;
}
export interface CalendarCache {
  enabled: boolean;
  lastSyncedAt: string | null;
  start: string | null;
  end: string | null;
  events: CalendarEvent[];
}
export interface CalendarSnapshot extends CalendarCache {
  connected: boolean;
  autoSync: boolean;
  busy: boolean;
  needsReconnect: boolean;
  error: string | null;
}
export const emptyCalendar = (): CalendarCache => ({
  enabled: false,
  lastSyncedAt: null,
  start: null,
  end: null,
  events: [],
});
export function calendarWindow(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 31);
  return { start: start.toISOString(), end: end.toISOString() };
}
export function eventsOnDay(events: CalendarEvent[], day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return events.filter(
    (event) => Date.parse(event.start) < end.getTime() && Date.parse(event.end) > start.getTime(),
  );
}
export const responseLabels: Record<CalendarEvent['response'], string> = {
  accepted: 'Confirmada',
  tentativelyAccepted: 'Tentativa',
  notResponded: 'Por responder',
  organizer: 'Organizas tú',
  none: 'Sin respuesta registrada',
};
