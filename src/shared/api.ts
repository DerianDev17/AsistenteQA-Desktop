import type { Snapshot } from '../application/workspace';
import type { Project, ProjectInput, Task, TaskInput, Settings } from '../domain/models';
import type { MailConfig, MailPage, MailStatus } from '../domain/email';
import type { EmailTaskDraft } from '../application/email/tasks';
import type { CalendarSnapshot } from '../domain/calendar';

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
export interface QaApi {
  snapshot(): Promise<Result<Snapshot>>;
  calendar: {
    snapshot(): Promise<Result<CalendarSnapshot>>;
    connect(): Promise<Result<void>>;
    sync(): Promise<Result<void>>;
    cancel(): Promise<Result<void>>;
    openMeeting(id: string): Promise<Result<void>>;
  };
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
  mail: {
    taskDraft(id: string): Promise<Result<EmailTaskDraft>>;
    createTask(id: string, data: TaskInput): Promise<Result<{ task: Task; created: boolean }>>;
    status(): Promise<Result<MailStatus>>;
    list(page: number): Promise<Result<MailPage>>;
    configure(config: MailConfig): Promise<Result<void>>;
    connect(): Promise<Result<void>>;
    sync(): Promise<Result<void>>;
    cancel(): Promise<Result<void>>;
    disconnect(): Promise<Result<void>>;
  };
}
export const channels = {
  snapshot: 'workspace:snapshot',
  calendarSnapshot: 'calendar:snapshot',
  calendarConnect: 'calendar:connect',
  calendarSync: 'calendar:sync',
  calendarCancel: 'calendar:cancel',
  calendarOpen: 'calendar:open',
  projectCreate: 'project:create',
  projectUpdate: 'project:update',
  projectDelete: 'project:delete',
  taskCreate: 'task:create',
  taskUpdate: 'task:update',
  taskComplete: 'task:complete',
  taskDelete: 'task:delete',
  settingsSave: 'settings:save',
  mailStatus: 'mail:status',
  mailTaskDraft: 'mail:task-draft',
  mailTaskCreate: 'mail:task-create',
  mailList: 'mail:list',
  mailConfigure: 'mail:configure',
  mailConnect: 'mail:connect',
  mailSync: 'mail:sync',
  mailCancel: 'mail:cancel',
  mailDisconnect: 'mail:disconnect',
} as const;
