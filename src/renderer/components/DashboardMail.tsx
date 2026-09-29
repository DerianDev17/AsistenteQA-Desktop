import { useState } from 'react';
import { useMailSummary } from '../hooks/useMailSummary';
import { Empty, ErrorNotice, Panel, relativeDate } from './ui';
import { MailList, MailPreview } from './MailMessages';

export function DashboardMail({ onOpenInbox }: { onOpenInbox: () => void }) {
  const { data, error, working, refresh, sync } = useMailSummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const status = data?.status;
  const busy = working || !!status?.busy;
  const messages = data?.inbox.messages.slice(0, 5) ?? [];
  const selected = messages.find((message) => message.id === selectedId);
  return (
    <Panel
      title="Correo institucional"
      icon="mail"
      className="dashboard-mail"
      action={
        <button className="text-button accent" onClick={onOpenInbox}>
          Ver correos
        </button>
      }
    >
      {!data && !error && (
        <div className="loading" role="status">
          Cargando resumen del correo…
        </div>
      )}
      {error && <ErrorNotice message={error} />}
      {error && (
        <button className="text-button accent mail-retry" onClick={() => void refresh()}>
          Actualizar estado del correo
        </button>
      )}
      {status && !status.connected && (
        <Empty title="Conecta tu correo institucional" icon="mail">
          <button className="text-button accent" onClick={onOpenInbox}>
            Configurar Microsoft 365
          </button>
        </Empty>
      )}
      {data && status?.connected && (
        <>
          <div className="mail-connection-summary">
            <div>
              <strong>{status.address}</strong>
              <p>
                {status.lastSyncedAt
                  ? `Última sincronización: ${relativeDate(status.lastSyncedAt)}`
                  : 'Aún no se ha completado una sincronización'}
              </p>
              <p>
                {status.config?.autoSync
                  ? 'Sincronización automática cada 5 minutos'
                  : 'Sincronización manual'}
              </p>
            </div>
            <span className={`badge ${!busy && !status.needsReconnect ? 'badge-completed' : ''}`}>
              {status.needsReconnect
                ? 'Requiere autorización'
                : busy
                  ? 'Operación en curso…'
                  : 'Conectado'}
            </span>
          </div>
          <div className="mail-dashboard-count">
            <strong>
              {data.inbox.total}{' '}
              {data.inbox.total === 1 ? 'correo descargado' : 'correos descargados'}
            </strong>
            <span className="muted">
              Bandeja de entrada · últimos 30 días · hasta 5 más recientes
            </span>
          </div>
          {status.needsReconnect && (
            <p className="mail-more">
              Renueva el acceso desde Correos para continuar sincronizando.
            </p>
          )}
          {status.hasMore && (
            <p className="mail-more">
              La descarga está incompleta. Sincroniza de nuevo para continuar.
            </p>
          )}
          {messages.length ? (
            <MailList messages={messages} onSelect={(message) => setSelectedId(message.id)} />
          ) : (
            <Empty
              title={
                status.lastSyncedAt && !status.hasMore
                  ? 'Sin correos recientes en la bandeja'
                  : 'Todavía no hay correos descargados'
              }
              icon="mail"
            >
              {status.lastSyncedAt && !status.hasMore
                ? 'No hay mensajes de los últimos 30 días en la copia local.'
                : 'La cuenta está conectada. Sincroniza para descargar los mensajes.'}
            </Empty>
          )}
          <div className="panel-footer">
            <span>Los correos todavía no generan tareas automáticamente.</span>
            {status.needsReconnect ? (
              <button className="secondary small" onClick={onOpenInbox}>
                Renovar acceso
              </button>
            ) : (
              <button className="secondary small" disabled={busy} onClick={() => void sync()}>
                {working || status.busy === 'sync'
                  ? 'Sincronizando…'
                  : status.hasMore
                    ? 'Continuar sincronización'
                    : 'Sincronizar correo'}
              </button>
            )}
          </div>
        </>
      )}
      {selected && <MailPreview message={selected} onClose={() => setSelectedId(null)} />}
    </Panel>
  );
}
