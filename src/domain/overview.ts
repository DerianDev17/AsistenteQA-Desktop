import { isOpen, type Project, type Task } from './models';

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export const isOverdue = (task: Task, today: string) =>
  isOpen(task) && task.dueDate !== null && task.dueDate < today;
export const needsNextAction = (project: Project) =>
  isOpen(project) &&
  !project.nextAction &&
  !['BLOCKED', 'WAITING_THIRD_PARTY'].includes(project.status);
export function todayTasks(tasks: Task[], today: string): Task[] {
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return tasks
    .filter(
      (task) =>
        isOpen(task) &&
        (task.dueDate === today || isOverdue(task, today) || task.status === 'BLOCKED'),
    )
    .sort(
      (a, b) =>
        Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
        (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') ||
        order[a.priority] - order[b.priority] ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
export function overview(
  projects: Project[],
  tasks: Task[],
  today: string,
  followUpDays: number,
  now: Date,
) {
  const activeProjects = projects.filter(isOpen);
  const cutoff = now.getTime() - followUpDays * 86400000;
  const followUps = tasks.filter(
    (task) =>
      task.status === 'WAITING' &&
      task.waitingFor !== 'USER' &&
      Date.parse(task.updatedAt) <= cutoff &&
      (!task.projectId || activeProjects.some((project) => project.id === task.projectId)),
  );
  return {
    today: todayTasks(tasks, today),
    activeProjects,
    overdue: tasks.filter((task) => isOverdue(task, today)),
    attentionProjects: activeProjects.filter(
      (project) => project.status === 'BLOCKED' || needsNextAction(project),
    ),
    blocked: tasks.filter((task) => task.status === 'BLOCKED'),
    completedToday: tasks.filter(
      (task) => task.completedAt && localDate(new Date(task.completedAt)) === today,
    ),
    followUps,
  };
}
export type Overview = ReturnType<typeof overview>;
