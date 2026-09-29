export const projectStatuses = [
  'NEW',
  'ANALYSIS',
  'PLANNED',
  'IN_PROGRESS',
  'IN_QA',
  'WAITING_THIRD_PARTY',
  'BLOCKED',
  'PENDING',
  'COMPLETED',
  'CANCELLED',
] as const;
export const taskStatuses = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const;
export const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const owners = [
  'USER',
  'QA',
  'DEVELOPMENT',
  'INFRASTRUCTURE',
  'PROVIDER',
  'ENTITY',
  'PRODUCT',
  'SECURITY',
  'OTHER',
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type Priority = (typeof priorities)[number];
export type WaitingFor = (typeof owners)[number];

export interface ProjectInput {
  name: string;
  code: string;
  description: string;
  type: string;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  nextAction: string;
  waitingFor: WaitingFor;
}
export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  closedAt: string | null;
}
export interface TaskInput {
  title: string;
  description: string;
  projectId: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  waitingFor: WaitingFor;
}
export interface Task extends TaskInput {
  id: string;
  source: 'MANUAL' | 'EMAIL';
  sourceReference: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface Settings {
  minimizeToTray: boolean;
  notifications: boolean;
  followUpDays: number;
}
export const defaultSettings: Settings = {
  minimizeToTray: true,
  notifications: false,
  followUpDays: 3,
};
export const isOpen = (item: { status: string }) =>
  !['COMPLETED', 'CANCELLED'].includes(item.status);
