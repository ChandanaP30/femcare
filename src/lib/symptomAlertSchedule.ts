/**
 * Picks when to show the system notification for a symptom-pattern alert.
 * It is never immediate: it waits for the next morning slot that is at least
 * `minLeadMinutes` away, skips quiet hours, and gives up (returns null) if that
 * time would fall after the day the period is expected.
 */
export interface ScheduleOpts {
  hour?: number;
  minLeadMinutes?: number;
}

export function pickNotificationTime(
  now: Date,
  periodDate: Date,
  isQuiet: (hour: number, minute: number) => boolean,
  opts: ScheduleOpts = {},
): Date | null {
  const hour = opts.hour ?? 9;
  const minLead = opts.minLeadMinutes ?? 60;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (at.getTime() < now.getTime() + minLead * 60_000) at.setDate(at.getDate() + 1);
  for (let i = 0; i < 24 && isQuiet(at.getHours(), at.getMinutes()); i++) at.setHours(at.getHours() + 1);
  if (isQuiet(at.getHours(), at.getMinutes())) return null;
  const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth(), periodDate.getDate(), 23, 59, 59, 999);
  return at.getTime() <= periodEnd.getTime() ? at : null;
}
