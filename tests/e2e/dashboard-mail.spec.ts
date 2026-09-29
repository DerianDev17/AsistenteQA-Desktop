import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mailConfigData, mailContent } from '../mail-fixtures';

test('Inicio refleja el correo del servicio y se actualiza al sincronizar', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-dashboard-mail-e2e-'));
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
    // Synthetic service responses travel through the real isolated preload and IPC boundary.
    // This profile never signs into Microsoft or reads the user's mailbox.
    await app.evaluate(
      ({ ipcMain }, fixture) => {
        let synced = false;
        const status = {
          config: fixture.config,
          address: 'qa@example.test',
          connected: true,
          needsReconnect: false,
          lastSyncedAt: null as string | null,
          busy: null,
          hasMore: false,
          error: null,
        };
        for (const channel of ['mail:status', 'mail:list', 'mail:sync'])
          ipcMain.removeHandler(channel);
        ipcMain.handle('mail:status', () => ({ ok: true, value: status }));
        ipcMain.handle('mail:list', () => ({
          ok: true,
          value: {
            messages: synced
              ? [
                  {
                    ...fixture.content,
                    id: 'fake-mail',
                    providerId: 'fake-provider',
                    importance: 'high',
                  },
                ]
              : [],
            total: synced ? 1 : 0,
            page: 0,
            pageSize: 50,
          },
        }));
        ipcMain.handle('mail:sync', () => {
          synced = true;
          status.lastSyncedAt = fixture.content.receivedAt;
          return { ok: true, value: undefined };
        });
      },
      { config: mailConfigData, content: mailContent },
    );
    await page.getByRole('button', { name: 'Correos', exact: true }).click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await expect(page.getByText('0 correos descargados')).toBeVisible();
    await page.getByRole('button', { name: 'Sincronizar correo', exact: true }).click();
    await expect(page.getByText('1 correo descargado')).toBeVisible();
    await expect(page.getByText(/Última sincronización:/)).toBeVisible();
    await page.getByRole('button', { name: /Evidencia de pruebas/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Revisar la evidencia adjunta.');
    await page.getByRole('button', { name: 'Cerrar formulario' }).click();
    await page.getByRole('button', { name: 'Ver correos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Bandeja de entrada · 1 correos locales' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await expect(page.getByText('1 correo descargado')).toBeVisible();
    await expect(page.getByText('Un espacio para tus proyectos')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-mail.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
