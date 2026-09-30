import type { CalendarCache, CalendarEvent } from '../../domain/calendar';
export interface CalendarRepository {
  get(accountId: string): Promise<CalendarCache>;
  save(accountId: string, cache: CalendarCache): Promise<void>;
  clear(): Promise<void>;
}
export interface CalendarProvider {
  events(token: string, start: string, end: string, signal: AbortSignal): Promise<CalendarEvent[]>;
}
