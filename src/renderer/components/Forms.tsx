import { useState, type FormEvent } from 'react';
import {
  owners,
  priorities,
  projectStatuses,
  taskStatuses,
  type Project,
  type ProjectInput,
  type Task,
  type TaskInput,
} from '../../domain/models';
import { projectInput, taskInput } from '../../domain/validation';
import { ErrorNotice, labels, Modal } from './ui';

function Options({ values }: { values: readonly string[] }) {
  return values.map((value) => (
    <option key={value} value={value}>
      {labels[value] ?? value}
    </option>
  ));
}
function useSave(onSave: () => Promise<void>) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}
export function ProjectForm({
  project,
  onSave,
  onClose,
}: {
  project?: Project;
  onSave: (input: ProjectInput) => Promise<void>;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProjectInput>(
    project
      ? {
          name: project.name,
          code: project.code,
          description: project.description,
          type: project.type,
          status: project.status,
          priority: project.priority,
          progress: project.progress,
          nextAction: project.nextAction,
          waitingFor: project.waitingFor,
        }
      : {
          name: '',
          code: '',
          description: '',
          type: 'Requerimiento',
          status: 'NEW',
          priority: 'MEDIUM',
          progress: 0,
          nextAction: '',
          waitingFor: 'USER',
        },
  );
  const change = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setData((previous) => ({ ...previous, [key]: value }));
  const { error, busy, submit } = useSave(() => onSave(projectInput(data)));
  return (
    <Modal title={project ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-grid">
          <label className="wide">
            Nombre del proyecto
            <input
              autoFocus
              required
              maxLength={160}
              value={data.name}
              onChange={(e) => change('name', e.target.value)}
              placeholder="Ej. Certificación de nuevo servicio"
            />
          </label>
          <label>
            Código
            <input
              maxLength={40}
              value={data.code}
              onChange={(e) => change('code', e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Tipo
            <select value={data.type} onChange={(e) => change('type', e.target.value)}>
              <Options
                values={['Requerimiento', 'Proyecto', 'Certificación', 'Incidente', 'Mejora']}
              />
            </select>
          </label>
          <label>
            Estado
            <select
              value={data.status}
              onChange={(e) => change('status', e.target.value as ProjectInput['status'])}
            >
              <Options values={projectStatuses} />
            </select>
          </label>
          <label>
            Prioridad
            <select
              value={data.priority}
              onChange={(e) => change('priority', e.target.value as ProjectInput['priority'])}
            >
              <Options values={priorities} />
            </select>
          </label>
          <label>
            Avance (%)
            <input
              type="number"
              min={0}
              max={100}
              required
              value={data.progress}
              onChange={(e) => change('progress', Number(e.target.value))}
            />
          </label>
          <label>
            Esperando a
            <select
              value={data.waitingFor}
              onChange={(e) => change('waitingFor', e.target.value as ProjectInput['waitingFor'])}
            >
              <Options values={owners} />
            </select>
          </label>
          <label className="wide">
            Próxima acción
            <input
              maxLength={500}
              value={data.nextAction}
              onChange={(e) => change('nextAction', e.target.value)}
              placeholder="¿Cuál es el siguiente paso?"
            />
          </label>
          <label className="wide">
            Descripción
            <textarea
              maxLength={4000}
              rows={3}
              value={data.description}
              onChange={(e) => change('description', e.target.value)}
            />
          </label>
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <div className="form-footer">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function TaskForm({
  task,
  initial,
  context,
  projects,
  today,
  onSave,
  onClose,
}: {
  task?: Task;
  initial?: TaskInput;
  context?: string;
  projects: Project[];
  today: string;
  onSave: (input: TaskInput) => Promise<void>;
  onClose: () => void;
}) {
  const [data, setData] = useState<TaskInput>(
    task
      ? {
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          waitingFor: task.waitingFor,
        }
      : (initial ?? {
          title: '',
          description: '',
          projectId: null,
          status: 'PENDING',
          priority: 'MEDIUM',
          dueDate: today,
          dueTime: null,
          waitingFor: 'USER',
        }),
  );
  const change = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setData((previous) => ({ ...previous, [key]: value }));
  const { error, busy, submit } = useSave(() => onSave(taskInput(data)));
  return (
    <Modal
      title={task ? 'Editar tarea' : context ? 'Crear tarea desde correo' : 'Nueva tarea'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        {context && <p className="mail-task-context">{context}</p>}
        {task?.source === 'EMAIL' && (
          <p className="mail-task-context">
            Origen: correo institucional. La tarea se conserva aunque el correo deje de estar
            disponible.
          </p>
        )}
        <fieldset disabled={busy} className="form-grid">
          <label className="wide">
            Título de la tarea
            <input
              autoFocus
              required
              maxLength={200}
              value={data.title}
              onChange={(e) => change('title', e.target.value)}
              placeholder="¿Qué necesitas hacer?"
            />
          </label>
          <label className="wide">
            Proyecto
            <select
              aria-label="Proyecto"
              value={data.projectId ?? ''}
              onChange={(e) => change('projectId', e.target.value || null)}
            >
              <option value="">Sin proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha límite
            <input
              type="date"
              value={data.dueDate ?? ''}
              onChange={(e) =>
                setData((previous) => ({
                  ...previous,
                  dueDate: e.target.value || null,
                  dueTime: e.target.value ? previous.dueTime : null,
                }))
              }
            />
          </label>
          <label>
            Hora
            <input
              type="time"
              disabled={!data.dueDate}
              value={data.dueTime ?? ''}
              onChange={(e) => change('dueTime', e.target.value || null)}
            />
          </label>
          <label>
            Estado
            <select
              value={data.status}
              onChange={(e) => change('status', e.target.value as TaskInput['status'])}
            >
              <Options values={taskStatuses} />
            </select>
          </label>
          <label>
            Prioridad
            <select
              value={data.priority}
              onChange={(e) => change('priority', e.target.value as TaskInput['priority'])}
            >
              <Options values={priorities} />
            </select>
          </label>
          <label className="wide">
            Esperando a
            <select
              value={data.waitingFor}
              onChange={(e) => change('waitingFor', e.target.value as TaskInput['waitingFor'])}
            >
              <Options values={owners} />
            </select>
          </label>
          <label className="wide">
            Descripción
            <textarea
              rows={3}
              maxLength={4000}
              value={data.description}
              onChange={(e) => change('description', e.target.value)}
            />
          </label>
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <div className="form-footer">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
