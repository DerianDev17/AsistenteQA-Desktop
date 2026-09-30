import { useRef, useState } from 'react';
import type { Snapshot } from '../../application/workspace';
import { eventsOnDay, type CalendarEvent } from '../../domain/calendar';
import type { Project, Task, Settings } from '../../domain/models';
import type { MailMessage } from '../../domain/email';
import { Icon, type IconName } from '../components/Icon';
import { Empty, ErrorNotice, Panel, labels } from '../components/ui';
import { DashboardMailContent } from '../components/DashboardMail';
import { ActivitySuggestions } from '../components/ActivitySuggestions';
import { DayTimeline } from '../components/DayTimeline';
import { DashboardProjects } from '../components/DashboardProjects';
import { DashboardCalendar } from '../components/DashboardCalendar';
import { DashboardAutomation } from '../components/DashboardAutomation';
import { NextMeeting } from '../components/NextMeeting';
import { AttentionItems } from '../components/AttentionItems';
import { useMailSummary } from '../hooks/useMailSummary';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useClock } from '../hooks/useClock';
import { unwrap } from '../hooks/useWorkspace';

export interface Actions {
  openProject: (project: Project) => void;
  taskFromEmail: (message: MailMessage) => void;
  editProject: (project: Project) => void;
  deleteProject: (project: Project) => void;
  editTask: (task: Task) => void;
  deleteTask: (task: Task) => void;
  completeTask: (task: Task) => void;
  newProject: () => void;
  newTask: () => void;
  navigate: (page: string) => void;
  prepareMeeting?: (event: CalendarEvent) => void;
  busy: boolean;
}
const loadCalendar = () => unwrap(window.qa.calendar.snapshot());
export function Dashboard({
  data,
  actions,
  onSettings,
}: {
  data: Snapshot;
  actions: Actions;
  onSettings: (settings: Settings) => Promise<void>;
}) {
  const { overview: summary } = data;
  const calendar = useLiveQuery(loadCalendar);
  const mail = useMailSummary();
  const now = useClock();
  const [joining, setJoining] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [operationError, setOperationError] = useState('');
  const joiningRef = useRef(false);
  const events = calendar.data?.events ?? [];
  const agendaToday = calendar.data ? eventsOnDay(events, data.today) : null;
  const meetings = agendaToday?.filter((event) => !event.allDay) ?? null;
  const activities = summary.today.length + (agendaToday?.length ?? 0);
  const attention =
    new Set([...summary.overdue, ...summary.blocked, ...summary.followUps].map((task) => task.id))
      .size + summary.attentionProjects.length;
  const join = async (id: string) => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setJoining(true);
    setOperationError('');
    try {
      await unwrap(window.qa.calendar.openMeeting(id));
    } catch (reason) {
      setOperationError(reason instanceof Error ? reason.message : 'No se pudo abrir la reunión.');
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  };
  const metrics: {
    title: string;
    value: number | null;
    note: string;
    icon: IconName;
    color: string;
    page: string;
  }[] = [
    {
      title: 'Actividades de hoy',
      value: calendar.data ? activities : null,
      note: `${summary.today.length} tareas · ${agendaToday?.length ?? '…'} de agenda`,
      icon: 'day',
      color: 'blue',
      page: 'Mi Día',
    },
    {
      title: 'Requieren atención',
      value: attention,
      note: 'Bloqueos, vencidas y seguimientos',
      icon: 'alert',
      color: 'red',
      page: 'Mi Día',
    },
    {
      title: 'Proyectos activos',
      value: summary.activeProjects.length,
      note: 'Ver próximos pasos',
      icon: 'folder',
      color: 'teal',
      page: 'Proyectos',
    },
    {
      title: 'Reuniones hoy',
      value: meetings?.length ?? null,
      note: 'Agenda de Microsoft 365',
      icon: 'people',
      color: 'purple',
      page: 'Reuniones',
    },
    {
      title: 'Correos locales',
      value: mail.data?.inbox.total ?? null,
      note: 'Bandeja · últimos 30 días',
      icon: 'mail',
      color: 'blue',
      page: 'Correos',
    },
  ];
  const shortcuts: { label: string; icon: IconName; run: () => void }[] = [
    { label: 'Actividades de hoy', icon: 'day', run: () => actions.navigate('Mi Día') },
    { label: 'Resumen de proyectos', icon: 'folder', run: () => actions.navigate('Proyectos') },
    { label: 'Revisar correos', icon: 'mail', run: () => actions.navigate('Correos') },
    { label: 'Preparar reunión', icon: 'people', run: () => actions.navigate('Reuniones') },
  ];
  const priority = summary.overdue[0] ?? summary.blocked[0] ?? summary.today[0];
  return (
    <>
      <div className="metrics operations-metrics">
        {metrics.map((metric) => (
          <button
            className="metric"
            key={metric.title}
            onClick={() =>
              metric.title === 'Requieren atención'
                ? setShowAttention(true)
                : actions.navigate(metric.page)
            }
          >
            <span className={`metric-icon ${metric.color}`}>
              <Icon name={metric.icon} size={25} />
            </span>
            <div>
              <span>{metric.title}</span>
              <strong>{metric.value ?? '—'}</strong>
              <small>{metric.note}</small>
            </div>
          </button>
        ))}
      </div>
      {(calendar.error || calendar.data?.error || operationError) && (
        <ErrorNotice message={operationError || calendar.error || calendar.data?.error || ''} />
      )}
      {calendar.error && (
        <button
          className="text-button accent dashboard-retry"
          onClick={() => void calendar.refresh()}
        >
          Reintentar agenda
        </button>
      )}
      <div className="dashboard-grid operations-grid">
        <div className="dashboard-main">
          <DayTimeline
            data={data}
            events={events}
            now={now}
            actions={{ ...actions, busy: actions.busy || joining }}
            onJoin={(id) => void join(id)}
            calendarLoading={!calendar.data && !calendar.error}
          />
          <DashboardProjects projects={summary.activeProjects} actions={actions} />
          <Panel
            title="Seguimientos pendientes"
            icon="clock"
            action={
              <button className="text-button accent" onClick={() => actions.navigate('Tareas')}>
                Ver tareas
              </button>
            }
          >
            {summary.followUps.length ? (
              <div className="follow-ups">
                {summary.followUps.slice(0, 4).map((task) => (
                  <button key={task.id} onClick={() => actions.editTask(task)}>
                    <span>{task.title}</span>
                    <small>Esperando a {labels[task.waitingFor]}</small>
                  </button>
                ))}
              </div>
            ) : (
              <Empty title="Sin seguimientos pendientes" icon="clock">
                Se detectan tareas que esperan a terceros más de {data.settings.followUpDays} días.
              </Empty>
            )}
          </Panel>
        </div>
        <div className="dashboard-middle">
          <DashboardMailContent
            summary={mail}
            compact
            onOpenInbox={() => actions.navigate('Correos')}
            onCreateTask={actions.taskFromEmail}
          />
          <DashboardCalendar
            calendar={calendar.data}
            unavailable={!!calendar.error}
            day={data.today}
            onCalendar={() => actions.navigate('Calendario')}
          />
          <ActivitySuggestions compact onReview={actions.taskFromEmail} busy={actions.busy} />
        </div>
        <aside className="dashboard-side">
          <Panel title="Asistente local" icon="robot" className="assistant">
            <div className="assistant-greeting">
              Hola, Derian.
              <br />
              <strong>Tu siguiente paso, a la vista.</strong>
            </div>
            <ul className="summary-list">
              <li>
                <span className="dot blue" />
                {activities} actividades en tu día
              </li>
              <li>
                <span className="dot red" />
                {summary.overdue.length} tareas vencidas
              </li>
              <li>
                <span className="dot purple" />
                {meetings?.length ?? '…'} reuniones hoy
              </li>
              <li>
                <span className="dot teal" />
                {summary.completedToday.length} tareas completadas hoy
              </li>
            </ul>
            {priority && (
              <button className="next-action" onClick={() => actions.editTask(priority)}>
                <small>
                  {summary.overdue.some((task) => task.id === priority.id)
                    ? 'ATENDER PRIMERO'
                    : 'SIGUIENTE ACTIVIDAD'}
                </small>
                <strong>{priority.title}</strong>
                <span>
                  Revisar tarea <Icon name="arrow" size={13} />
                </span>
              </button>
            )}
            {shortcuts.map((shortcut) => (
              <button key={shortcut.label} className="assistant-action" onClick={shortcut.run}>
                <Icon name={shortcut.icon} />
                {shortcut.label}
                <Icon name="arrow" size={14} />
              </button>
            ))}
            <p className="assistant-local-note">
              Resumen y reglas locales. Actualizados con tus datos.
            </p>
          </Panel>
          <NextMeeting
            state={calendar.data ? 'ready' : calendar.error ? 'unavailable' : 'loading'}
            events={events}
            now={now}
            onPrepare={(event) =>
              event && actions.prepareMeeting
                ? actions.prepareMeeting(event)
                : actions.navigate('Reuniones')
            }
            onJoin={(id) => void join(id)}
            busy={joining}
          />
          <DashboardAutomation
            settings={data.settings}
            mail={mail}
            calendar={calendar.data}
            onSettings={onSettings}
            onRefresh={() => Promise.all([calendar.refresh(), mail.refresh()])}
            onMail={() => actions.navigate('Correos')}
          />
        </aside>
      </div>
      <div className="connection-strip">
        <Icon name="shield" size={18} />
        <span>Tu trabajo se guarda en este equipo.</span>
        <span className="muted">Correo y agenda se actualizan con Microsoft 365.</span>
      </div>
      {showAttention && (
        <AttentionItems data={data} actions={actions} onClose={() => setShowAttention(false)} />
      )}
    </>
  );
}
