import type { MailMessage } from '../../domain/email';
import type { Task, TaskInput } from '../../domain/models';
import type { ProjectRepository, TaskRepository } from '../../domain/repositories';
import { AppError, id, taskInput, updateInput } from '../../domain/validation';
import { sanitizeMailText } from '../../domain/sanitize';

export interface EmailTaskSource {
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
    return {
      input: {
        title: sanitizeMailText(`Revisar: ${message.subject}`).slice(0, 200),
        description: '',
        projectId: null,
        status: 'PENDING',
        priority: message.importance === 'high' ? 'HIGH' : 'MEDIUM',
        dueDate: null,
        dueTime: null,
        waitingFor: 'USER',
      },
      existing: await this.tasks.findEmail(reference),
    };
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
