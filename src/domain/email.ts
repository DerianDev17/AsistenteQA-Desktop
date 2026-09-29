import { AppError, record } from './validation';

export interface MailConfig {
  clientId: string;
  tenantId: string;
  autoSync: boolean;
}
export interface MailContent {
  threadId: string;
  subject: string;
  sender: string;
  senderName: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
}
export interface MailMessage extends MailContent {
  id: string;
  providerId: string;
}
export type MailChange =
  | { providerId: string; deleted: true }
  | { providerId: string; deleted: false; data: Partial<MailContent> };
export interface MailPage {
  messages: MailMessage[];
  total: number;
  page: number;
  pageSize: number;
}
export interface MailStatus {
  config: MailConfig | null;
  address: string | null;
  connected: boolean;
  needsReconnect: boolean;
  lastSyncedAt: string | null;
  busy: 'connect' | 'sync' | 'configure' | 'disconnect' | null;
  hasMore: boolean;
  error: string | null;
}
export function mailConfig(value: unknown): MailConfig {
  const data = record(value);
  const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  if (
    Object.keys(data).some((key) => !['clientId', 'tenantId', 'autoSync'].includes(key)) ||
    typeof data.clientId !== 'string' ||
    !guid.test(data.clientId.trim()) ||
    typeof data.tenantId !== 'string' ||
    !guid.test(data.tenantId.trim()) ||
    typeof data.autoSync !== 'boolean'
  )
    throw new AppError(
      'VALIDATION',
      'Ingresa el client ID y tenant ID de Microsoft Entra en formato GUID. No se necesita un secreto de cliente.',
    );
  return {
    clientId: data.clientId.trim().toLowerCase(),
    tenantId: data.tenantId.trim().toLowerCase(),
    autoSync: data.autoSync,
  };
}
export function mailPageInput(value: unknown): number {
  const data = record(value);
  if (
    Object.keys(data).length !== 1 ||
    typeof data.page !== 'number' ||
    !Number.isInteger(data.page) ||
    data.page < 0 ||
    data.page > 100000
  )
    throw new AppError('VALIDATION', 'La página de correos no es válida.');
  return data.page;
}
