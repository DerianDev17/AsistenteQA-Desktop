import type { CalendarSnapshot } from '../../domain/calendar';
import { eventsOnDay } from '../../domain/calendar';
import { Empty, Panel } from './ui';

export function DashboardCalendar({
  calendar,
  day,
  onCalendar,
  unavailable = false,
}: {
  calendar: CalendarSnapshot | null;
  day: string;
  onCalendar: () => void;
  unavailable?: boolean;
}) {
  const events = calendar ? eventsOnDay(calendar.events, day) : [];
  return (
    <Panel
      title="Calendario de hoy"
      icon="calendar"
      action={
        <button className="text-button accent" onClick={onCalendar}>
          Ver calendario
        </button>
      }
    >
      {!calendar && unavailable ? (
        <Empty title="Agenda no disponible" icon="calendar">
          <button className="text-button accent" onClick={onCalendar}>
            Consultar calendario
          </button>
        </Empty>
      ) : !calendar ? (
        <p className="loading">Cargando agenda…</p>
      ) : !calendar.enabled ? (
        <Empty title="Conecta tu agenda" icon="calendar">
          <button className="text-button accent" onClick={onCalendar}>
            Autorizar calendario
          </button>
        </Empty>
      ) : !events.length ? (
        <Empty title="Sin reuniones para hoy" icon="calendar">
          Tu agenda se actualiza desde Microsoft 365.
        </Empty>
      ) : (
        <div className="calendar-overview">
          {events.slice(0, 3).map((event) => (
            <button key={event.id} onClick={onCalendar}>
              <span className="dot purple" />
              <span>
                <strong>{event.subject}</strong>
                <small>
                  {event.allDay
                    ? 'Todo el día'
                    : `${new Date(event.start).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · ${event.location || 'Reunión'}`}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
