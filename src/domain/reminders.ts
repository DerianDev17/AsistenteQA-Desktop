import type { CalendarEvent } from './calendar';
import { localDate, type Overview } from './overview';

export interface Reminder {
  key: string;
  title: string;
  body: string;
}
export function reminders(summary: Overview, events: CalendarEvent[], now: Date): Reminder[] {
  const day = localDate(now);
  const result: Reminder[] = [];
  if (summary.overdue.length)
    result.push({
      key: `overdue:${day}`,
      title: 'QA Assistant · Tareas vencidas',
      body: `Tienes ${summary.overdue.length} tareas pendientes de días anteriores. Revisa Mi Día.`,
    });
  if (summary.followUps.length)
    result.push({
      key: `follow-ups:${day}`,
      title: 'QA Assistant · Seguimientos pendientes',
      body: `${summary.followUps.length} tareas esperan a terceros. Revisa sus próximos pasos.`,
    });
  for (const event of events) {
    const minutes = Math.ceil((Date.parse(event.start) - now.getTime()) / 60000);
    if (event.allDay || minutes < 1 || minutes > 10) continue;
    result.push({
      key: `meeting:${event.id}:${event.start}`,
      title: 'QA Assistant · Próxima reunión',
      body: `Tu próxima reunión empieza en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}. Abre Reuniones para prepararla.`,
    });
  }
  return result;
}
