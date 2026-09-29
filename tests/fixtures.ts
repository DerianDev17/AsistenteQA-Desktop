import type { ProjectInput, TaskInput } from '../src/domain/models';
export const projectData: ProjectInput = {
  name: 'Proyecto de pruebas',
  code: 'QA-001',
  description: '',
  type: 'Requerimiento',
  status: 'IN_QA',
  priority: 'HIGH',
  progress: 40,
  nextAction: 'Validar resultados',
  waitingFor: 'QA',
};
export const taskData: TaskInput = {
  title: 'Validar el servicio',
  description: '',
  projectId: null,
  status: 'PENDING',
  priority: 'HIGH',
  dueDate: '2026-09-29',
  dueTime: '09:00',
  waitingFor: 'USER',
};
