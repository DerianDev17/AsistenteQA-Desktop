import type { MailMessage } from '../../domain/email';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { unwrap } from '../hooks/useWorkspace';
import { Empty, ErrorNotice, Panel } from './ui';

const load = () => unwrap(window.qa.mail.suggestions());
export function ActivitySuggestions({
  onReview,
  busy,
  compact = false,
}: {
  onReview: (message: MailMessage) => void;
  busy: boolean;
  compact?: boolean;
}) {
  const { data, error } = useLiveQuery(load);
  return (
    <Panel
      title="Actividades sugeridas por correo"
      icon="check"
      className={compact ? 'compact-suggestions' : ''}
    >
      <p className="activity-intro">
        Certificaciones y proyectos detectados en los 150 correos locales más recientes. Son
        propuestas para revisar; no se guardan como tareas automáticamente.
      </p>
      {error && <ErrorNotice message={error} />}
      {!data && !error && <p className="loading">Buscando posibles actividades…</p>}
      {data && !data.length && (
        <Empty title="Sin nuevas propuestas de correo" icon="mail">
          Las tareas ya creadas se excluyen de las sugerencias.
        </Empty>
      )}
      <div className="suggestion-list">
        {data?.slice(0, compact ? 3 : 10).map((item) => (
          <article key={item.message.id}>
            <div>
              <span className="badge">
                {item.category === 'CERTIFICATION' ? 'Certificación' : 'Proyecto'}
              </span>
              <strong>{item.message.subject}</strong>
              <p>{item.reason}</p>
              <small>{item.message.senderName || item.message.sender}</small>
            </div>
            <button
              className="secondary small"
              disabled={busy}
              onClick={() => onReview(item.message)}
            >
              Revisar actividad
            </button>
          </article>
        ))}
      </div>
    </Panel>
  );
}
