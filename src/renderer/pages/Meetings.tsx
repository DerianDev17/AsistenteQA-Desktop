import { useState } from 'react';
import { responseLabels } from '../../domain/calendar';
import { meetingInProgress, upcomingMeetings, type MeetingFilter } from '../../domain/meetings';
import type { Project, Task } from '../../domain/models';
import { Empty, ErrorNotice, Panel, relativeDate } from '../components/ui';
import { MeetingBrief } from '../components/MeetingBrief';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { unwrap } from '../hooks/useWorkspace';

const load = () => unwrap(window.qa.calendar.snapshot());

export function Meetings({
  projects,
  tasks,
  onCalendar,
  onProject,
  onTask,
}: {
  projects: Project[];
  tasks: Task[];
  onCalendar: () => void;
  onProject: (project: Project) => void;
  onTask: (task: Task) => void;
}) {
  const { data, error, refresh } = useLiveQuery(load);
  const [filter, setFilter] = useState<MeetingFilter>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [operationError, setOperationError] = useState('');
  const now = new Date();
  const meetings = upcomingMeetings(data?.events ?? [], now, filter, query);
  const selected = data?.events.find((event) => event.id === selectedId);
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
    <>
      <Panel
        title="Reuniones próximas"
        icon="people"
        action={
          <button className="text-button accent" onClick={onCalendar}>
            Ver calendario
          </button>
        }
      >
        {(error || operationError || data?.error) && (
          <ErrorNotice message={error || operationError || data?.error || ''} />
        )}
        {!data && !error && (
          <p className="loading" role="status">
            Cargando reuniones…
          </p>
        )}
        {error && (
          <button className="secondary meeting-retry" onClick={() => void refresh()}>
            Reintentar reuniones
          </button>
        )}
        {data && (!data.enabled || !data.connected) && (
          <Empty title="Autoriza el calendario para consultar reuniones" icon="calendar">
            <button className="text-button accent" onClick={onCalendar}>
              Abrir configuración del calendario
            </button>
          </Empty>
        )}
        {data?.connected && data.enabled && (
          <>
            <div className="meeting-toolbar">
              <p className="muted">
                {data.lastSyncedAt
                  ? `Agenda descargada: ${relativeDate(data.lastSyncedAt)}`
                  : 'Todavía no hay una agenda descargada.'}
              </p>
              <button
                className="secondary small"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    unwrap(
                      data.needsReconnect
                        ? window.qa.calendar.connect()
                        : window.qa.calendar.sync(),
                    ),
                  )
                }
              >
                {data.needsReconnect ? 'Volver a autorizar reuniones' : 'Sincronizar reuniones'}
              </button>
              {busy && (
                <button
                  className="text-button"
                  onClick={() =>
                    void unwrap(window.qa.calendar.cancel()).catch(() =>
                      setOperationError('No se pudo cancelar la operación.'),
                    )
                  }
                >
                  Cancelar operación
                </button>
              )}
            </div>
            <div className="meeting-toolbar">
              <div className="segmented" role="group" aria-label="Filtrar reuniones">
                {(
                  [
                    ['all', 'Todas'],
                    ['teams', 'Teams'],
                    ['unanswered', 'Por responder'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => {
                      setFilter(value);
                      setLimit(50);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                Buscar reuniones{' '}
                <input
                  type="search"
                  placeholder="Título, organizador o lugar"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(50);
                  }}
                />
              </label>
            </div>
            <p className="meeting-note">
              Citas y reuniones con horario, en curso o próximas, dentro del período descargado. Las
              de todo el día aparecen en Calendario. Horario de este equipo:{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            </p>
            {!meetings.length ? (
              <Empty title="Sin reuniones próximas en esta vista" icon="people">
                Puedes cambiar los filtros o actualizar la agenda. Sin conexión se conserva la
                última copia descargada.
              </Empty>
            ) : (
              <div className="meeting-list">
                {meetings.slice(0, limit).map((event) => (
                  <article key={event.id}>
                    <div className="meeting-copy">
                      <strong>{event.subject}</strong>
                      <p>
                        {relativeDate(event.start)} → {relativeDate(event.end)}
                      </p>
                      <span className="badge">{responseLabels[event.response]}</span>
                      {meetingInProgress(event, now) && <span className="badge">En curso</span>}
                      {event.organizer && <small>Organiza: {event.organizer}</small>}
                      {event.location && <p>{event.location}</p>}
                    </div>
                    <div className="meeting-actions">
                      <button
                        className="secondary small"
                        onClick={() => setSelectedId(event.id)}
                        aria-label={`Preparar reunión: ${event.subject}`}
                      >
                        Preparar reunión
                      </button>
                      {event.teamsUrl && (
                        <button
                          className="primary small"
                          disabled={busy}
                          onClick={() =>
                            void run(() => unwrap(window.qa.calendar.openMeeting(event.id)))
                          }
                          aria-label={`Abrir Teams: ${event.subject}`}
                        >
                          Abrir Teams
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="panel-footer">
              <span>
                {meetings.length} {meetings.length === 1 ? 'reunión' : 'reuniones'} en esta vista ·
                Las invitaciones se responden en Outlook.
              </span>
              {meetings.length > limit && (
                <button className="text-button accent" onClick={() => setLimit(limit + 50)}>
                  Mostrar más reuniones
                </button>
              )}
            </div>
          </>
        )}
      </Panel>
      {selected && (
        <MeetingBrief
          key={selected.id}
          event={selected}
          projects={projects}
          tasks={tasks}
          onClose={() => setSelectedId(null)}
          onProject={onProject}
          onTask={onTask}
        />
      )}
    </>
  );
}
