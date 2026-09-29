import { useState } from 'react';
import type { Project, Task } from '../../domain/models';
import { isOpen } from '../../domain/models';
import { isOverdue } from '../../domain/overview';
import { Badge, Panel, labels, relativeDate } from '../components/ui';
import { TaskList } from '../components/Lists';
import type { Actions } from './Dashboard';

export function ProjectDetail({
  project,
  tasks,
  today,
  actions,
  onBack,
  onNewTask,
}: {
  project: Project;
  tasks: Task[];
  today: string;
  actions: Actions;
  onBack: () => void;
  onNewTask: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const linked = tasks.filter((task) => task.projectId === project.id);
  const visible = linked.filter(
    (task) =>
      filter === 'all' ||
      (filter === 'open'
        ? isOpen(task)
        : filter === 'email'
          ? task.source === 'EMAIL'
          : !isOpen(task)),
  );
  return (
    <div className="project-detail">
      <div className="filter-bar">
        <button className="secondary" onClick={onBack}>
          Volver a proyectos
        </button>
        <button className="primary" onClick={() => actions.editProject(project)}>
          Editar proyecto
        </button>
      </div>
      <Panel title={project.name} icon="folder">
        <div className="project-detail-summary">
          <div className="project-detail-badges">
            <Badge value={project.status} />
            <Badge value={project.priority} />
            <span>{project.code || project.type}</span>
          </div>
          <p className="project-description">{project.description || 'Sin descripción.'}</p>
          <dl className="project-facts">
            <div>
              <dt>Próxima acción</dt>
              <dd>{project.nextAction || 'Sin próxima acción definida'}</dd>
            </div>
            <div>
              <dt>Esperando a</dt>
              <dd>{labels[project.waitingFor]}</dd>
            </div>
            <div>
              <dt>Avance del proyecto</dt>
              <dd>{project.progress}%</dd>
            </div>
            <div>
              <dt>Última actividad</dt>
              <dd>{relativeDate(project.lastActivityAt)}</dd>
            </div>
          </dl>
          <p className="muted">
            {linked.filter(isOpen).length} tareas activas ·{' '}
            {linked.filter((task) => isOverdue(task, today)).length} vencidas ·{' '}
            {linked.filter((task) => task.status === 'COMPLETED').length} completadas ·{' '}
            {linked.filter((task) => task.source === 'EMAIL').length} desde correo
          </p>
        </div>
      </Panel>
      <Panel
        title={`Tareas del proyecto · ${visible.length}`}
        icon="check"
        action={
          <button className="primary small" onClick={onNewTask}>
            Añadir tarea al proyecto
          </button>
        }
      >
        <div className="filter-bar project-task-filters">
          <div className="segmented" role="group" aria-label="Filtrar tareas del proyecto">
            {[
              ['all', 'Todas'],
              ['open', 'Activas'],
              ['closed', 'Finalizadas'],
              ['email', 'Desde correo'],
            ].map(([value, label]) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <TaskList
          tasks={visible}
          projects={[project]}
          today={today}
          onEdit={actions.editTask}
          onComplete={actions.completeTask}
          onDelete={actions.deleteTask}
          busy={actions.busy}
        />
      </Panel>
      <Panel title="Actividad de las tareas" icon="clock">
        <div className="project-detail-summary">
          <p className="muted">
            Última actualización de cada tarea. Las tareas eliminadas no forman parte de esta vista.
          </p>
          {linked.length ? (
            <ul className="project-activity">
              {[...linked]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 10)
                .map((task) => (
                  <li key={task.id}>
                    <button className="text-button" onClick={() => actions.editTask(task)}>
                      {task.title}
                    </button>
                    <span>
                      {labels[task.status]} · {relativeDate(task.updatedAt)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p>No hay actividad de tareas todavía.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
