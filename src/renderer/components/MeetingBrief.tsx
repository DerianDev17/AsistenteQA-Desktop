import { useState } from 'react';
import type { CalendarEvent } from '../../domain/calendar';
import { responseLabels } from '../../domain/calendar';
import { meetingTasks, suggestedMeetingProjects } from '../../domain/meetings';
import type { Project, Task } from '../../domain/models';
import { Badge, Empty, Modal, relativeDate } from './ui';
export function MeetingBrief({
  event,
  projects,
  tasks,
  onClose,
  onProject,
  onTask,
}: {
  event: CalendarEvent;
  projects: Project[];
  tasks: Task[];
  onClose: () => void;
  onProject: (project: Project) => void;
  onTask: (task: Task) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const project = projects.find((item) => item.id === projectId);
  const suggestions = suggestedMeetingProjects(event, projects);
  const pending = project ? meetingTasks(project.id, tasks) : [];
  return (
    <Modal title="Preparar reunión" onClose={onClose}>
      <div className="meeting-brief">
        <h3>{event.subject}</h3>
        <p>
          {relativeDate(event.start)} → {relativeDate(event.end)}
        </p>
        <p className="muted">
          {responseLabels[event.response]}
          {event.organizer && ` · Organiza: ${event.organizer}`}
          {event.location && ` · ${event.location}`}
        </p>
        <label>
          Proyecto para consultar{' '}
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Elige un proyecto</option>
            {projects.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
                {suggestions.some((suggestion) => suggestion.id === item.id)
                  ? ' · Coincide con el título'
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Consulta el contexto local antes de entrar. Elegir un proyecto aquí no modifica la reunión
          ni guarda una vinculación.
        </p>
        {project ? (
          <>
            <div className="meeting-project-context">
              <Badge value={project.status} /> <span>{project.progress}% de avance</span>
              {project.description && <p>{project.description}</p>}
              <p>
                <strong>Próxima acción:</strong>{' '}
                {project.nextAction || 'Sin próxima acción registrada'}
              </p>
              <button
                className="text-button accent"
                onClick={() => {
                  onClose();
                  onProject(project);
                }}
              >
                Abrir ficha del proyecto
              </button>
            </div>
            <h3>Pendientes para revisar · {pending.length}</h3>
            {!pending.length ? (
              <Empty title="Sin tareas pendientes en este proyecto" icon="check" />
            ) : (
              <ul className="meeting-task-list">
                {pending.map((task) => (
                  <li key={task.id}>
                    <button
                      className="text-button"
                      onClick={() => {
                        onClose();
                        onTask(task);
                      }}
                    >
                      {task.title}
                    </button>
                    <Badge value={task.status} />
                    <Badge value={task.priority} />
                    {task.dueDate && (
                      <span className="muted">
                        {task.dueDate}
                        {task.dueTime && ` · ${task.dueTime}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Empty title="Elige el proyecto que revisarás" icon="folder">
            Se mostrarán su próxima acción y sus tareas pendientes.
          </Empty>
        )}
      </div>
    </Modal>
  );
}
