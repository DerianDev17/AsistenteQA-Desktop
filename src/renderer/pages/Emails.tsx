import { useCallback, useEffect, useRef, useState } from 'react';
import type { MailConfig, MailMessage, MailPage, MailStatus } from '../../domain/email';
import { mailConfig } from '../../domain/email';
import { unwrap } from '../hooks/useWorkspace';
import { Empty, ErrorNotice, Modal, Panel, relativeDate } from '../components/ui';
import { Icon } from '../components/Icon';
import { MailList, MailPreview } from '../components/MailMessages';

function ConnectionForm({
  config,
  busy,
  onSave,
}: {
  config: MailConfig | null;
  busy: boolean;
  onSave: (config: MailConfig) => Promise<void>;
}) {
  const [data, setData] = useState<MailConfig>(
    config ?? { clientId: '', tenantId: '', autoSync: true },
  );
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        try {
          const valid = mailConfig(data);
          void onSave(valid);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Configuración no válida.');
        }
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        <label>
          Application (client) ID
          <input
            aria-label="Application (client) ID"
            required
            value={data.clientId}
            onChange={(e) => setData({ ...data, clientId: e.target.value })}
            placeholder="ID de la aplicación en Entra"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Directory (tenant) ID
          <input
            aria-label="Directory (tenant) ID"
            required
            value={data.tenantId}
            onChange={(e) => setData({ ...data, tenantId: e.target.value })}
            placeholder="ID del directorio de tu institución"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="wide mail-toggle">
          <input
            type="checkbox"
            checked={data.autoSync}
            onChange={(e) => setData({ ...data, autoSync: e.target.checked })}
          />
          Sincronizar automáticamente cada 5 minutos el correo y calendario autorizado mientras la
          app esté abierta
        </label>
      </fieldset>
      {error && <ErrorNotice message={error} />}
      <div className="form-footer">
        <button className="secondary" disabled={busy}>
          Guardar conexión
        </button>
      </div>
    </form>
  );
}
export function Emails({ onCreateTask }: { onCreateTask?: (message: MailMessage) => void }) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MailPage | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const requests = useRef(0);
  const invalidate = useCallback(() => {
    requests.current++;
  }, []);
  const refresh = useCallback(() => {
    const current = ++requests.current;
    return Promise.all([unwrap(window.qa.mail.status()), unwrap(window.qa.mail.list(page))]).then(
      ([nextStatus, messages]) => {
        if (current === requests.current) {
          setStatus(nextStatus);
          setData(messages);
        }
      },
      (reason) => {
        if (current === requests.current)
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar el correo.');
      },
    );
  }, [page]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      clearInterval(timer);
      invalidate();
    };
  }, [refresh, invalidate]);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la operación.');
    } finally {
      setWorking(false);
      await refresh();
    }
  };
  const busy = working || !!status?.busy;
  return (
    <div className="mail-page">
      <Panel title="Microsoft 365 · Conexión institucional" icon="mail">
        <div className="mail-connection-summary">
          <div>
            <strong>{status?.address ?? 'Conecta tu correo institucional'}</strong>
            <p>
              {status?.connected
                ? status.needsReconnect
                  ? 'Se requiere renovar la autorización de Microsoft.'
                  : `Bandeja de entrada · ${status.lastSyncedAt ? `Última sincronización: ${relativeDate(status.lastSyncedAt)}` : 'Aún no se ha completado una sincronización'}`
                : 'Autoriza el acceso de lectura en el navegador de Microsoft. Tu contraseña se introduce allí.'}
            </p>
          </div>
          <span
            className={`badge ${status?.connected && !status.needsReconnect ? 'badge-completed' : ''}`}
          >
            {status?.busy === 'connect'
              ? 'Esperando a Microsoft…'
              : status?.busy === 'sync'
                ? 'Sincronizando…'
                : status?.connected
                  ? status.needsReconnect
                    ? 'Requiere acceso'
                    : 'Conectado'
                  : 'Sin conectar'}
          </span>
        </div>
        <ConnectionForm
          key={`${status?.config?.clientId}-${status?.config?.tenantId}-${status?.config?.autoSync}`}
          config={status?.config ?? null}
          busy={busy || !status}
          onSave={(config) =>
            run(
              () => unwrap(window.qa.mail.configure(config)),
              'Configuración guardada. Ya puedes conectar la cuenta.',
            )
          }
        />
        <div className="mail-toolbar">
          <button
            className="primary"
            disabled={busy || !status?.config}
            onClick={() =>
              void run(async () => {
                await unwrap(window.qa.mail.connect());
                await unwrap(window.qa.mail.sync());
              }, 'Cuenta conectada. Revisa el estado de sincronización.')
            }
          >
            <Icon name="shield" size={16} />
            {status?.connected ? 'Volver a autorizar' : 'Conectar y sincronizar'}
          </button>
          <button
            className="secondary"
            disabled={busy || !status?.connected || status.needsReconnect}
            onClick={() =>
              void run(() => unwrap(window.qa.mail.sync()), 'Sincronización procesada.')
            }
          >
            <Icon name="mail" size={16} />
            Sincronizar ahora
          </button>
          {busy && (
            <button
              className="secondary"
              onClick={() => {
                void unwrap(window.qa.mail.cancel()).catch((reason) =>
                  setError(reason instanceof Error ? reason.message : 'No se pudo cancelar.'),
                );
              }}
            >
              Cancelar operación
            </button>
          )}
          {status?.connected && (
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Desconectar cuenta
            </button>
          )}
        </div>
        <details className="mail-help" open={!status?.config}>
          <summary>Cómo registrar la aplicación en Microsoft Entra</summary>
          <ol>
            <li>
              En el centro de administración de Microsoft Entra, entra a{' '}
              <strong>Registros de aplicaciones → Nuevo registro</strong>.
            </li>
            <li>
              Nombre: <strong>QA Assistant Desktop</strong>. Selecciona cuentas de{' '}
              <strong>este directorio organizativo</strong>.
            </li>
            <li>
              En Autenticación, agrega la plataforma{' '}
              <strong>Aplicaciones móviles y de escritorio</strong> con URI de redirección{' '}
              <code>http://localhost</code>.
            </li>
            <li>
              En Permisos de API agrega{' '}
              <strong>Microsoft Graph → Permisos delegados → Mail.Read</strong>. Si tu institución
              exige aprobación, solicítala a TI.
            </li>
            <li>
              Copia el <strong>Application (client) ID</strong> y{' '}
              <strong>Directory (tenant) ID</strong> en los campos anteriores. No crees un secreto
              de cliente.
            </li>
          </ol>
          <p>
            Si no tienes acceso al registro, TI puede crearlo y entregarte los dos identificadores.
          </p>
        </details>
        <div className="mail-privacy">
          <Icon name="shield" size={16} />
          <p>
            Solo lectura: últimos 30 días de la bandeja de entrada. Credenciales y contenido del
            correo cifrados en este equipo. No se descargan adjuntos, no se envían mensajes y no se
            envían datos a IA.
          </p>
        </div>
      </Panel>
      {(error || status?.error) && <ErrorNotice message={error || status?.error || ''} />}
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
      {status?.hasMore && (
        <p className="mail-more" role="status">
          Hay más cambios por descargar. Pulsa «Sincronizar ahora» para continuar; la sincronización
          automática también continuará si está activada.
        </p>
      )}
      <Panel
        title={`Bandeja de entrada · ${data?.total ?? 0} correos locales`}
        icon="mail"
        action={<span className="muted">Últimos 30 días</span>}
      >
        {!data ? (
          <div className="loading" role="status">
            Cargando correos…
          </div>
        ) : !data.messages.length ? (
          <Empty
            title={
              status?.connected
                ? 'Todavía no hay correos descargados'
                : 'Tu bandeja está lista para conectar'
            }
            icon="mail"
          >
            {status?.connected
              ? 'Sincroniza para importar los correos recientes de tu bandeja de entrada.'
              : 'Configura Microsoft Entra y conecta tu cuenta para ver tus correos aquí.'}
          </Empty>
        ) : (
          <MailList messages={data.messages} onSelect={setSelected} />
        )}
        <div className="panel-footer">
          <button
            className="secondary small"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} · {data?.pageSize ?? 50} por página
          </span>
          <button
            className="secondary small"
            disabled={!data || (page + 1) * data.pageSize >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </Panel>
      {selected && (
        <MailPreview
          message={selected}
          onClose={() => setSelected(null)}
          onCreateTask={
            onCreateTask &&
            ((message) => {
              setSelected(null);
              onCreateTask(message);
            })
          }
        />
      )}
      {confirm && (
        <Modal title="Desconectar Microsoft 365" busy={busy} onClose={() => setConfirm(false)}>
          <div className="confirm-content">
            <p>
              Se eliminarán las credenciales, la copia local de los correos y la agenda descargada.
              Tu buzón de Microsoft, proyectos y tareas no se modificarán.
            </p>
          </div>
          <div className="form-footer">
            <button className="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await unwrap(window.qa.mail.disconnect());
                  setConfirm(false);
                  setPage(0);
                }, 'Cuenta desconectada y copia local eliminada.')
              }
            >
              Confirmar desconexión
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
