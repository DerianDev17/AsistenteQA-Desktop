import { isOpen, type Project, type Task } from '../domain/models';
import type { ProjectRepository, TaskRepository, SettingsRepository } from '../domain/repositories';
import {
  AppError,
  id,
  projectInput,
  taskInput,
  settingsInput,
  updateInput,
} from '../domain/validation';
import { localDate, overview } from '../domain/overview';

export class Workspace {
  constructor(
    private projects: ProjectRepository,
    private tasks: TaskRepository,
    private settings: SettingsRepository,
    private newId: () => string,
    private now: () => Date = () => new Date(),
  ) {}

  async snapshot() {
    const [projects, tasks, settings] = await Promise.all([
      this.projects.list(),
      this.tasks.list(),
      this.settings.get(),
    ]);
    const now = this.now();
    return {
      projects,
      tasks,
      settings,
      today: localDate(now),
      overview: overview(projects, tasks, localDate(now), settings.followUpDays, now),
    };
  }
  async createProject(value: unknown) {
    const input = projectInput(value);
    const at = this.now().toISOString();
    return this.projects.save({
      ...input,
      id: this.newId(),
      createdAt: at,
      updatedAt: at,
      lastActivityAt: at,
      closedAt: isOpen(input) ? null : at,
    });
  }
  async updateProject(value: unknown) {
    const request = updateInput(value);
    const input = projectInput(request.data);
    const previous = await this.requireProject(request.id);
    const at = this.now().toISOString();
    return this.projects.save({
      ...previous,
      ...input,
      updatedAt: at,
      lastActivityAt: at,
      closedAt: isOpen(input) ? null : (previous.closedAt ?? at),
    });
  }
  async deleteProject(value: unknown) {
    const key = id(value);
    await this.requireProject(key);
    // The database restricts deletion while tasks are linked, including completed tasks.
    await this.projects.delete(key);
  }
  async createTask(value: unknown) {
    const input = taskInput(value);
    if (input.projectId) await this.requireProject(input.projectId);
    const at = this.now().toISOString();
    return this.tasks.save({
      ...input,
      id: this.newId(),
      source: 'MANUAL',
      sourceReference: null,
      createdAt: at,
      updatedAt: at,
      completedAt: input.status === 'COMPLETED' ? at : null,
    });
  }
  async updateTask(value: unknown) {
    const request = updateInput(value);
    const input = taskInput(request.data);
    const previous = await this.requireTask(request.id);
    if (input.projectId) await this.requireProject(input.projectId);
    const at = this.now().toISOString();
    return this.tasks.save({
      ...previous,
      ...input,
      updatedAt: at,
      completedAt: input.status === 'COMPLETED' ? (previous.completedAt ?? at) : null,
    });
  }
  async completeTask(value: unknown) {
    const previous = await this.requireTask(id(value));
    if (previous.status === 'COMPLETED') return previous;
    if (previous.status === 'CANCELLED')
      throw new AppError('CONFLICT', 'Reactiva la tarea cancelada antes de completarla.');
    const at = this.now().toISOString();
    return this.tasks.save({ ...previous, status: 'COMPLETED', updatedAt: at, completedAt: at });
  }
  async deleteTask(value: unknown) {
    const key = id(value);
    await this.requireTask(key);
    await this.tasks.delete(key);
  }
  saveSettings(value: unknown) {
    return this.settings.save(settingsInput(value));
  }
  private async requireProject(key: string): Promise<Project> {
    const project = await this.projects.get(key);
    if (!project) throw new AppError('NOT_FOUND', 'El proyecto ya no existe. Actualiza la vista.');
    return project;
  }
  private async requireTask(key: string): Promise<Task> {
    const task = await this.tasks.get(key);
    if (!task) throw new AppError('NOT_FOUND', 'La tarea ya no existe. Actualiza la vista.');
    return task;
  }
}
export type Snapshot = Awaited<ReturnType<Workspace['snapshot']>>;
