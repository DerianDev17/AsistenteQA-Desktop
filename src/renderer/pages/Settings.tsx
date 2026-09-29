import { useState } from 'react';
import type { Settings as SettingsModel } from '../../domain/models';
import { ErrorNotice, Panel } from '../components/ui';

export function Settings({
  settings,
  onSave,
}: {
  settings: SettingsModel;
  onSave: (settings: SettingsModel) => Promise<void>;
}) {
  const [data, setData] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <Panel title="Preferencias de tu espacio" icon="settings">
      <form
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setSaved(false);
          try {
            await onSave(data);
            setSaved(true);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'No se pudo guardar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="setting-row">
          <span>
            <strong>Mantener activo en segundo plano</strong>
            <small>
              Al cerrar la ventana, la aplicación permanece en la bandeja del sistema. Usa «Salir»
              para cerrarla por completo.
            </small>
          </span>
          <input
            type="checkbox"
            checked={data.minimizeToTray}
            onChange={(e) => setData({ ...data, minimizeToTray: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>
            <strong>Notificaciones de tareas vencidas</strong>
            <small>
              Un recordatorio diario mientras la aplicación está abierta. La revisión se realiza
              cada minuto.
            </small>
          </span>
          <input
            type="checkbox"
            checked={data.notifications}
            onChange={(e) => setData({ ...data, notifications: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>
            <strong>Días antes de sugerir seguimiento</strong>
            <small>Para tareas en espera de un tercero y sin actualizaciones.</small>
          </span>
          <input
            type="number"
            min={1}
            max={30}
            required
            value={data.followUpDays}
            onChange={(e) => setData({ ...data, followUpDays: Number(e.target.value) })}
          />
        </label>
        {error && <ErrorNotice message={error} />}
        <div className="form-footer">
          {saved && (
            <span role="status" className="success-text">
              Preferencias guardadas
            </span>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </div>
        <div className="integration-note">
          <strong>Versión 0.1 · Núcleo local</strong>
          <p>
            Proyectos y tareas disponibles sin conexión. La base de datos se guarda en la carpeta de
            datos de QA Assistant Desktop del usuario de Windows. Las integraciones externas aún no
            están conectadas.
          </p>
        </div>
      </form>
    </Panel>
  );
}
