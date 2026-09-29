import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mailState, mailContent } from '../mail-fixtures';

test('correo a tarea: revisión, proyecto, Mi Día, deduplicación y persistencia', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-email-task-e2e-'));
  let app: ElectronApplication | undefined;
  let db: PrismaClient | undefined;
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
    await expect(page.getByRole('heading', { name: 'Hola, Derian' })).toBeVisible();
    // Seed only this temporary profile with synthetic mail encrypted by Electron.
    // The entire draft/create flow then uses the production IPC, service and database.
    const encrypted = await app.evaluate(
      ({ safeStorage }, fixture) => ({
        message: Array.from(safeStorage.encryptString(JSON.stringify(fixture.content))),
        vault: Array.from(safeStorage.encryptString(JSON.stringify(fixture.state))),
      }),
      { content: mailContent, state: mailState },
    );
    db = new PrismaClient({
      datasources: { db: { url: `file:${join(dir, 'workspace.db').replaceAll('\\', '/')}` } },
    });
    const messageId = randomUUID();
    await db.mailMessage.create({
      data: {
        id: messageId,
        accountId: 'fake-account',
        providerId: 'fake-provider',
        receivedAt: mailContent.receivedAt,
        content: new Uint8Array(encrypted.message),
      },
    });
    await db.$disconnect();
    db = undefined;
    await writeFile(join(dir, 'microsoft365.bin'), Buffer.from(encrypted.vault));
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    await page.getByLabel('Nombre del proyecto').fill('Certificación desde correo');
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Correos', exact: true }).click();
    await page.getByRole('button', { name: /Evidencia de pruebas/ }).click();
    await page.getByRole('button', { name: 'Crear tarea desde correo', exact: true }).click();
    await expect(page.getByLabel('Título de la tarea')).toHaveValue(
      'Revisar: Evidencia de pruebas',
    );
    await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Fecha límite')).toHaveValue('');
    await page.getByLabel('Título de la tarea').fill('Validar evidencias recibidas');
    await page
      .getByLabel('Proyecto', { exact: true })
      .selectOption({ label: 'Certificación desde correo' });
    const today = await page.evaluate(async () => {
      const result = await window.qa.snapshot();
      if (!result.ok) throw new Error('snapshot');
      return result.value.today;
    });
    await page.getByLabel('Fecha límite').fill(today);
    await page.getByRole('button', { name: 'Guardar tarea' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mi Día', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Validar evidencias recibidas', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Desde correo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
    await page.getByRole('button', { name: 'Certificación desde correo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tareas del proyecto · 1' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('project-from-email.png'), fullPage: true });
    await page.getByRole('button', { name: 'Añadir tarea al proyecto' }).click();
    await expect(page.getByLabel('Proyecto', { exact: true }).locator('option:checked')).toHaveText(
      'Certificación desde correo',
    );
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Correos', exact: true }).click();
    await page.getByRole('button', { name: /Evidencia de pruebas/ }).click();
    await page.getByRole('button', { name: 'Crear tarea desde correo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Editar tarea', exact: true })).toBeVisible();
    await expect(page.getByLabel('Título de la tarea')).toHaveValue('Validar evidencias recibidas');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const tasks = await page.evaluate(async () => {
      const result = await window.qa.snapshot();
      if (!result.ok) throw new Error('snapshot');
      return result.value.tasks;
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].source).toBe('EMAIL');
    await page.getByRole('button', { name: 'Desconectar cuenta', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar desconexión', exact: true }).click();
    await expect(page.getByText('Cuenta desconectada y copia local eliminada.')).toBeVisible();
    await app.close();
    app = await electron.launch({ args: [resolve('out/main/main.js')], env });
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Tareas', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Validar evidencias recibidas', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Desde correo', { exact: true })).toBeVisible();
  } finally {
    await db?.$disconnect();
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
