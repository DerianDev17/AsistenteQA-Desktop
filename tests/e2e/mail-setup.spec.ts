import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mailConfigData } from '../mail-fixtures';

test('Microsoft 365: configuración cifrada y guía sin iniciar una sesión real', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-mail-e2e-'));
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
    let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Correos', exact: true }).click();
    await expect(page.getByText('Tu bandeja está lista para conectar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar y sincronizar' })).toBeDisabled();
    await page.getByLabel('Application (client) ID').fill(mailConfigData.clientId);
    await page.getByLabel('Directory (tenant) ID').fill(mailConfigData.tenantId);
    await page.getByLabel('Sincronizar automáticamente').uncheck();
    await page.getByRole('button', { name: 'Guardar conexión' }).click();
    await expect(
      page.getByText('Configuración guardada. Ya puedes conectar la cuenta.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar y sincronizar' })).toBeEnabled();
    const bytes = await readFile(join(dir, 'microsoft365.bin'));
    expect(bytes.toString()).not.toContain(mailConfigData.clientId);
    expect(bytes.toString()).not.toContain('tenantId');
    const contract = await page.evaluate(async () => ({
      methods: Object.keys(window.qa.mail),
      status: await window.qa.mail.status(),
    }));
    expect(contract.methods).toEqual([
      'suggestions',
      'taskDraft',
      'createTask',
      'status',
      'list',
      'configure',
      'connect',
      'sync',
      'cancel',
      'disconnect',
    ]);
    expect(contract.status).toMatchObject({
      ok: true,
      value: { connected: false, config: mailConfigData },
    });
    expect(JSON.stringify(contract.status)).not.toContain('cache');
    await app.close();
    app = await electron.launch({ args: [resolve('out/main/main.js')], env });
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Correos', exact: true }).click();
    await expect(page.getByLabel('Application (client) ID')).toHaveValue(mailConfigData.clientId);
    await expect(page.getByLabel('Directory (tenant) ID')).toHaveValue(mailConfigData.tenantId);
    await expect(page.getByLabel('Sincronizar automáticamente')).not.toBeChecked();
    await expect(page.getByText('Sin conectar', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('mail-setup.png'), fullPage: true });
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
