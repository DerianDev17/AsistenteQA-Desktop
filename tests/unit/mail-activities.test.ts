import { expect, it } from 'vitest';
import { suggestMailActivity } from '../../src/domain/mail-activities';
import { mailContent } from '../mail-fixtures';
import { projectData } from '../fixtures';
const message = {
  ...mailContent,
  id: 'fake',
  providerId: 'fake',
  subject: 'Certificación QA-001',
  preview: 'Necesitamos validar las evidencias.',
};
const project = {
  ...projectData,
  id: 'project',
  createdAt: '',
  updatedAt: '',
  lastActivityAt: '',
  closedAt: null,
};
it('detecta certificación y vincula solo un proyecto activo con coincidencia exacta', () => {
  expect(suggestMailActivity(message, [project])).toMatchObject({
    category: 'CERTIFICATION',
    projectId: 'project',
  });
  expect(
    suggestMailActivity({ ...message, subject: 'Revisar proyecto QA-0010' }, [project])?.projectId,
  ).toBeNull();
  expect(suggestMailActivity(message, [{ ...project, status: 'COMPLETED' }])?.projectId).toBeNull();
  expect(
    suggestMailActivity(message, [project, { ...project, id: 'other' }])?.projectId,
  ).toBeNull();
});
it('omite asuntos informativos, finalizados o cancelados y mensajes sin contexto de trabajo', () => {
  for (const subject of [
    'Certificación cancelada',
    'Certificación finalizada',
    'Solo informativo: certificación',
    'Certificación: no requiere acción',
  ])
    expect(suggestMailActivity({ ...message, subject }, [project])).toBeNull();
  expect(
    suggestMailActivity(
      { ...message, subject: 'Boletín semanal', preview: 'Noticias de la oficina.' },
      [],
    ),
  ).toBeNull();
  expect(
    suggestMailActivity(
      { ...message, subject: 'Requerimiento nuevo', preview: 'Solicitamos revisar la propuesta.' },
      [],
    )?.category,
  ).toBe('PROJECT');
});
