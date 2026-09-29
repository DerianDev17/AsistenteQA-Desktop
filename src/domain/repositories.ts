import type { Project, Task, Settings } from './models';

export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  save(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
}
export interface TaskRepository {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  save(task: Task): Promise<Task>;
  delete(id: string): Promise<void>;
  findEmail(reference: string): Promise<Task | null>;
  createEmail(task: Task): Promise<{ task: Task; created: boolean }>;
}
export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<Settings>;
}
