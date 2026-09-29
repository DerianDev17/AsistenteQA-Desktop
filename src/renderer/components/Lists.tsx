import { isOpen, type Project, type Task } from '../../domain/models';
import { isOverdue, needsNextAction } from '../../domain/overview';
import { Badge, Empty, labels, relativeDate } from './ui';
import { Icon } from './Icon';

export function ProjectList({
  projects,
  onEdit,
  onDelete,
  onOpen,
}: {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onOpen?: (project: Project) => void;
}) {
  if (!projects.length)
    return (
      <Empty title="Un espacio para tus proyectos">
        Crea tu primer proyecto y registra su próxima acción.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Proyecto / Requerimiento</th>
            <th>Estado</th>
            <th>Avance</th>
            <th>Próxima acción</th>
            <th>Esperando a</th>
            <th>Actividad</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <button
                  className="text-button project-name"
                  onClick={() => (onOpen ?? onEdit)(project)}
                >
                  {project.name}
                </button>
                <span className="subtext">{project.code || project.type}</span>
              </td>
              <td>
                <Badge value={project.status} />
              </td>
              <td>
                <div className="progress-cell">
                  <span>{project.progress}%</span>
                  <progress
                    max={100}
                    value={project.progress}
                    aria-label={`Avance de ${project.name}`}
                  />
                </div>
              </td>
              <td className="next-action">
                {project.nextAction || (
                  <span className={needsNextAction(project) ? 'warning-text' : 'muted'}>
                    {needsNextAction(project) ? 'Falta próxima acción' : 'Sin próxima acción'}
                  </span>
                )}
              </td>
              <td>{labels[project.waitingFor]}</td>
              <td className="muted nowrap">{relativeDate(project.lastActivityAt)}</td>
              <td>
                {onOpen && (
                  <button
                    className="icon-button"
                    aria-label={`Editar ${project.name}`}
                    onClick={() => onEdit(project)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                )}
                <button
                  className="icon-button"
                  title="Eliminar proyecto"
                  aria-label={`Eliminar ${project.name}`}
                  onClick={() => onDelete(project)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TaskList({
  tasks,
  projects,
  today,
  onEdit,
  onComplete,
  onDelete,
  busy,
}: {
  tasks: Task[];
  projects: Project[];
  today: string;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
  busy: boolean;
}) {
  if (!tasks.length)
    return (
      <Empty title="Todo despejado por aquí" icon="check">
        Las actividades que registres aparecerán en esta vista.
      </Empty>
    );
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article
          className={`task-row ${task.status === 'COMPLETED' ? 'completed' : ''}`}
          key={task.id}
        >
          <button
            className={`complete-button ${task.status === 'COMPLETED' ? 'checked' : ''}`}
            aria-label={`Completar ${task.title}`}
            disabled={!isOpen(task) || busy}
            onClick={() => onComplete(task)}
          >
            {task.status === 'COMPLETED' && <span>✓</span>}
          </button>
          <div className="task-time">
            <strong>{task.dueTime ?? 'Sin hora'}</strong>
            <span className={isOverdue(task, today) ? 'danger-text' : ''}>
              {isOverdue(task, today)
                ? 'Vencida'
                : task.dueDate === today
                  ? 'Hoy'
                  : (task.dueDate ?? 'Sin fecha')}
            </span>
          </div>
          <div className="task-content">
            <button className="text-button" onClick={() => onEdit(task)}>
              {task.title}
            </button>
            {task.description && <p>{task.description}</p>}
            <div className="task-meta">
              <span>
                {projects.find((project) => project.id === task.projectId)?.name ?? 'Sin proyecto'}
              </span>
              {task.waitingFor !== 'USER' && <span>Esperando a {labels[task.waitingFor]}</span>}
              {task.source === 'EMAIL' && (
                <span>
                  <Icon name="mail" size={12} /> Desde correo
                </span>
              )}
            </div>
          </div>
          <Badge value={task.priority} />
          <Badge value={task.status} />
          <button
            className="icon-button"
            aria-label={`Editar ${task.title}`}
            onClick={() => onEdit(task)}
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Eliminar ${task.title}`}
            onClick={() => onDelete(task)}
          >
            <Icon name="trash" size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}
