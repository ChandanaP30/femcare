/**
 * Stage 2: decides whether a Smart Alert may be scheduled, and when.
 *
 * Pure functions. No Supabase, Capacitor or React imports, so it can be tested alone and
 * wired to the app's existing reminder code afterwards. It never touches the EWMA or
 * hierarchical prediction models: `daysUntilPeriod` is passed in as a read-only number.
 *
 * Hard rules enforced here:
 *  - Saving a symptom log never produces a notification. A notification is only ever
 *    scheduled for a later time, at least `minHoursAfterLog` after the latest log save.
 *  - An alert needs both a personal pattern match and a period estimated within `nearDays`
 *    (both checked inside evaluateCurrent).
 *  - One alert per cycle by default (canAlert), keyed on the start date of the current cycle.
 *  - Notification preferences and quiet hours are respected.
 *  - A safety notice always replaces a "period may be near" alert.
 */
import {
  evaluateCurrent, canAlert, buildAlertText, dayNum, dayStr,
  type LearnedPatterns, type LogRow, type PriorAlert, type AlertText, type PatternConfig, PATTERN_CONFIG,
} from './symptomPatterns';
import { detectSafety, type SafetyLog, type SafetyNotice } from './symptomSafety';

export interface QuietHours {
  enabled: boolean;
  /** Local "HH:MM". May wrap past midnight, e.g. 22:00 to 07:00. */
  start: string;
  end: string;
}

export interface SmartAlertPreferences {
  /** Master switch for Smart Alerts. Off means nothing is scheduled. */
  enabled: boolean;
  /** Whether the in-app card also lists gentle preparation tips. */
  prepReminders: boolean;
  maxPerCycle: 1 | 2;
  quietHours: QuietHours | null;
  /** Local "HH:MM" the notification is aimed at. */
  preferredTime: string;
}

export const DEFAULT_SMART_ALERT_PREFERENCES: SmartAlertPreferences = {
  enabled: true,
  prepReminders: true,
  maxPerCycle: 1,
  quietHours: { enabled: true, start: '22:00', end: '07:00' },
  preferredTime: '09:00',
};

/** Tunable design value, not a clinical claim. */
export const MIN_HOURS_AFTER_LOG = 6;

export type NoAlertReason =
  | 'disabled'
  | 'already_alerted_this_cycle'
  | 'too_late'
  | 'invalid_time'
  | 'not_eligible';

export type SmartAlertDecision =
  | { action: 'safety'; notices: SafetyNotice[] }
  | { action: 'none'; reason: NoAlertReason; detail?: string }
  | {
      action: 'schedule';
      deliverAt: Date;
      cycleKey: string;
      level: 'possible' | 'strong';
      matched: string[];
      daysUntilPeriod: number;
      text: AlertText;
    };

export interface DecideInput {
  patterns: LearnedPatterns;
  logs: Array<LogRow & Partial<Omit<SafetyLog, 'log_date' | 'symptoms'>>>;
  /** Local date, YYYY-MM-DD. */
  today: string;
  now: Date;
  /** Existing prediction's days until next period. Read-only. */
  daysUntilPeriod: number | null;
  /** Start date of the cycle currently in progress. Used as the per-cycle dedupe key. */
  lastPeriodStart: string;
  /** This user's earlier alerts with the same cycle_key. */
  priorAlertsThisCycle: PriorAlert[];
  prefs: SmartAlertPreferences;
  /** When the user last saved a log. Delivery is pushed at least MIN_HOURS_AFTER_LOG later. */
  lastLogSavedAt?: Date | null;
  cfg?: PatternConfig;
}

const parseHM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
};

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** True when the local time of `d` falls inside quiet hours. */
export function isQuietTime(d: Date, q: QuietHours | null): boolean {
  if (!q || !q.enabled) return false;
  const s = parseHM(q.start);
  const e = parseHM(q.end);
  if (s === null || e === null || s === e) return false;
  const m = minutesOfDay(d);
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/** At local `hm` on the same calendar day as `base`, plus `addDays`. */
function atTime(base: Date, hm: number, addDays = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, Math.floor(hm / 60), hm % 60, 0, 0);
}

/** Moves a time out of quiet hours to the moment they end. */
export function pushOutOfQuietHours(d: Date, q: QuietHours | null): Date {
  if (!isQuietTime(d, q)) return d;
  const e = parseHM(q!.end)!;
  const sameDay = atTime(d, e, 0);
  return sameDay.getTime() > d.getTime() ? sameDay : atTime(d, e, 1);
}

/**
 * Earliest allowed delivery time: the preferred time of day, strictly after the
 * log-gap threshold, then moved out of quiet hours. Never returns `now` itself.
 */
export function pickDeliveryTime(now: Date, prefs: SmartAlertPreferences, lastLogSavedAt?: Date | null): Date | null {
  const pref = parseHM(prefs.preferredTime);
  if (pref === null) return null;
  let earliest = now.getTime();
  if (lastLogSavedAt && !Number.isNaN(lastLogSavedAt.getTime())) {
    earliest = Math.max(earliest, lastLogSavedAt.getTime() + MIN_HOURS_AFTER_LOG * 3_600_000);
  }
  let candidate = atTime(now, pref, 0);
  for (let i = 0; candidate.getTime() <= earliest && i < 4; i++) candidate = atTime(now, pref, i + 1);
  return pushOutOfQuietHours(candidate, prefs.quietHours);
}

export function decideSmartAlert(input: DecideInput): SmartAlertDecision {
  const cfg = input.cfg ?? PATTERN_CONFIG;

  // Safety comes first and does not depend on the Smart Alerts switch: a person who logged
  // severe pain or self-harm wording should see support, never a "period may be near" tip.
  const notices = detectSafety(input.logs, input.today);
  if (notices.length > 0) return { action: 'safety', notices };

  if (!input.prefs.enabled) return { action: 'none', reason: 'disabled' };

  const ev = evaluateCurrent(input.patterns, input.logs, input.today, input.daysUntilPeriod, cfg);
  if (!ev.eligible) return { action: 'none', reason: 'not_eligible', detail: ev.reason };

  const matched = ev.matched.map((m) => m.symptom);
  if (!canAlert(input.priorAlertsThisCycle, matched, input.prefs.maxPerCycle, input.now.toISOString())) {
    return { action: 'none', reason: 'already_alerted_this_cycle' };
  }

  const deliverAt = pickDeliveryTime(input.now, input.prefs, input.lastLogSavedAt);
  if (!deliverAt) return { action: 'none', reason: 'invalid_time' };

  // Do not notify after the estimated period day has passed.
  const deadline = atTime(input.now, 0, ev.daysUntilPeriod! + 1);
  if (deliverAt.getTime() >= deadline.getTime()) return { action: 'none', reason: 'too_late' };

  return {
    action: 'schedule',
    deliverAt,
    cycleKey: dayStr(dayNum(input.lastPeriodStart)),
    level: ev.level as 'possible' | 'strong',
    matched,
    daysUntilPeriod: ev.daysUntilPeriod!,
    text: buildAlertText(ev, { prepReminders: input.prefs.prepReminders }),
  };
}
