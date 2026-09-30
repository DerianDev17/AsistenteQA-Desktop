import type { MailMessage } from '../../domain/email';
import type { Task, TaskInput } from '../../domain/models';
import type { ProjectRepository, TaskRepository } from '../../domain/repositories';
import { AppError, id, taskInput, updateInput } from '../../domain/validation';
import { sanitizeMailText } from '../../domain/sanitize';
import { suggestMailActivity, type MailActivitySuggestion } from '../../domain/mail-activities';

export interface EmailTaskSource {
  recent(): Promise<{ reference: string; message: MailMessage }[]>;
  resolve(id: string): Promise<{ reference: string; message: MailMessage }>;
}
export interface EmailTaskDraft {
  input: TaskInput;
  existing: Task | null;
}
export class EmailTasks {
  constructor(
    private source: EmailTaskSource,
    private tasks: TaskRepository,
    private projects: ProjectRepository,
    private newId: () => string,
    private now: () => Date = () => new Date(),
  ) {}
  async draft(value: unknown): Promise<EmailTaskDraft> {
    const { message, reference } = await this.source.resolve(id(value));
    const suggestion = suggestMailActivity(message, await this.projects.list());
    return {
      input: {
        title: sanitizeMailText(`Revisar: ${message.subject}`).slice(0, 200),
        description: '',
        projectId: suggestion?.projectId ?? null,
        status: 'PENDING',
        priority: message.importance === 'high' ? 'HIGH' : 'MEDIUM',
        dueDate: null,
        dueTime: null,
        waitingFor: 'USER',
      },
      existing: await this.tasks.findEmail(reference),
    };
  }
  async suggestions(): Promise<MailActivitySuggestion[]> {
    const [recent, projects, tasks] = await Promise.all([
      this.source.recent(),
      this.projects.list(),
      this.tasks.list(),
    ]);
    const existing = new Set(
      tasks.filter((task) => task.source === 'EMAIL').map((task) => task.sourceReference),
    );
    return recent
      .filter((item) => !existing.has(item.reference))
      .map(({ message }) => suggestMailActivity(message, projects))
      .filter((item): item is MailActivitySuggestion => item !== null)
      .slice(0, 10);
  }
  async create(value: unknown) {
    const request = updateInput(value);
    const input = taskInput(request.data);
    const { reference } = await this.source.resolve(request.id);
    const existing = await this.tasks.findEmail(reference);
    if (existing) return { task: existing, created: false };
    if (input.projectId && !(await this.projects.get(input.projectId)))
      throw new AppError('NOT_FOUND', 'El proyecto ya no existe. Actualiza la vista.');
    const at = this.now().toISOString();
    return this.tasks.createEmail({
      ...input,
      title: sanitizeMailText(input.title),
      description: sanitizeMailText(input.description),
      id: this.newId(),
      source: 'EMAIL',
      sourceReference: reference,
      createdAt: at,
      updatedAt: at,
      completedAt: input.status === 'COMPLETED' ? at : null,
    });
  }
}
