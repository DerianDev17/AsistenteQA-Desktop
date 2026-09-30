import { eventsOnDay, type CalendarEvent } from './calendar';
import type { Task } from './models';
import { isOverdue, todayTasks } from './overview';

export type DayActivity =
  | { kind: 'task'; task: Task; time: string; overdue: boolean }
  | { kind: 'meeting'; meeting: CalendarEvent; time: string; overdue: false };

export function dayPlan(tasks: Task[], events: CalendarEvent[], day: string): DayActivity[] {
  const start = new Date(`${day}T00:00:00`).getTime();
  const entries: DayActivity[] = [
    ...todayTasks(tasks, day).map((task) => ({
      kind: 'task' as const,
      task,
      time: task.dueTime ?? '',
      overdue: isOverdue(task, day),
    })),
    ...eventsOnDay(events, day).map((meeting) => ({
      kind: 'meeting' as const,
      meeting,
      time:
        meeting.allDay || Date.parse(meeting.start) < start
          ? '00:00'
          : new Date(meeting.start).toTimeString().slice(0, 5),
      overdue: false as const,
    })),
  ];
  return entries.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) || (a.time || '99:99').localeCompare(b.time || '99:99'),
  );
}
