import type { CalendarService } from '../../application/calendar/service';
import { AppError } from '../../domain/validation';
import { teamsUrl } from '../../infrastructure/calendar/microsoft-calendar';
import { channels } from '../../shared/api';

export function calendarHandlers(
  service: CalendarService,
  openBrowser: (url: string) => Promise<void>,
  cancel: () => void,
) {
  const noArgs = (run: () => Promise<unknown> | void) => async (value: unknown) => {
    if (value !== undefined)
      throw new AppError('VALIDATION', 'Esta operación no recibe parámetros.');
    return run();
  };
  return {
    [channels.calendarSnapshot]: noArgs(() => service.snapshot()),
    [channels.calendarConnect]: noArgs(() => service.connect()),
    [channels.calendarSync]: noArgs(() => service.sync()),
    [channels.calendarCancel]: noArgs(cancel),
    [channels.calendarOpen]: async (id: unknown) => {
      if (typeof id !== 'string' || !id || id.length > 4096)
        throw new AppError('VALIDATION', 'El identificador de reunión no es válido.');
      const event = (await service.snapshot()).events.find((item) => item.id === id);
      const url = teamsUrl(event?.teamsUrl);
      if (!url)
        throw new AppError('NOT_FOUND', 'La reunión no tiene un enlace de Teams disponible.');
      await openBrowser(url);
    },
  };
}
