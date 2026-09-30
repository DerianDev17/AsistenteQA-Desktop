import { useState } from 'react';
import { eventsOnDay, responseLabels } from '../../domain/calendar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { unwrap } from '../hooks/useWorkspace';
import { Empty, ErrorNotice, Panel, relativeDate } from './ui';

const load = () => unwrap(window.qa.calendar.snapshot());
export function Agenda({
  day,
  compact = false,
  onMail,
  onCalendar,
}: {
  day?: string;
  compact?: boolean;
  onMail: () => void;
  onCalendar?: () => void;
}) {
  const { data, error, refresh } = useLiveQuery(load);
  const [working, setWorking] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [limit, setLimit] = useState(50);
  const events = data ? (day ? eventsOnDay(data.events, day) : data.events) : [];
  const busy = working || !!data?.busy;
  const run = async (operation: () => Promise<unknown>) => {
    if (working) return;
    setWorking(true);
    setOperationError('');
    try {
      await operation();
    } catch (reason) {
      setOperationError(
        reason instanceof Error ? reason.message : 'No se pudo completar la operación.',
      );
    } finally {
      setWorking(false);
      await refresh();
    }
  };
  return (
    <Panel
      title={compact ? 'Reuniones y agenda de hoy' : 'Agenda de Microsoft 365'}
      icon="calendar"
      action={
        onCalendar && (
          <button className="text-button accent" onClick={onCalendar}>
            Ver calendario
          </button>
        )
      }
    >
      {(error || operationError || data?.error) && (
        <ErrorNotice message={error || operationError || data?.error || ''} />
      )}
      {!data && !error && <p className="loading">Cargando agenda…</p>}
      {data && (
        <>
          <div className="agenda-status">
            <p>
              {data.lastSyncedAt
                ? `Última sincronización: ${relativeDate(data.lastSyncedAt)}`
                : 'Aún no se ha descargado el calendario.'}
            </p>
            {!data.connected ? (
              <button className="secondary small" onClick={onMail}>
                Conectar cuenta en Correos
              </button>
            ) : !data.enabled || data.needsReconnect ? (
              <>
                <p>
                  Agrega <strong>Microsoft Graph → Permisos delegados → Calendars.Read</strong> en
                  el registro de Microsoft Entra y autoriza el acceso de lectura. La app no acepta
                  ni rechaza invitaciones.
                </p>
                <button
                  className="primary small"
                  disabled={busy}
                  onClick={() => void run(() => unwrap(window.qa.calendar.connect()))}
                >
                  {busy ? 'Conectando…' : 'Autorizar calendario'}
                </button>
              </>
            ) : (
              <>
                <p>
                  {data.autoSync
                    ? 'Se actualiza cada 5 minutos mientras la app está abierta.'
                    : 'Actualización manual; puedes activar la sincronización automática en Correos.'}
                </p>
                <button
                  className="secondary small"
                  disabled={busy}
                  onClick={() => void run(() => unwrap(window.qa.calendar.sync()))}
                >
                  {busy ? 'Sincronizando…' : 'Sincronizar agenda'}
                </button>
              </>
            )}
            {busy && (
              <button
                className="text-button"
                onClick={() => {
                  void unwrap(window.qa.calendar.cancel()).catch(() =>
                    setOperationError('No se pudo cancelar la operación.'),
                  );
                }}
              >
                Cancelar operación
              </button>
            )}
          </div>
          {data.enabled && !events.length && (
            <Empty title="Sin reuniones en este período" icon="calendar">
              La agenda muestra eventos del calendario principal, sin invitaciones canceladas o
              rechazadas.
            </Empty>
          )}
          <div className="agenda-list">
            {events.slice(0, compact ? 5 : limit).map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{event.subject}</strong>
                  <p>
                    {event.allDay
                      ? `Todo el día · ${new Date(event.start).toLocaleDateString('es-EC')}`
                      : `${relativeDate(event.start)} → ${relativeDate(event.end)}`}
                  </p>
                  <span className="badge">{responseLabels[event.response]}</span>
                  {event.organizer && <small> Organiza: {event.organizer}</small>}
                  {event.location && <p>{event.location}</p>}
                </div>
                {event.teamsUrl && (
                  <button
                    className="secondary small"
                    disabled={working}
                    onClick={() => void run(() => unwrap(window.qa.calendar.openMeeting(event.id)))}
                  >
                    Abrir Teams
                  </button>
                )}
              </article>
            ))}
          </div>
          {data.enabled && (
            <div className="panel-footer">
              <span>
                {events.length} {events.length === 1 ? 'actividad' : 'actividades'} de agenda ·
                Horario de este equipo ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </span>
              {!compact && events.length > limit && (
                <button className="text-button accent" onClick={() => setLimit(limit + 50)}>
                  Mostrar más
                </button>
              )}
            </div>
          )}
          {!compact && data.start && data.end && (
            <p className="activity-intro">
              Copia local: {relativeDate(data.start)} → {relativeDate(data.end)}. Los cambios de
              horario y cancelaciones se reflejan tras sincronizar.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
