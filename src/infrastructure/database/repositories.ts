import {
  Prisma,
  type PrismaClient,
  type Project as ProjectRow,
  type Task as TaskRow,
} from '@prisma/client';
import type {
  ProjectRepository,
  TaskRepository,
  SettingsRepository,
} from '../../domain/repositories';
import { defaultSettings, type Project, type Task } from '../../domain/models';
import { AppError, projectInput, taskInput, settingsInput } from '../../domain/validation';

function projectFromRow(row: ProjectRow): Project {
  const { id, createdAt, updatedAt, lastActivityAt, closedAt, ...input } = row;
  return { ...projectInput(input), id, createdAt, updatedAt, lastActivityAt, closedAt };
}
function taskFromRow(row: TaskRow): Task {
  const { id, source, sourceReference, createdAt, updatedAt, completedAt, ...input } = row;
  if (source !== 'MANUAL')
    throw new AppError('INTERNAL', 'Origen de tarea no soportado en esta versión.');
  return { ...taskInput(input), id, source, sourceReference, createdAt, updatedAt, completedAt };
}
export function repositories(db: PrismaClient): {
  projects: ProjectRepository;
  tasks: TaskRepository;
  settings: SettingsRepository;
} {
  return {
    projects: {
      list: async () =>
        (await db.project.findMany({ orderBy: { updatedAt: 'desc' } })).map(projectFromRow),
      get: async (id) => {
        const row = await db.project.findUnique({ where: { id } });
        return row && projectFromRow(row);
      },
      save: async (project) =>
        projectFromRow(
          await db.project.upsert({ where: { id: project.id }, create: project, update: project }),
        ),
      delete: async (id) => {
        try {
          await db.project.delete({ where: { id } });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
            throw new AppError(
              'CONFLICT',
              'Este proyecto tiene tareas vinculadas. Desvincúlalas antes de eliminarlo o finaliza el proyecto para conservar su historial.',
            );
          throw error;
        }
      },
    },
    tasks: {
      list: async () =>
        (await db.task.findMany({ orderBy: { updatedAt: 'desc' } })).map(taskFromRow),
      get: async (id) => {
        const row = await db.task.findUnique({ where: { id } });
        return row && taskFromRow(row);
      },
      save: async (task) =>
        db.$transaction(async (tx) => {
          const previous = await tx.task.findUnique({ where: { id: task.id } });
          const row = await tx.task.upsert({ where: { id: task.id }, create: task, update: task });
          const projectIds = [
            ...new Set(
              [previous?.projectId, task.projectId].filter((key): key is string => Boolean(key)),
            ),
          ];
          await tx.project.updateMany({
            where: { id: { in: projectIds } },
            data: { lastActivityAt: task.updatedAt },
          });
          return taskFromRow(row);
        }),
      delete: async (id) => {
        await db.$transaction(async (tx) => {
          const task = await tx.task.delete({ where: { id } });
          if (task.projectId)
            await tx.project.update({
              where: { id: task.projectId },
              data: { lastActivityAt: new Date().toISOString() },
            });
        });
      },
    },
    settings: {
      get: async () => {
        const row = await db.settings.findUnique({ where: { id: 1 } });
        return row
          ? settingsInput({
              minimizeToTray: row.minimizeToTray,
              notifications: row.notifications,
              followUpDays: row.followUpDays,
            })
          : { ...defaultSettings };
      },
      save: async (settings) => {
        await db.settings.upsert({
          where: { id: 1 },
          create: { id: 1, ...settings },
          update: settings,
        });
        return settings;
      },
    },
  };
}
