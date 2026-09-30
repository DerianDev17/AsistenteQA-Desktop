import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('núcleo local: CRUD, Mi Día, búsqueda, aislamiento, tray y persistencia', async ({}, testInfo) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'qa-assistant-e2e-'));
  let app: ElectronApplication | undefined;
  const launch = async () => {
    const env: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    env.QA_USER_DATA_DIR = dataDir;
    delete env.ELECTRON_RUN_AS_NODE;
    const instance = await electron.launch({ args: [resolve('out/main/main.js')], env });
    const page = await instance.firstWindow();
    await expect(page.getByRole('heading', { name: 'Hola, Derian' })).toBeVisible();
    return { instance, page };
  };
  try {
    let launched = await launch();
    app = launched.instance;
    let page = launched.page;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
    expect(
      await page.evaluate(() => ({
        require: typeof Reflect.get(window, 'require'),
        process: typeof Reflect.get(window, 'process'),
        api: Object.keys(window.qa),
      })),
    ).toEqual({
      require: 'undefined',
      process: 'undefined',
      api: ['snapshot', 'calendar', 'projects', 'tasks', 'settings', 'mail'],
    });
    const preferences = await app.evaluate(({ BrowserWindow }) =>
      (
        BrowserWindow.getAllWindows()[0].webContents as unknown as {
          getLastWebPreferences(): Record<string, unknown>;
        }
      ).getLastWebPreferences(),
    );
    expect(preferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    await page.getByLabel('Nombre del proyecto').fill('Certificación de servicio');
    await page.getByLabel('Próxima acción').fill('Preparar evidencias');
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
    await page.getByLabel('Título de la tarea').fill('Validar respuesta del servicio');
    await page
      .getByLabel('Proyecto', { exact: true })
      .selectOption({ label: 'Certificación de servicio' });
    await page.getByRole('button', { name: 'Guardar tarea' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mi Día', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Validar respuesta del servicio', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Editar Validar respuesta del servicio', exact: true })
      .click();
    await page.getByLabel('Prioridad').selectOption('HIGH');
    await page.getByRole('button', { name: 'Guardar tarea' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Completar Validar respuesta del servicio', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Validar respuesta del servicio', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
    await page
      .getByRole('button', { name: 'Eliminar Certificación de servicio', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(page.getByRole('alert')).toContainText('tareas vinculadas');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await page.getByLabel('Días antes de sugerir seguimiento').fill('5');
    await page.getByRole('button', { name: 'Guardar preferencias' }).click();
    await expect(page.getByText('Preferencias guardadas')).toBeVisible();
    // Closing the native window must hide it without destroying its data or process.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    expect(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    ).toBe(false);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await app.close();
    app = undefined;
    launched = await launch();
    app = launched.instance;
    page = launched.page;
    await page.getByRole('button', { name: 'Tareas', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Validar respuesta del servicio', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Completado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await expect(page.getByLabel('Días antes de sugerir seguimiento')).toHaveValue('5');
    await page.getByLabel('Buscar proyectos y tareas').fill('Certificación');
    await expect(
      page.getByRole('button', { name: 'Certificación de servicio', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Validar respuesta del servicio', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
    await page.getByRole('button', { name: 'Tareas', exact: true }).click();
    await page
      .getByRole('button', { name: 'Eliminar Validar respuesta del servicio', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
    await page
      .getByRole('button', { name: 'Eliminar Certificación de servicio', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
