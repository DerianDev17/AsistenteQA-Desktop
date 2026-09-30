import { contextBridge, ipcRenderer } from 'electron';
import { channels, type QaApi, type Result } from '../shared/api';

async function request<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  const response: unknown = await ipcRenderer.invoke(channel, payload);
  if (
    !response ||
    typeof response !== 'object' ||
    !('ok' in response) ||
    typeof response.ok !== 'boolean' ||
    (response.ok ? !('value' in response) : !('error' in response))
  )
    throw new Error('Respuesta de la aplicación no válida.');
  return response as Result<T>;
}
const api: QaApi = {
  snapshot: () => request(channels.snapshot),
  calendar: {
    snapshot: () => request(channels.calendarSnapshot),
    connect: () => request(channels.calendarConnect),
    sync: () => request(channels.calendarSync),
    cancel: () => request(channels.calendarCancel),
    openMeeting: (id) => request(channels.calendarOpen, id),
  },
  projects: {
    create: (data) => request(channels.projectCreate, data),
    update: (id, data) => request(channels.projectUpdate, { id, data }),
    delete: (id) => request(channels.projectDelete, id),
  },
  tasks: {
    create: (data) => request(channels.taskCreate, data),
    update: (id, data) => request(channels.taskUpdate, { id, data }),
    complete: (id) => request(channels.taskComplete, id),
    delete: (id) => request(channels.taskDelete, id),
  },
  settings: { save: (data) => request(channels.settingsSave, data) },
  mail: {
    suggestions: () => request(channels.mailSuggestions),
    taskDraft: (id) => request(channels.mailTaskDraft, id),
    createTask: (id, data) => request(channels.mailTaskCreate, { id, data }),
    status: () => request(channels.mailStatus),
    list: (page) => request(channels.mailList, { page }),
    configure: (config) => request(channels.mailConfigure, config),
    connect: () => request(channels.mailConnect),
    sync: () => request(channels.mailSync),
    cancel: () => request(channels.mailCancel),
    disconnect: () => request(channels.mailDisconnect),
  },
};
contextBridge.exposeInMainWorld('qa', api);
