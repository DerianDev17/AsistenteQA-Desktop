import type { EmailTasks } from '../../application/email/tasks';
import { channels } from '../../shared/api';
import { AppError } from '../../domain/validation';

export function emailTaskHandlers(service: EmailTasks) {
  return {
    [channels.mailSuggestions]: async (payload: unknown) => {
      if (payload !== undefined)
        throw new AppError('VALIDATION', 'Esta consulta no recibe parámetros.');
      return service.suggestions();
    },
    [channels.mailTaskDraft]: (payload: unknown) => service.draft(payload),
    [channels.mailTaskCreate]: (payload: unknown) => service.create(payload),
  };
}
