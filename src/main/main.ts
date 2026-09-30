import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
  shell,
} from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../infrastructure/database/client';
import { repositories } from '../infrastructure/database/repositories';
import { Workspace } from '../application/workspace';
import { handlers, respond, trustedSender } from './ipc/handlers';
import { AppError } from '../domain/validation';
import { MailService } from '../application/email/service';
import { EncryptedMailVault } from '../infrastructure/security/mail-vault';
import { MicrosoftAuth, calendarScopes } from '../infrastructure/email/microsoft-auth';
import { MicrosoftCalendar } from '../infrastructure/calendar/microsoft-calendar';
import { calendarRepository } from '../infrastructure/database/calendar-repository';
import { CalendarService } from '../application/calendar/service';
import { calendarHandlers } from './ipc/calendar.ipc';
import { MicrosoftGraph } from '../infrastructure/email/microsoft-graph';
import { mailRepository } from '../infrastructure/database/mail-repository';
import { systemCipher } from './security/cipher';
import { mailHandlers } from './ipc/mail.ipc';
import { EmailTasks } from '../application/email/tasks';
import { emailTaskSource } from '../infrastructure/email/task-source';
import { emailTaskHandlers } from './ipc/email-tasks.ipc';
import { reminders } from '../domain/reminders';
import { deliverReminders } from '../application/reminders';
import { reminderReceipts } from '../infrastructure/database/reminder-receipts';

const log = (operation: string, code: string) =>
  console.info(
    JSON.stringify({ timestamp: new Date().toISOString(), module: 'main', operation, code }),
  );
let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let disconnect: (() => Promise<void>) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let mailTimer: ReturnType<typeof setInterval> | undefined;

if (process.env.QA_USER_DATA_DIR) app.setPath('userData', process.env.QA_USER_DATA_DIR);
app.setName('QA Assistant Desktop');
app.setAppUserModelId('com.qaassistant.desktop');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
  app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    if (timer) clearInterval(timer);
    if (mailTimer) clearInterval(mailTimer);
    tray?.destroy();
    void (disconnect?.() ?? Promise.resolve())
      .catch(() => log('database:disconnect', 'INTERNAL'))
      .finally(() => app.quit());
  });
  app.on('window-all-closed', () => {
    if (!tray) app.quit();
  });
  void app
    .whenReady()
    .then(async () => {
      const dataDir = app.getPath('userData');
      await mkdir(dataDir, { recursive: true });
      const db = await openDatabase(join(dataDir, 'workspace.db'));
      const mailVault = new EncryptedMailVault(join(dataDir, 'microsoft365.bin'), systemCipher);
      const messages = mailRepository(db, systemCipher);
      const calendarCache = calendarRepository(db, systemCipher);
      const mail = new MailService(
        mailVault,
        new MicrosoftAuth((url) => shell.openExternal(url)),
        new MicrosoftGraph(),
        messages,
        () => new Date(),
        () => calendarCache.clear(),
      );
      const calendar = new CalendarService(
        mail,
        mailVault,
        new MicrosoftAuth((url) => shell.openExternal(url), calendarScopes),
        new MicrosoftCalendar(),
        calendarCache,
      );
      disconnect = async () => {
        await mail.stop();
        await db.$disconnect();
      };
      const repos = repositories(db);
      const workspace = new Workspace(repos.projects, repos.tasks, repos.settings, randomUUID);
      const emailTasks = new EmailTasks(
        emailTaskSource(mailVault, messages),
        repos.tasks,
        repos.projects,
        randomUUID,
      );
      let settings = await repos.settings.get();
      const rendererPath = join(__dirname, '../renderer/index.html');
      const rendererUrl =
        !app.isPackaged && process.env.ELECTRON_RENDERER_URL
          ? process.env.ELECTRON_RENDERER_URL
          : pathToFileURL(rendererPath).href;
      const trustedUrl = new URL(rendererUrl).href;
      window = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 1100,
        minHeight: 720,
        backgroundColor: '#080f1c',
        title: 'QA Assistant Desktop',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, '../preload/preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      Menu.setApplicationMenu(null);
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event) => {
        // Permit reloading this exact renderer, including Vite's recovery reloads.
        if (event.url !== trustedUrl) event.preventDefault();
      });
      window.webContents.on('will-attach-webview', (event) => event.preventDefault());
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      window.webContents.session.setPermissionCheckHandler(() => false);
      for (const [channel, handler] of Object.entries({
        ...handlers(workspace),
        ...mailHandlers(mail),
        ...emailTaskHandlers(emailTasks),
        ...calendarHandlers(
          calendar,
          (url) => shell.openExternal(url),
          () => mail.cancel(),
        ),
      })) {
        ipcMain.handle(channel, (event, payload: unknown) =>
          respond(
            channel,
            async () => {
              if (
                !window ||
                !trustedSender(
                  event.sender.id,
                  window.webContents.id,
                  event.senderFrame?.url ?? '',
                  trustedUrl,
                  event.senderFrame === window.webContents.mainFrame,
                )
              )
                throw new AppError('FORBIDDEN', 'Origen de solicitud no permitido.');
              const result = await handler(payload);
              if (channel === 'settings:save') settings = await repos.settings.get();
              return result;
            },
            log,
          ),
        );
      }
      // A small local BGRA icon avoids network assets or native build dependencies.
      const pixels = Buffer.alloc(32 * 32 * 4);
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const offset = (y * 32 + x) * 4;
          const mark = y > 10 && y < 22 && ((x > 8 && x < 12) || (x > 20 && x < 24));
          pixels.set(mark ? [255, 255, 255, 255] : [225, 110, 30, 255], offset);
        }
      tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 32, height: 32 }));
      tray.setToolTip('QA Assistant · Tu espacio de trabajo');
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Abrir QA Assistant', click: () => window?.show() },
          { type: 'separator' },
          { label: 'Salir', click: () => app.quit() },
        ]),
      );
      tray.on('double-click', () => window?.show());
      window.on('close', (event) => {
        if (!quitting && settings.minimizeToTray) {
          event.preventDefault();
          window?.hide();
        }
      });
      window.on('closed', () => {
        window = null;
        app.quit();
      });
      window.once('ready-to-show', () => window?.show());
      await window.loadURL(trustedUrl);
      log('startup', 'OK');
      const syncMail = () =>
        void (async () => {
          await mail
            .syncIfEnabled()
            .catch((error) =>
              log('mail:sync', error instanceof AppError ? error.code : 'INTERNAL'),
            );
          await calendar
            .syncIfEnabled()
            .catch((error) =>
              log('calendar:sync', error instanceof AppError ? error.code : 'INTERNAL'),
            );
        })();
      syncMail();
      mailTimer = setInterval(syncMail, 5 * 60000);
      let checking = false;
      const receipts = reminderReceipts(db);
      timer = setInterval(() => {
        if (checking || !settings.notifications || !Notification.isSupported()) return;
        checking = true;
        void workspace
          .snapshot()
          .then(async (snapshot) => {
            if (!settings.notifications || quitting) return;
            const agenda = await calendar.snapshot();
            await deliverReminders(
              reminders(snapshot.overview, agenda.events, new Date()),
              receipts,
              (reminder) => {
                const notice = new Notification({ title: reminder.title, body: reminder.body });
                notice.on('click', () => {
                  window?.show();
                  window?.focus();
                });
                notice.show();
              },
              new Date(),
              () => settings.notifications && !quitting,
            );
          })
          .catch(() => log('notifications:check', 'INTERNAL'))
          .finally(() => {
            checking = false;
          });
      }, 60000);
    })
    .catch(() => {
      log('startup', 'INTERNAL');
      dialog.showErrorBox(
        'No se pudo iniciar QA Assistant',
        'No se pudo abrir o migrar la base de datos local. Tus datos no se han eliminado. Revisa los permisos de la carpeta de datos y vuelve a intentar.',
      );
      app.quit();
    });
}
