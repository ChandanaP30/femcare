/**
 * Stage 2 glue, pure and free of Supabase / Capacitor imports so it can be tested alone.
 * Maps the app's reminder preferences onto the Smart Alert scheduler, shapes what is stored
 * with each alert, and decides when a stored alert becomes a notification or a Home card.
 */
import { pushOutOfQuietHours, type SmartAlertDecision, type SmartAlertPreferences } from './symptomAlertScheduler';

/** A notification the reminder system should schedule. */
export interface SmartAlertSlot {
  at: Date;
  body: string;
}

/** The slice of the app's ReminderPrefs that Smart Alerts care about. */
export interface SmartPrefsSource {
  master: boolean;
  smartAlerts?: boolean;
  smartAlertTips?: boolean;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

/** Same hour the existing period reminder uses. Tunable design value. */
export const SMART_ALERT_TIME = '09:00';
/** A card stops showing this long after the alert was created. */
export const CARD_MAX_AGE_DAYS = 7;

export function toSmartPrefs(p: SmartPrefsSource): SmartAlertPreferences {
  return {
    enabled: !!p.master && !!p.smartAlerts,
    prepReminders: p.smartAlertTips ?? true,
    maxPerCycle: 1,
    quietHours: { enabled: p.quietEnabled, start: p.quietStart, end: p.quietEnd },
    preferredTime: SMART_ALERT_TIME,
  };
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Start date of the cycle in progress: the latest period start on or before today. */
export function currentCycleStart(periods: Array<{ start_date?: string | null }>, today: string): string | null {
  let best: string | null = null;
  for (const p of periods) {
    const s = p?.start_date;
    if (typeof s !== 'string') continue;
    const day = s.slice(0, 10);
    if (day <= today && (best === null || day > best)) best = day;
  }
  return best;
}

/** Stored in symptom_alerts.evidence so the card can explain itself later. */
export interface SmartAlertEvidence {
  v: 1;
  deliverAt: string;
  title: string;
  body: string;
  notificationBody: string;
  observed: string[];
  prep: string[];
  caution: string;
}

export function buildEvidence(d: Extract<SmartAlertDecision, { action: 'schedule' }>): SmartAlertEvidence {
  return {
    v: 1,
    deliverAt: d.deliverAt.toISOString(),
    title: d.text.title,
    body: d.text.body,
    notificationBody: d.text.notificationBody,
    observed: d.text.observed,
    prep: d.text.prep,
    caution: d.text.caution,
  };
}

export interface AlertRow {
  id: string;
  cycle_key: string;
  matched: string[];
  level: 'possible' | 'strong';
  evidence: unknown;
  predicted_days: number | null;
  created_at: string;
  seen_at: string | null;
  dismissed_at: string | null;
}

export function readEvidence(raw: unknown): SmartAlertEvidence | null {
  const e = raw as Partial<SmartAlertEvidence> | null;
  if (!e || typeof e !== 'object') return null;
  if (typeof e.deliverAt !== 'string' || typeof e.notificationBody !== 'string' || typeof e.body !== 'string') return null;
  return {
    v: 1,
    deliverAt: e.deliverAt,
    title: typeof e.title === 'string' ? e.title : 'A pattern from your past cycles',
    body: e.body,
    notificationBody: e.notificationBody,
    observed: Array.isArray(e.observed) ? e.observed.filter((x): x is string => typeof x === 'string') : [],
    prep: Array.isArray(e.prep) ? e.prep.filter((x): x is string => typeof x === 'string') : [],
    caution: typeof e.caution === 'string' ? e.caution : '',
  };
}

/**
 * The notification for an alert that already exists. Rebuilt on every sync, because the
 * reminder system cancels and reschedules everything. Returns null once it is dismissed,
 * already due, or unreadable. Quiet hours are re-applied in case the user changed them.
 */
export function slotFromAlert(row: AlertRow, now: Date, prefs: SmartAlertPreferences): SmartAlertSlot | null {
  if (row.dismissed_at) return null;
  const ev = readEvidence(row.evidence);
  if (!ev) return null;
  const at = new Date(ev.deliverAt);
  if (Number.isNaN(at.getTime())) return null;
  const moved = pushOutOfQuietHours(at, prefs.quietHours);
  if (moved.getTime() <= now.getTime()) return null;
  return { at: moved, body: ev.notificationBody };
}

/** The Home card appears only once the alert's delivery time has arrived, never right after logging. */
export function isCardVisible(row: AlertRow | null, now: Date): boolean {
  if (!row || row.dismissed_at) return false;
  const ev = readEvidence(row.evidence);
  if (!ev) return false;
  const at = new Date(ev.deliverAt).getTime();
  const created = new Date(row.created_at).getTime();
  if (Number.isNaN(at) || Number.isNaN(created)) return false;
  if (at > now.getTime()) return false;
  return now.getTime() - created <= CARD_MAX_AGE_DAYS * 86_400_000;
}
