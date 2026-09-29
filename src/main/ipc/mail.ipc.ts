import type { MailService } from '../../application/email/service';
import { AppError } from '../../domain/validation';
import { channels } from '../../shared/api';

export function mailHandlers(
  service: MailService,
): Record<string, (payload: unknown) => Promise<unknown>> {
  const withoutPayload = (run: () => Promise<unknown> | void) => async (payload: unknown) => {
    if (payload !== undefined)
      throw new AppError('VALIDATION', 'Esta operación no recibe parámetros.');
    return run();
  };
  return {
    [channels.mailStatus]: withoutPayload(() => service.status()),
    [channels.mailList]: (payload) => service.list(payload),
    [channels.mailConfigure]: (payload) => service.configure(payload),
    [channels.mailConnect]: withoutPayload(() => service.connect()),
    [channels.mailSync]: withoutPayload(() => service.sync()),
    [channels.mailCancel]: withoutPayload(() => service.cancel()),
    [channels.mailDisconnect]: withoutPayload(() => service.disconnect()),
  };
}
