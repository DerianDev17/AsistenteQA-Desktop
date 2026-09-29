import type { MailMessage } from '../../domain/email';
import { Modal, relativeDate } from './ui';
export function MailList({
  messages,
  onSelect,
}: {
  messages: MailMessage[];
  onSelect: (message: MailMessage) => void;
}) {
  return (
    <div className="mail-list">
      {messages.map((message) => (
        <button
          className={`mail-item ${message.isRead ? '' : 'unread'}`}
          key={message.id}
          onClick={() => onSelect(message)}
        >
          <span className="mail-avatar">
            {(message.senderName || message.sender || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="mail-item-content">
            <span className="mail-item-top">
              <strong>{message.senderName || message.sender || 'Remitente no disponible'}</strong>
              <small>{relativeDate(message.receivedAt)}</small>
            </span>
            <span className="mail-subject">
              {message.subject}
              {message.importance === 'high' && (
                <span className="badge badge-high">Importante</span>
              )}
              {!message.isRead && <span className="dot blue" />}
            </span>
            <span className="mail-preview">{message.preview || 'Sin vista previa'}</span>
          </span>
          {message.hasAttachments && (
            <span className="muted" title="Contiene adjuntos">
              Adj.
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
export function MailPreview({
  message,
  onClose,
  onCreateTask,
}: {
  message: MailMessage;
  onClose: () => void;
  onCreateTask?: (message: MailMessage) => void;
}) {
  return (
    <Modal title="Vista previa del correo" onClose={onClose}>
      <div className="mail-detail">
        <h3>{message.subject}</h3>
        <p className="muted">
          {message.senderName} {message.sender && `‹${message.sender}›`}
        </p>
        <p className="muted">{relativeDate(message.receivedAt)}</p>
        <p className="mail-detail-preview">
          {message.preview || 'Este correo no tiene vista previa.'}
        </p>
        <p className="integration-note">
          Esta vista no marca el correo como leído en Outlook. Consulta el contenido completo y los
          adjuntos desde tu cliente institucional.
        </p>
      </div>
      {onCreateTask && (
        <div className="form-footer">
          <button className="primary" onClick={() => onCreateTask(message)}>
            Crear tarea desde correo
          </button>
        </div>
      )}
    </Modal>
  );
}
