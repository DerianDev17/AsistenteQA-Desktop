import type { Workspace } from '../../application/workspace';
import { AppError } from '../../domain/validation';
import { channels, type Result } from '../../shared/api';

export type SafeLogger = (operation: string, code: string) => void;
export async function respond<T>(
  operation: string,
  run: () => Promise<T>,
  log: SafeLogger,
): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const known = error instanceof AppError;
    const code = known ? error.code : 'INTERNAL';
    log(operation, code);
    return {
      ok: false,
      error: {
        code,
        message: known ? error.message : 'No se pudo completar la operación. Intenta nuevamente.',
      },
    };
  }
}
export function handlers(
  workspace: Workspace,
): Record<string, (payload: unknown) => Promise<unknown>> {
  return {
    [channels.snapshot]: async (payload) => {
      if (payload !== undefined)
        throw new AppError('VALIDATION', 'Esta consulta no recibe parámetros.');
      return workspace.snapshot();
    },
    [channels.projectCreate]: (data) => workspace.createProject(data),
    [channels.projectUpdate]: (data) => workspace.updateProject(data),
    [channels.projectDelete]: (data) => workspace.deleteProject(data),
    [channels.taskCreate]: (data) => workspace.createTask(data),
    [channels.taskUpdate]: (data) => workspace.updateTask(data),
    [channels.taskComplete]: (data) => workspace.completeTask(data),
    [channels.taskDelete]: (data) => workspace.deleteTask(data),
    [channels.settingsSave]: (data) => workspace.saveSettings(data),
  };
}
export function trustedSender(
  senderId: number,
  windowId: number,
  frameUrl: string,
  trustedUrl: string,
  isMainFrame: boolean,
) {
  return senderId === windowId && isMainFrame && frameUrl === trustedUrl;
}
