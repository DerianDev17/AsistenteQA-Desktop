import type { Snapshot } from '../application/workspace';
import type { Project, ProjectInput, Task, TaskInput, Settings } from '../domain/models';

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
export interface QaApi {
  snapshot(): Promise<Result<Snapshot>>;
  projects: {
    create(data: ProjectInput): Promise<Result<Project>>;
    update(id: string, data: ProjectInput): Promise<Result<Project>>;
    delete(id: string): Promise<Result<void>>;
  };
  tasks: {
    create(data: TaskInput): Promise<Result<Task>>;
    update(id: string, data: TaskInput): Promise<Result<Task>>;
    complete(id: string): Promise<Result<Task>>;
    delete(id: string): Promise<Result<void>>;
  };
  settings: { save(data: Settings): Promise<Result<Settings>> };
}
export const channels = {
  snapshot: 'workspace:snapshot',
  projectCreate: 'project:create',
  projectUpdate: 'project:update',
  projectDelete: 'project:delete',
  taskCreate: 'task:create',
  taskUpdate: 'task:update',
  taskComplete: 'task:complete',
  taskDelete: 'task:delete',
  settingsSave: 'settings:save',
} as const;
