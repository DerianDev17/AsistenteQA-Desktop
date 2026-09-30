import type { CalendarEvent } from '../../domain/calendar';
import { upcomingMeetings, meetingInProgress } from '../../domain/meetings';
import { Icon } from './Icon';
import { Empty, Panel, relativeDate } from './ui';

export function NextMeeting({
  events,
  now,
  onPrepare,
  onJoin,
  busy,
  state = 'ready',
}: {
  events: CalendarEvent[];
  now: Date;
  onPrepare: (event?: CalendarEvent) => void;
  onJoin: (id: string) => void;
  busy: boolean;
  state?: 'ready' | 'loading' | 'unavailable';
}) {
  const event = upcomingMeetings(events, now)[0];
  const minutes = event ? Math.ceil((Date.parse(event.start) - now.getTime()) / 60000) : 0;
  const label = !event
    ? ''
    : meetingInProgress(event, now)
      ? 'En curso'
      : minutes < 60
        ? `En ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
        : relativeDate(event.start);
  return (
    <Panel
      title="Próxima reunión"
      icon="clock"
      className={`next-meeting ${event && minutes <= 10 ? 'soon' : ''}`}
    >
      {state === 'loading' ? (
        <p className="loading">Consultando próxima reunión…</p>
      ) : state === 'unavailable' ? (
        <Empty title="Agenda no disponible" icon="calendar">
          <button className="text-button accent" onClick={() => onPrepare()}>
            Consultar reuniones
          </button>
        </Empty>
      ) : event ? (
        <div className="next-meeting-content">
          <strong className="meeting-countdown" role="timer">
            {label}
          </strong>
          <h3>{event.subject}</h3>
          <p>{event.location || event.organizer || 'Calendario institucional'}</p>
          <div className="next-meeting-actions">
            <button className="secondary small" onClick={() => onPrepare(event)}>
              Preparar reunión
            </button>
            {event.teamsUrl && (
              <button className="primary small" onClick={() => onJoin(event.id)} disabled={busy}>
                <Icon name="people" size={15} /> Abrir Teams
              </button>
            )}
          </div>
        </div>
      ) : (
        <Empty title="Sin reuniones próximas" icon="calendar">
          <button className="text-button accent" onClick={() => onPrepare()}>
            Consultar reuniones
          </button>
        </Empty>
      )}
    </Panel>
  );
}
