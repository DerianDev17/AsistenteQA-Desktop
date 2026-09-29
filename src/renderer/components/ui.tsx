import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export const labels: Record<string, string> = {
  NEW: 'Nuevo',
  ANALYSIS: 'En análisis',
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En progreso',
  IN_QA: 'En QA',
  WAITING_THIRD_PARTY: 'Esperando tercero',
  BLOCKED: 'Bloqueado',
  PENDING: 'Pendiente',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  WAITING: 'Esperando',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  USER: 'Yo',
  QA: 'QA',
  DEVELOPMENT: 'Desarrollo',
  INFRASTRUCTURE: 'Infraestructura',
  PROVIDER: 'Proveedor',
  ENTITY: 'Entidad',
  PRODUCT: 'Producto',
  SECURITY: 'Seguridad',
  OTHER: 'Otro',
};
export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value.toLowerCase()}`}>{labels[value] ?? value}</span>;
}
export function Empty({
  title,
  children,
  icon = 'folder',
}: {
  title: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Panel({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon: IconName;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>
          <Icon name={icon} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar formulario"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error" role="alert">
      <Icon name="alert" />
      {message}
    </div>
  );
}
export function relativeDate(value: string) {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
