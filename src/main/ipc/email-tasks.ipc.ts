import type { EmailTasks } from '../../application/email/tasks';
import { channels } from '../../shared/api';

export function emailTaskHandlers(service: EmailTasks) {
  return {
    [channels.mailTaskDraft]: (payload: unknown) => service.draft(payload),
    [channels.mailTaskCreate]: (payload: unknown) => service.create(payload),
  };
}
