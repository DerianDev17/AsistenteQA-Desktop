import {
  owners,
  priorities,
  projectStatuses,
  taskStatuses,
  type ProjectInput,
  type TaskInput,
  type Settings,
} from './models';

export class AppError extends Error {
  constructor(
    public readonly code:
      | 'VALIDATION'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'INTERNAL'
      | 'FORBIDDEN'
      | 'AUTH_REQUIRED'
      | 'CANCELLED'
      | 'NETWORK'
      | 'RATE_LIMIT'
      | 'SYNC_RESET'
      | 'SECURE_STORAGE',
    message: string,
  ) {
    super(message);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError('VALIDATION', 'Los datos enviados no son válidos.');
  return value as Record<string, unknown>;
}
function exact(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new AppError('VALIDATION', 'La solicitud contiene campos no permitidos.');
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new AppError(
      'VALIDATION',
      `${label}: ingresa un texto ${required ? 'no vacío ' : ''}de hasta ${max} caracteres.`,
    );
  return value.trim();
}
export function id(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)
  )
    throw new AppError('VALIDATION', 'El identificador no es válido.');
  return value;
}
function oneOf<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new AppError('VALIDATION', `${label} no válido.`);
  return value as T;
}
export function dateOnly(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new AppError('VALIDATION', 'La fecha no es válida.');
  return value;
}
export function projectInput(value: unknown): ProjectInput {
  const data = record(value);
  exact(data, [
    'name',
    'code',
    'description',
    'type',
    'status',
    'priority',
    'progress',
    'nextAction',
    'waitingFor',
  ]);
  if (
    typeof data.progress !== 'number' ||
    !Number.isInteger(data.progress) ||
    data.progress < 0 ||
    data.progress > 100
  )
    throw new AppError('VALIDATION', 'El avance debe estar entre 0 y 100.');
  const status = oneOf(data.status, projectStatuses, 'Estado');
  return {
    name: text(data.name, 'Nombre', 160, true),
    code: text(data.code, 'Código', 40),
    description: text(data.description, 'Descripción', 4000),
    type: text(data.type, 'Tipo', 80, true),
    status,
    priority: oneOf(data.priority, priorities, 'Prioridad'),
    progress: status === 'COMPLETED' ? 100 : data.progress,
    nextAction: text(data.nextAction, 'Próxima acción', 500),
    waitingFor: oneOf(data.waitingFor, owners, 'Responsable'),
  };
}
export function taskInput(value: unknown): TaskInput {
  const data = record(value);
  exact(data, [
    'title',
    'description',
    'projectId',
    'status',
    'priority',
    'dueDate',
    'dueTime',
    'waitingFor',
  ]);
  const dueDate = data.dueDate === null ? null : dateOnly(data.dueDate);
  if (
    data.dueTime !== null &&
    (typeof data.dueTime !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.dueTime) ||
      !dueDate)
  )
    throw new AppError('VALIDATION', 'La hora requiere una fecha y el formato HH:mm.');
  return {
    title: text(data.title, 'Título', 200, true),
    description: text(data.description, 'Descripción', 4000),
    projectId: data.projectId === null ? null : id(data.projectId),
    status: oneOf(data.status, taskStatuses, 'Estado'),
    priority: oneOf(data.priority, priorities, 'Prioridad'),
    dueDate,
    dueTime: data.dueTime as string | null,
    waitingFor: oneOf(data.waitingFor, owners, 'Responsable'),
  };
}
export function settingsInput(value: unknown): Settings {
  const data = record(value);
  exact(data, ['minimizeToTray', 'notifications', 'followUpDays']);
  if (
    typeof data.minimizeToTray !== 'boolean' ||
    typeof data.notifications !== 'boolean' ||
    typeof data.followUpDays !== 'number' ||
    !Number.isInteger(data.followUpDays) ||
    data.followUpDays < 1 ||
    data.followUpDays > 30
  )
    throw new AppError(
      'VALIDATION',
      'La configuración no es válida. El seguimiento debe estar entre 1 y 30 días.',
    );
  return {
    minimizeToTray: data.minimizeToTray,
    notifications: data.notifications,
    followUpDays: data.followUpDays,
  };
}
export function updateInput(value: unknown) {
  const data = record(value);
  exact(data, ['id', 'data']);
  return { id: id(data.id), data: data.data };
}
