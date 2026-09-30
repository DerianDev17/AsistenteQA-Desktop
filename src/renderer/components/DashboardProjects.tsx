import type { Project } from '../../domain/models';
import type { Actions } from '../pages/Dashboard';
import { Badge, Empty, Panel } from './ui';
import { Icon } from './Icon';

export function DashboardProjects({
  projects,
  actions,
}: {
  projects: Project[];
  actions: Actions;
}) {
  return (
    <Panel
      title="Proyectos / Requerimientos"
      icon="folder"
      action={
        <button className="primary small" onClick={actions.newProject}>
          <Icon name="plus" size={14} /> Nuevo
        </button>
      }
    >
      {projects.length ? (
        <div className="project-overview">
          {projects.slice(0, 5).map((project) => (
            <button
              className="project-overview-row"
              key={project.id}
              onClick={() => actions.openProject(project)}
            >
              <span>
                <strong>{project.name}</strong>
                <small>{project.nextAction || 'Define la próxima acción'}</small>
              </span>
              <Badge value={project.status} />
              <span className="project-overview-progress">
                <span className="progress-bar">
                  <span style={{ width: `${project.progress}%` }} />
                </span>
                <small>{project.progress}%</small>
              </span>
              <Icon name="arrow" size={14} />
            </button>
          ))}
        </div>
      ) : (
        <Empty title="Un espacio para tus proyectos">
          <button className="text-button accent" onClick={actions.newProject}>
            Crear mi primer proyecto
          </button>
        </Empty>
      )}
      <div className="panel-footer">
        <span>{projects.length} proyectos activos</span>
        <button className="text-button accent" onClick={() => actions.navigate('Proyectos')}>
          Ver todos
        </button>
      </div>
    </Panel>
  );
}
