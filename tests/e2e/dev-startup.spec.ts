import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolveConfig } from 'electron-vite';
import { createServer, type ViteDevServer } from 'vite';

test('el arranque de desarrollo carga React, los datos locales y el calendario', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-dev-startup-'));
  let app: ElectronApplication | undefined;
  let server: ViteDevServer | undefined;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  env.QA_USER_DATA_DIR = dir;
  try {
    const config = await resolveConfig({}, 'serve');
    server = await createServer({
      ...config.config?.renderer,
      configFile: false,
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'error',
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string')
      throw new Error('No se pudo iniciar el servidor de desarrollo.');
    env.ELECTRON_RENDERER_URL = `http://127.0.0.1:${address.port}`;
    app = await electron.launch({ args: [resolve('out/main/main.js')], env });
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.waitForURL(`${env.ELECTRON_RENDERER_URL}/`);
    await page.waitForLoadState('load');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.reload(),
    );
    try {
      await expect(page.getByRole('heading', { name: 'Hola, Derian' })).toBeVisible();
    } catch (reason) {
      await testInfo.attach('errores-de-arranque', {
        body: errors.join('\n'),
        contentType: 'text/plain',
      });
      throw reason;
    }
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
    const navigation = await app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      return new Promise<{ url: string; blocked: boolean }>((resolve) => {
        contents.once('will-navigate', (event) =>
          resolve({ url: event.url, blocked: event.defaultPrevented }),
        );
        void contents.executeJavaScript(
          "window.location.assign('https://example.invalid/blocked-navigation')",
        );
      });
    });
    expect(navigation).toEqual({
      url: 'https://example.invalid/blocked-navigation',
      blocked: true,
    });
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.getURL(),
      ),
    ).toBe(`${env.ELECTRON_RENDERER_URL}/`);
    // Refresh after the cancelled navigation so the DevTools frame state matches the window.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.reload(),
    );
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
    await page.getByRole('button', { name: 'Calendario', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agenda de Microsoft 365' })).toBeVisible();
    await page.getByRole('button', { name: 'Reuniones', exact: true }).click();
    await expect(page.getByText('Autoriza el calendario para consultar reuniones')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('dev-startup.png'), fullPage: true });
    // A missing module previously left #root empty with no way to retry.
    await page.route('**/src.tsx', (route) => route.abort());
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'No se pudo cargar la interfaz' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar carga' })).toBeVisible();
    await page.unroute('**/src.tsx');
    await page.getByRole('button', { name: 'Reintentar carga' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Derian' })).toBeVisible();
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
  } finally {
    await app?.close();
    await server?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
