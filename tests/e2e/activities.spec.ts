import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mailState, mailContent } from '../mail-fixtures';
import { calendarEvent } from '../calendar-fixtures';

test('agenda en Mi Día y certificación revisada con proyecto, sin tareas automáticas ni duplicadas', async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-activities-e2e-'));
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
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Hola, Derian' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    await page.getByLabel('Nombre del proyecto').fill('Certificación del proyecto ficticio');
    await page.getByLabel('Código', { exact: true }).fill('QA-001');
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const today = await page.evaluate(async () => {
      const result = await window.qa.snapshot();
      if (!result.ok) throw new Error('snapshot');
      return result.value.today;
    });
    const cache = {
      enabled: true,
      lastSyncedAt: new Date().toISOString(),
      start: new Date(`${today}T00:00:00`).toISOString(),
      end: new Date(`${today}T23:59:59`).toISOString(),
      events: [
        {
          ...calendarEvent,
          response: 'notResponded',
          start: new Date(`${today}T10:00:00`).toISOString(),
          end: new Date(`${today}T11:00:00`).toISOString(),
        },
      ],
    };
    const content = { ...mailContent, subject: 'Certificación QA-001 pendiente' };
    // Synthetic encrypted data in a disposable profile; no real Microsoft calls or account changes.
    const encrypted = await app.evaluate(
      ({ safeStorage }, fixture) => ({
        calendar: Array.from(safeStorage.encryptString(JSON.stringify(fixture.cache))),
        message: Array.from(safeStorage.encryptString(JSON.stringify(fixture.content))),
        vault: Array.from(safeStorage.encryptString(JSON.stringify(fixture.state))),
      }),
      { cache, content, state: mailState },
    );
    db = new PrismaClient({
      datasources: { db: { url: `file:${join(dir, 'workspace.db').replaceAll('\\', '/')}` } },
    });
    const bytes = new Uint8Array(encrypted.calendar);
    await db.$executeRaw`INSERT INTO CalendarCache (accountId, content) VALUES ('fake-account', ${bytes})`;
    await db.mailMessage.create({
      data: {
        id: randomUUID(),
        accountId: 'fake-account',
        providerId: 'fake-provider',
        receivedAt: content.receivedAt,
        content: new Uint8Array(encrypted.message),
      },
    });
    await writeFile(join(dir, 'microsoft365.bin'), Buffer.from(encrypted.vault));
    await page.getByRole('button', { name: 'Mi Día', exact: true }).click();
    await expect(page.getByText('Revisión de certificación', { exact: true })).toBeVisible();
    await expect(page.getByText('Por responder', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir Teams' })).toBeVisible();
    expect(await db.task.count()).toBe(0);
    await expect(page.getByText('Certificación QA-001 pendiente', { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('activities-before-review.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Revisar actividad' }).click();
    await expect(page.getByLabel('Proyecto', { exact: true }).locator('option:checked')).toHaveText(
      'Certificación del proyecto ficticio',
    );
    await expect(page.getByLabel('Fecha límite')).toHaveValue('');
    await page.getByLabel('Fecha límite').fill(today);
    await page.getByRole('button', { name: 'Guardar tarea' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Revisar: Certificación QA-001 pendiente', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar actividad' })).toHaveCount(0, {
      timeout: 10000,
    });
    expect(await db.task.count()).toBe(1);
    await page.getByRole('button', { name: 'Calendario', exact: true }).click();
    await expect(page.getByText('Revisión de certificación', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('calendar.png'), fullPage: true });
    await page.getByLabel('Fecha de agenda').fill('2000-01-01');
    await expect(page.getByText('Sin reuniones en este período')).toBeVisible();
    await page.getByRole('button', { name: 'Ver período descargado' }).click();
    await expect(page.getByText('Revisión de certificación', { exact: true })).toBeVisible();
  } finally {
    await db?.$disconnect();
    await app?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
