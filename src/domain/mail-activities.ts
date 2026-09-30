import type { MailMessage } from './email';
import { isOpen, type Project } from './models';

export interface MailActivitySuggestion {
  message: MailMessage;
  category: 'CERTIFICATION' | 'PROJECT';
  reason: string;
  projectId: string | null;
  projectName: string | null;
}
const normalized = (value: string) =>
  ` ${value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
export function suggestMailActivity(
  message: MailMessage,
  projects: Project[],
): MailActivitySuggestion | null {
  const subject = normalized(message.subject);
  const text = normalized(`${message.subject} ${message.preview}`);
  if (
    /\b(cancelad[oa]|anulad[oa]|finalizad[oa]|completad[oa])\b/.test(subject) ||
    /\b(solo informativo|no requiere accion|sin accion requerida)\b/.test(subject)
  )
    return null;
  const matches = projects
    .filter(isOpen)
    .filter((project) =>
      [project.code, project.name].some(
        (value) => value.trim().length >= 4 && text.includes(normalized(value)),
      ),
    );
  const certification = /\b(certificacion|certificaciones|certificar|homologacion)\b/.test(text);
  const projectMail =
    /\b(proyecto|requerimiento)\b/.test(text) &&
    /\b(revisar|validar|aprobar|confirmar|ejecutar|pendiente|solicitamos|necesitamos|requiere)\b/.test(
      text,
    );
  if (!certification && !matches.length && !projectMail) return null;
  const project = matches.length === 1 ? matches[0] : null;
  return {
    message,
    category: certification ? 'CERTIFICATION' : 'PROJECT',
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    reason: project
      ? `Coincide con ${project.code || project.name}. Revisa la acción antes de guardar.`
      : matches.length > 1
        ? 'Coincide con varios proyectos; elige el correcto al revisar.'
        : certification
          ? 'Menciona una certificación u homologación. Revisa si requiere trabajo.'
          : 'Menciona una acción de proyecto o requerimiento. Revisa el contexto.',
  };
}
