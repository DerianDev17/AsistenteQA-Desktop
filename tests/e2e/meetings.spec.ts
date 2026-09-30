import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { projectData, taskData } from '../fixtures';

test('Reuniones filtra la agenda y prepara el contexto de un proyecto por el preload real', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-meetings-e2e-'));
  let app: ElectronApplication | undefined;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  env.QA_USER_DATA_DIR = dir;
  try {
    app = await electron.launch({ args: [resolve('out/main/main.js')], env });
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluate(
      async (fixture) => {
        const project = await window.qa.projects.create(fixture.project);
        if (!project.ok) throw new Error(project.error.message);
        const task = await window.qa.tasks.create({
          ...fixture.task,
          projectId: project.value.id,
          title: 'Preparar evidencias para la reunión',
        });
        if (!task.ok) throw new Error(task.error.message);
      },
      { project: projectData, task: taskData },
    );
    // Replace only calendar provider responses in a temporary profile. No real login or browser opening.
    await app.evaluate(({ ipcMain }) => {
      const now = Date.now();
      const event = {
        id: 'synthetic-meeting',
        subject: 'Seguimiento QA-001',
        start: new Date(now + 3600000).toISOString(),
        end: new Date(now + 7200000).toISOString(),
        allDay: false,
        organizer: 'Equipo de pruebas',
        location: 'Teams',
        response: 'accepted',
        teamsUrl: 'https://teams.microsoft.com/l/meetup-join/synthetic-meeting',
      };
      const snapshot = {
        connected: true,
        enabled: true,
        autoSync: false,
        busy: false,
        needsReconnect: false,
        error: null,
        start: new Date(now - 86400000).toISOString(),
        end: new Date(now + 31 * 86400000).toISOString(),
        lastSyncedAt: new Date(now).toISOString(),
        events: [
          event,
          {
            ...event,
            id: 'pending',
            subject: 'Planificación local',
            response: 'notResponded',
            teamsUrl: null,
          },
          { ...event, id: 'day', subject: 'Reserva del día', allDay: true },
        ],
      };
      for (const channel of ['calendar:snapshot', 'calendar:sync', 'calendar:open'])
        ipcMain.removeHandler(channel);
      ipcMain.handle('calendar:snapshot', () => ({ ok: true, value: snapshot }));
      ipcMain.handle('calendar:sync', () => {
        snapshot.events = snapshot.events.filter((item) => item.id !== 'synthetic-meeting');
        return { ok: true, value: undefined };
      });
      ipcMain.handle('calendar:open', (_event, id: unknown) =>
        id === event.id
          ? { ok: true, value: undefined }
          : { ok: false, error: { code: 'NOT_FOUND', message: 'Reunión desconocida.' } },
      );
    });
    await page.getByRole('button', { name: 'Reuniones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reuniones próximas' })).toBeVisible();
    await expect(page.getByText('Reserva del día', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Por responder', exact: true }).click();
    await expect(page.getByText('Planificación local', { exact: true })).toBeVisible();
    await expect(page.getByText('Seguimiento QA-001', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Teams', exact: true }).click();
    await expect(page.getByText('Seguimiento QA-001', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('meetings-list.png'), fullPage: true });
    await page
      .getByRole('button', { name: 'Abrir Teams: Seguimiento QA-001', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Preparar reunión: Seguimiento QA-001', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Proyecto para consultar')
      .selectOption({ label: 'Proyecto de pruebas · Coincide con el título' });
    await expect(dialog).toContainText(projectData.nextAction);
    await page.screenshot({ path: testInfo.outputPath('meeting-brief.png'), fullPage: true });
    await dialog
      .getByRole('button', { name: 'Preparar evidencias para la reunión', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('Editar tarea');
    await page.getByRole('button', { name: 'Cerrar formulario' }).click();
    await page
      .getByRole('button', { name: 'Preparar reunión: Seguimiento QA-001', exact: true })
      .click();
    await page
      .getByLabel('Proyecto para consultar')
      .selectOption({ label: 'Proyecto de pruebas · Coincide con el título' });
    await page.getByRole('button', { name: 'Abrir ficha del proyecto', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Proyecto de pruebas' })).toBeVisible();
    await page.getByRole('button', { name: 'Reuniones', exact: true }).click();
    await page.getByRole('button', { name: 'Sincronizar reuniones', exact: true }).click();
    await expect(page.getByText('Seguimiento QA-001', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Planificación local', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('meetings.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
