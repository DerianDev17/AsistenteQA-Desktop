import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { projectData, taskData } from '../fixtures';
import { mailConfigData, mailContent } from '../mail-fixtures';

test('Inicio interactivo integra agenda y tareas, guarda reglas y se adapta al tamaño de ventana', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-dashboard-e2e-'));
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
        const snapshot = await window.qa.snapshot();
        if (!snapshot.ok) throw new Error(snapshot.error.message);
        for (const [index, name] of [
          'Certificación QA',
          'Integración de pagos',
          'Ambiente de pruebas',
        ].entries()) {
          const project = await window.qa.projects.create({
            ...fixture.project,
            name,
            code: `TEST-${index}`,
            progress: [75, 50, 30][index],
            status: index === 2 ? 'BLOCKED' : 'IN_QA',
          });
          if (!project.ok) throw new Error(project.error.message);
          for (let item = 0; item < 2; item++) {
            const task = await window.qa.tasks.create({
              ...fixture.task,
              projectId: project.value.id,
              title: `${item ? 'Revisar evidencia' : 'Validar resultados'} ${index + 1}`,
              dueDate: snapshot.value.today,
              dueTime: `${item ? '14' : '09'}:00`,
            });
            if (!task.ok) throw new Error(task.error.message);
          }
        }
      },
      { project: projectData, task: taskData },
    );
    await app.evaluate(
      ({ ipcMain, BrowserWindow }, fixture) => {
        BrowserWindow.getAllWindows()[0].setBounds({ width: 1560, height: 1000 });
        const now = Date.now();
        const start = new Date(now + 5 * 60000).toISOString();
        const meeting = {
          id: 'test-meeting',
          subject: 'Seguimiento de certificación',
          start,
          end: new Date(now + 35 * 60000).toISOString(),
          allDay: false,
          organizer: 'Equipo de pruebas',
          location: 'Teams',
          response: 'accepted',
          teamsUrl: 'https://teams.microsoft.com/l/meetup-join/test-meeting',
        };
        const calendar = {
          connected: true,
          enabled: true,
          autoSync: false,
          busy: false,
          needsReconnect: false,
          error: null,
          lastSyncedAt: new Date(now).toISOString(),
          start,
          end: meeting.end,
          events: [meeting],
        };
        const status = {
          config: fixture.config,
          address: 'qa@example.test',
          connected: true,
          needsReconnect: false,
          busy: null,
          hasMore: false,
          error: null,
          lastSyncedAt: new Date(now).toISOString(),
        };
        for (const channel of [
          'mail:status',
          'mail:list',
          'mail:configure',
          'calendar:snapshot',
          'calendar:open',
        ])
          ipcMain.removeHandler(channel);
        ipcMain.handle('mail:status', () => ({ ok: true, value: status }));
        ipcMain.handle('mail:list', () => ({
          ok: true,
          value: {
            messages: Array.from({ length: 5 }, (_, index) => ({
              ...fixture.content,
              id: `mail-${index}`,
              providerId: `mail-${index}`,
              subject: `Evidencia de pruebas ${index + 1}`,
            })),
            total: 12,
            page: 0,
            pageSize: 50,
          },
        }));
        ipcMain.handle('mail:configure', (_event, config) => {
          status.config = config;
          calendar.autoSync = config.autoSync;
          return { ok: true, value: undefined };
        });
        ipcMain.handle('calendar:snapshot', () => ({ ok: true, value: calendar }));
        ipcMain.handle('calendar:open', (_event, id) => ({
          ok: id === meeting.id,
          value: undefined,
        }));
      },
      { config: mailConfigData, content: mailContent },
    );
    // Load a fresh workspace snapshot after seeding through IPC outside the renderer.
    await page.reload();
    await expect(
      page.getByRole('button', { name: /Actividades de hoy.*7.*6 tareas/ }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText(/En [45] minutos/);
    await expect(page.getByRole('button', { name: /Correos locales.*12/ })).toBeVisible();
    await page.locator('.next-meeting').getByRole('button', { name: 'Preparar reunión' }).click();
    await expect(page.getByRole('dialog', { name: 'Preparar reunión' })).toContainText(
      'Seguimiento de certificación',
    );
    await page.getByRole('button', { name: 'Cerrar formulario' }).click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.getByRole('button', { name: 'Completar: Validar resultados 1' }).click();
    await expect(
      page.getByRole('button', { name: /Actividades de hoy.*6.*5 tareas/ }),
    ).toBeVisible();
    await expect(page.getByText('1 tareas completadas hoy', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Requieren atención/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Proyecto bloqueado');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Ambiente de pruebas/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Ambiente de pruebas', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Sincronización automática de correo y agenda' })
      .check();
    await expect(
      page.getByRole('checkbox', { name: 'Sincronización automática de correo y agenda' }),
    ).toBeChecked();
    await page.getByRole('checkbox', { name: 'Recordatorios automáticos' }).check();
    await expect(page.getByText('Recordatorios actualizados.', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Recordatorios automáticos' })).toBeChecked();
    const saved = await page.evaluate(() => window.qa.snapshot());
    expect(saved.ok && saved.value.settings.notifications).toBe(true);
    // Turn off native notices in this isolated test profile before a scheduler tick.
    await page.getByRole('checkbox', { name: 'Recordatorios automáticos' }).uncheck();
    await expect(
      page.getByRole('checkbox', { name: 'Recordatorios automáticos' }),
    ).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Recordatorios automáticos' })).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('dashboard-wide.png'), fullPage: true });
    const landscape = await page.evaluate(async () => {
      const style = getComputedStyle(document.querySelector('.hero')!).backgroundImage;
      const url = /url\("([^"]+)"\)/.exec(style)?.[1];
      if (!url) return false;
      const image = new Image();
      image.src = url;
      await image.decode();
      return image.naturalWidth > 0;
    });
    expect(landscape).toBe(true);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1100, height: 800 }),
    );
    await expect(page.getByRole('button', { name: 'Ver mi día' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('dashboard-narrow.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
