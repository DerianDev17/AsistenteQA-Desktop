import type { Reminder } from '../domain/reminders';

export interface ReminderReceipts {
  claim(key: string, at: string): Promise<boolean>;
  prune(before: string): Promise<void>;
}

// Claim before delivery: restarting or simultaneous checks cannot repeat a reminder.
export async function deliverReminders(
  reminders: Reminder[],
  receipts: ReminderReceipts,
  deliver: (reminder: Reminder) => void,
  now: Date,
  enabled: () => boolean,
) {
  await receipts.prune(new Date(now.getTime() - 32 * 86400000).toISOString());
  for (const reminder of reminders) {
    if (!enabled()) return;
    if (await receipts.claim(reminder.key, now.toISOString())) {
      if (!enabled()) return;
      deliver(reminder);
    }
  }
}
