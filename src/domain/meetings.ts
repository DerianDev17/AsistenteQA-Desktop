import type { CalendarEvent } from './calendar';
import { isOpen, type Project, type Task } from './models';

export type MeetingFilter = 'all' | 'teams' | 'unanswered';

export function upcomingMeetings(
  events: CalendarEvent[],
  now: Date,
  filter: MeetingFilter = 'all',
  query = '',
) {
  const search = query.trim().toLocaleLowerCase('es');
  return events
    .filter(
      (event) =>
        !event.allDay &&
        Date.parse(event.end) > now.getTime() &&
        (filter !== 'teams' || !!event.teamsUrl) &&
        (filter !== 'unanswered' || event.response === 'notResponded') &&
        [event.subject, event.organizer, event.location]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search),
    )
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

export function meetingInProgress(event: CalendarEvent, now: Date) {
  return Date.parse(event.start) <= now.getTime() && Date.parse(event.end) > now.getTime();
}

const normalize = (value: string) =>
  ` ${value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

export function suggestedMeetingProjects(event: CalendarEvent, projects: Project[]) {
  const subject = normalize(event.subject);
  return projects
    .filter(isOpen)
    .filter((project) =>
      [project.code, project.name].some(
        (value) => value.trim().length >= 4 && subject.includes(normalize(value)),
      ),
    );
}

export function meetingTasks(projectId: string, tasks: Task[]) {
  const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return tasks
    .filter((task) => task.projectId === projectId && isOpen(task))
    .sort(
      (a, b) =>
        priority[a.priority] - priority[b.priority] ||
        (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
        a.title.localeCompare(b.title, 'es'),
    );
}
