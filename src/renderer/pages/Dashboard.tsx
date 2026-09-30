import type { Snapshot } from '../../application/workspace';
import { Icon, type IconName } from '../components/Icon';
import { Empty, Panel, labels } from '../components/ui';
import { ProjectList, TaskList } from '../components/Lists';
import type { Project, Task } from '../../domain/models';
import { DashboardMail } from '../components/DashboardMail';
import type { MailMessage } from '../../domain/email';
import { Agenda } from '../components/Agenda';
import { ActivitySuggestions } from '../components/ActivitySuggestions';

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
  busy: boolean;
}
export function Dashboard({ data, actions }: { data: Snapshot; actions: Actions }) {
  const { overview: summary } = data;
  const attention =
    new Set([...summary.overdue, ...summary.blocked].map((task) => task.id)).size +
    summary.attentionProjects.length;
  const metrics: { title: string; value: number; note: string; icon: IconName; color: string }[] = [
    {
      title: 'Actividades de hoy',
      value: summary.today.length,
      note: 'Tu agenda y pendientes',
      icon: 'day',
      color: 'blue',
    },
    {
      title: 'Requieren atención',
      value: attention,
      note: 'Bloqueos y próximos pasos',
      icon: 'alert',
      color: 'red',
    },
    {
      title: 'Proyectos activos',
      value: summary.activeProjects.length,
      note: 'En tu espacio de trabajo',
      icon: 'folder',
      color: 'teal',
    },
    {
      title: 'Completadas hoy',
      value: summary.completedToday.length,
      note: 'Cada avance cuenta',
      icon: 'check',
      color: 'purple',
    },
  ];
  return (
    <>
      <div className="metrics">
        {metrics.map((metric) => (
          <div className="metric" key={metric.title}>
            <span className={`metric-icon ${metric.color}`}>
              <Icon name={metric.icon} size={25} />
            </span>
            <div>
              <span>{metric.title}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <Agenda
            day={data.today}
            compact
            onMail={() => actions.navigate('Correos')}
            onCalendar={() => actions.navigate('Calendario')}
          />
          <ActivitySuggestions onReview={actions.taskFromEmail} busy={actions.busy} />
          <DashboardMail
            onOpenInbox={() => actions.navigate('Correos')}
            onCreateTask={actions.taskFromEmail}
          />
          <Panel
            title="Mi día · Actividades de hoy"
            icon="day"
            action={
              <button className="text-button accent" onClick={() => actions.navigate('Mi Día')}>
                Ver mi día <Icon name="arrow" size={14} />
              </button>
            }
          >
            <TaskList
              tasks={summary.today.slice(0, 5)}
              projects={data.projects}
              today={data.today}
              onEdit={actions.editTask}
              onDelete={actions.deleteTask}
              onComplete={actions.completeTask}
              busy={actions.busy}
            />
            <div className="panel-footer">
              <span>
                {summary.today.length} actividades · {summary.overdue.length} vencidas
              </span>
              <button className="text-button accent" onClick={actions.newTask}>
                <Icon name="plus" size={16} />
                Añadir actividad
              </button>
            </div>
          </Panel>
          <Panel
            title="Proyectos / Requerimientos"
            icon="folder"
            action={
              <button className="small primary" onClick={actions.newProject}>
                <Icon name="plus" size={15} />
                Nuevo
              </button>
            }
          >
            <ProjectList
              projects={summary.activeProjects.slice(0, 5)}
              onOpen={actions.openProject}
              onEdit={actions.editProject}
              onDelete={actions.deleteProject}
            />
            <div className="panel-footer">
              <span>Estado real de tus proyectos</span>
              <button className="text-button accent" onClick={() => actions.navigate('Proyectos')}>
                Ver todos <Icon name="arrow" size={14} />
              </button>
            </div>
          </Panel>
        </div>
        <aside className="dashboard-side">
          <Panel title="Tu resumen local" icon="robot" className="assistant">
            <div className="assistant-greeting">
              Hola, Derian.
              <br />
              <strong>Todo tu trabajo, en contexto.</strong>
            </div>
            <p className="assistant-copy">Esta es tu jornada según los datos que has registrado.</p>
            <ul className="summary-list">
              <li>
                <span className="dot blue" />
                {summary.today.length} actividades para atender
              </li>
              <li>
                <span className="dot red" />
                {summary.overdue.length} tareas vencidas
              </li>
              <li>
                <span className="dot teal" />
                {summary.activeProjects.length} proyectos abiertos
              </li>
              <li>
                <span className="dot purple" />
                {summary.completedToday.length} tareas completadas hoy
              </li>
            </ul>
            <button className="assistant-action" onClick={() => actions.navigate('Mi Día')}>
              <Icon name="day" />
              Organizar mi día
              <Icon name="arrow" size={16} />
            </button>
            <button className="assistant-action" onClick={() => actions.navigate('Proyectos')}>
              <Icon name="folder" />
              Revisar proyectos
              <Icon name="arrow" size={16} />
            </button>
            <div className="integration-note">
              <span className="tiny-label">PRÓXIMAMENTE</span>
              <p>
                El asistente con IA llegará en una próxima fase. Este resumen se calcula localmente.
              </p>
            </div>
          </Panel>
          <Panel title="Seguimientos pendientes" icon="clock">
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
                Te avisaremos de tareas que esperen a terceros más de {data.settings.followUpDays}{' '}
                días.
              </Empty>
            )}
          </Panel>
        </aside>
      </div>
      <div className="connection-strip">
        <Icon name="shield" size={18} />
        <span>Tu trabajo se guarda en este equipo.</span>
        <span className="muted">
          Correo y agenda institucional en un solo lugar. La asistencia con IA llegará en una
          próxima fase.
        </span>
      </div>
    </>
  );
}
