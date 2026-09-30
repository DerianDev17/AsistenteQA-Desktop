import type { CalendarEvent } from '../../domain/calendar';
import { dayPlan } from '../../domain/day-plan';
import type { Snapshot } from '../../application/workspace';
import type { Actions } from '../pages/Dashboard';
import { Badge, Empty, Panel } from './ui';
import { Icon } from './Icon';

const time = (at: string) =>
  new Date(at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
export function DayTimeline({
  data,
  events,
  now,
  actions,
  onJoin,
  calendarLoading,
}: {
  data: Snapshot;
  events: CalendarEvent[];
  now: Date;
  actions: Actions;
  onJoin: (id: string) => void;
  calendarLoading: boolean;
}) {
  const activities = dayPlan(data.tasks, events, data.today);
  return (
    <Panel
      title="Mi día · Actividades de hoy"
      icon="day"
      className="day-timeline"
      action={
        <button className="text-button accent" onClick={() => actions.navigate('Mi Día')}>
          Ver mi día
        </button>
      }
    >
      {calendarLoading && (
        <p className="loading" role="status">
          Cargando reuniones del día…
        </p>
      )}
      {!activities.length && !calendarLoading && (
        <Empty title="Tu día está despejado" icon="day">
          Añade una tarea o conecta tu agenda para empezar.
        </Empty>
      )}
      <div className="timeline-list">
        {activities.slice(0, 7).map((entry) => {
          if (entry.kind === 'meeting') {
            const event = entry.meeting;
            const ended = Date.parse(event.end) <= now.getTime();
            const ongoing = Date.parse(event.start) <= now.getTime() && !ended;
            return (
              <article
                className={`timeline-row meeting ${ended ? 'ended' : ''}`}
                key={`meeting-${event.id}`}
              >
                <span className="timeline-dot" />
                <span className="timeline-time">
                  {event.allDay ? 'Todo el día' : `${time(event.start)} – ${time(event.end)}`}
                </span>
                <div className="timeline-content">
                  <button
                    className="timeline-title"
                    onClick={() => {
                      if (ended) actions.navigate('Calendario');
                      else if (actions.prepareMeeting) actions.prepareMeeting(event);
                      else actions.navigate('Reuniones');
                    }}
                  >
                    {event.subject}
                  </button>
                  <p>{event.location || event.organizer || 'Calendario de Microsoft 365'}</p>
                  <span className={`badge ${ongoing ? 'badge-in_progress' : ''}`}>
                    {ended ? 'Finalizada' : ongoing ? 'En curso' : 'Reunión'}
                  </span>
                </div>
                {event.teamsUrl && !ended && (
                  <button
                    className="icon-button"
                    aria-label={`Abrir Teams: ${event.subject}`}
                    onClick={() => onJoin(event.id)}
                    disabled={actions.busy}
                  >
                    <Icon name="people" size={18} />
                  </button>
                )}
              </article>
            );
          }
          const task = entry.task;
          const project = data.projects.find((item) => item.id === task.projectId);
          return (
            <article
              className={`timeline-row ${entry.overdue ? 'overdue' : task.priority.toLowerCase()}`}
              key={`task-${task.id}`}
            >
              <span className="timeline-dot" />
              <span className="timeline-time">
                {entry.overdue ? 'Vencida' : entry.time || 'Sin hora'}
              </span>
              <div className="timeline-content">
                <button className="timeline-title" onClick={() => actions.editTask(task)}>
                  {task.title}
                </button>
                <p>{task.description || project?.name || 'Actividad personal'}</p>
                <Badge value={task.priority} />
                <Badge value={task.status} />
                {project && (
                  <button className="timeline-project" onClick={() => actions.openProject(project)}>
                    {project.code || project.name}
                  </button>
                )}
              </div>
              <button
                className="icon-button timeline-complete"
                aria-label={`Completar: ${task.title}`}
                disabled={actions.busy}
                onClick={() => actions.completeTask(task)}
              >
                <Icon name="check" size={19} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="panel-footer">
        <span>
          {activities.length} actividades · {data.overview.completedToday.length} tareas completadas
        </span>
        <button className="text-button accent" onClick={actions.newTask}>
          <Icon name="plus" size={14} /> Añadir actividad
        </button>
      </div>
    </Panel>
  );
}
