import { useRef, useState } from 'react';
import type { Settings } from '../../domain/models';
import type { CalendarSnapshot } from '../../domain/calendar';
import type { useMailSummary } from '../hooks/useMailSummary';
import { unwrap } from '../hooks/useWorkspace';
import { ErrorNotice, Panel, relativeDate } from './ui';

export function DashboardAutomation({
  settings,
  mail,
  calendar,
  onSettings,
  onRefresh,
  onMail,
}: {
  settings: Settings;
  mail: ReturnType<typeof useMailSummary>;
  calendar: CalendarSnapshot | null;
  onSettings: (settings: Settings) => Promise<void>;
  onRefresh: () => Promise<unknown>;
  onMail: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<{
    field: 'autoSync' | 'notifications' | 'minimizeToTray';
    value: boolean;
  } | null>(null);
  const running = useRef(false);
  const status = mail.data?.status;
  const busy = working || mail.working || !!status?.busy || !!calendar?.busy;
  const run = async (
    operation: () => Promise<unknown>,
    message: string,
    next: typeof pending = null,
  ) => {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setError('');
    setNotice('');
    setPending(next);
    try {
      await operation();
      setNotice(message);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo actualizar la automatización.',
      );
    } finally {
      await onRefresh();
      setPending(null);
      setWorking(false);
      running.current = false;
    }
  };
  const sync = async () => {
    const errors: string[] = [];
    // Both integrations share the account lock. Finish mail before starting calendar.
    if (status?.connected && !status.needsReconnect) {
      try {
        await unwrap(window.qa.mail.sync());
      } catch (reason) {
        errors.push(reason instanceof Error ? reason.message : 'No se pudo sincronizar el correo.');
      }
    }
    if (calendar?.enabled && !calendar.needsReconnect) {
      try {
        await unwrap(window.qa.calendar.sync());
      } catch (reason) {
        errors.push(reason instanceof Error ? reason.message : 'No se pudo sincronizar la agenda.');
      }
    }
    if (errors.length) throw new Error(errors.join(' '));
  };
  return (
    <Panel title="Automatizaciones" icon="settings" className="dashboard-automation">
      <label className="automation-toggle">
        <span>
          <strong>Correo y agenda</strong>
          <small>Sincronizar cada 5 minutos</small>
        </span>
        <input
          type="checkbox"
          aria-label="Sincronización automática de correo y agenda"
          checked={
            pending?.field === 'autoSync' ? pending.value : (status?.config?.autoSync ?? false)
          }
          disabled={busy || !status?.config}
          onChange={(e) => {
            const config = status?.config;
            const value = e.currentTarget.checked;
            if (config)
              void run(
                () => unwrap(window.qa.mail.configure({ ...config, autoSync: value })),
                'Sincronización actualizada.',
                { field: 'autoSync', value },
              );
          }}
        />
      </label>
      <label className="automation-toggle">
        <span>
          <strong>Recordatorios</strong>
          <small>Reuniones, vencidas y seguimientos</small>
        </span>
        <input
          type="checkbox"
          aria-label="Recordatorios automáticos"
          checked={pending?.field === 'notifications' ? pending.value : settings.notifications}
          disabled={busy}
          onChange={(e) => {
            const value = e.currentTarget.checked;
            void run(
              () => onSettings({ ...settings, notifications: value }),
              'Recordatorios actualizados.',
              { field: 'notifications', value },
            );
          }}
        />
      </label>
      <label className="automation-toggle">
        <span>
          <strong>Seguir en segundo plano</strong>
          <small>Al cerrar, mantener en la bandeja</small>
        </span>
        <input
          type="checkbox"
          aria-label="Mantener automatizaciones en segundo plano"
          checked={pending?.field === 'minimizeToTray' ? pending.value : settings.minimizeToTray}
          disabled={busy}
          onChange={(e) => {
            const value = e.currentTarget.checked;
            void run(
              () => onSettings({ ...settings, minimizeToTray: value }),
              'Preferencia guardada.',
              { field: 'minimizeToTray', value },
            );
          }}
        />
      </label>
      <p className="automation-note">
        Avisos de reunión 10 minutos antes. Las reglas funcionan mientras la app está abierta.
      </p>
      {error && <ErrorNotice message={error} />}
      {notice && (
        <p className="automation-feedback" role="status">
          {notice}
        </p>
      )}
      <div className="automation-sync">
        <small>
          {status?.lastSyncedAt
            ? `Correo: ${relativeDate(status.lastSyncedAt)}`
            : 'Correo sin sincronizar'}
          <br />
          {calendar?.lastSyncedAt
            ? `Agenda: ${relativeDate(calendar.lastSyncedAt)}`
            : 'Agenda sin sincronizar'}
        </small>
        {status?.connected &&
        (!status.needsReconnect || (calendar?.enabled && !calendar.needsReconnect)) ? (
          <button
            className="secondary small"
            disabled={busy}
            onClick={() => void run(sync, 'Copia local actualizada.')}
          >
            {working ? 'Actualizando…' : 'Actualizar todo'}
          </button>
        ) : (
          <button className="secondary small" onClick={onMail}>
            Configurar conexión
          </button>
        )}
      </div>
    </Panel>
  );
}
