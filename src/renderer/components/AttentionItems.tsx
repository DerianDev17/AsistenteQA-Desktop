import type { Snapshot } from '../../application/workspace';
import type { Actions } from '../pages/Dashboard';
import { Badge, Empty, Modal } from './ui';

export function AttentionItems({
  data,
  actions,
  onClose,
}: {
  data: Snapshot;
  actions: Actions;
  onClose: () => void;
}) {
  const summary = data.overview;
  const tasks = [
    ...new Map(
      [...summary.overdue, ...summary.blocked, ...summary.followUps].map((task) => [task.id, task]),
    ).values(),
  ];
  return (
    <Modal title="Pendientes que requieren atención" onClose={onClose}>
      {!tasks.length && !summary.attentionProjects.length && (
        <Empty title="Todo al día" icon="check">
          No hay tareas vencidas, bloqueos ni seguimientos pendientes.
        </Empty>
      )}
      <div className="attention-items">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => {
              onClose();
              actions.editTask(task);
            }}
          >
            <span>
              <strong>{task.title}</strong>
              <small>
                {summary.overdue.some((item) => item.id === task.id)
                  ? 'Tarea vencida'
                  : summary.followUps.some((item) => item.id === task.id)
                    ? 'Seguimiento pendiente'
                    : 'Tarea bloqueada'}
              </small>
            </span>
            <Badge value={task.status} />
          </button>
        ))}
        {summary.attentionProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => {
              onClose();
              actions.openProject(project);
            }}
          >
            <span>
              <strong>{project.name}</strong>
              <small>
                {project.status === 'BLOCKED'
                  ? 'Proyecto bloqueado'
                  : 'Falta definir la próxima acción'}
              </small>
            </span>
            <Badge value={project.status} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
