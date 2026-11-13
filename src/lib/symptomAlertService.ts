import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/lib/supabase';
import { getNotificationPermission, isInQuietHours, loadReminderPrefs } from '@/lib/reminders';
import { loadSymptomAlertSettings } from './symptomAlertSettings';
import {
  buildAlertText,
  canAlert,
  evaluateCurrent,
  learnPatterns,
  type AlertText,
  type EvalReason,
  type LogRow,
  type PeriodRow,
} from './symptomPatterns';
import { detectSafety, type SafetyLog, type SafetyNotice } from './symptomSafety';
import { pickNotificationTime } from './symptomAlertSchedule';

// Outside the ID ranges used by reminders.ts, so reminder syncs never cancel or overwrite it.
const NOTIFICATION_ID = 500;
const CHANNEL_ID = 'symptom-alerts';

export interface EvidenceRow {
  symptom: string;
  cyclesSeen: number;
  cyclesObserved: number;
  typicalLeadDays: number;
  seenInCycles: string[];
}

export type AlertState =
  | { kind: 'off' }
  | { kind: 'dismissed' }
  | { kind: 'safety'; notices: SafetyNotice[] }
  | { kind: 'none'; reason: EvalReason; usableCycles: number }
  | { kind: 'alert'; alertId: string | null; level: 'possible' | 'strong'; text: AlertText; evidence: EvidenceRow[] };

export interface StoredAlert {
  id: string;
  created_at: string;
  matched: string[];
  level: 'possible' | 'strong';
  evidence: { matched?: EvidenceRow[] } | null;
  predicted_days: number | null;
}

type LogWithExtras = LogRow & SafetyLog;

function localDateStr(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function cancelAlertNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    /* nothing was scheduled */
  }
}

async function scheduleAlertNotification(userId: string, now: Date, daysUntil: number, body: string): Promise<void> {
  await cancelAlertNotification();
  if (!Capacitor.isNativePlatform()) return;
  try {
    const prefs = await loadReminderPrefs(userId);
    if (!prefs.master || (await getNotificationPermission()) !== 'granted') return;
    const periodDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.max(0, daysUntil));
    const when = pickNotificationTime(now, periodDate, (h, m) => isInQuietHours(h, m, prefs));
    if (!when) return;
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Symptom pattern alerts',
      description: 'A gentle heads-up when your symptoms match a pattern and your period is near',
      importance: 3,
      visibility: 0,
    });
    await LocalNotifications.schedule({
      notifications: [
        { id: NOTIFICATION_ID, title: 'FemCare+', body, channelId: CHANNEL_ID, schedule: { at: when, allowWhileIdle: true } },
      ],
    });
  } catch {
    /* the in-app card still shows; a failed system notification must not break the app */
  }
}

/**
 * Reads only this user's own data. The predicted days come from the existing cycle
 * prediction and are passed in unchanged. Symptoms alone never create an alert:
 * the estimate must also say the period is near.
 */
export async function checkSymptomAlerts(input: {
  userId: string;
  daysUntilPeriod: number | null;
  now?: Date;
}): Promise<AlertState> {
  const now = input.now ?? new Date();
  const today = localDateStr(now);

  const [settings, periodsRes, logsRes] = await Promise.all([
    loadSymptomAlertSettings(input.userId),
    supabase.from('periods').select('start_date, end_date, duration').eq('user_id', input.userId).order('start_date', { ascending: false }).limit(24),
    supabase.from('daily_logs').select('log_date, symptoms, pain_level, notes').eq('user_id', input.userId).order('log_date', { ascending: false }).limit(500),
  ]);
  if (periodsRes.error || logsRes.error) return { kind: 'none', reason: 'insufficient_history', usableCycles: 0 };

  const periods = (periodsRes.data ?? []) as unknown as PeriodRow[];
  const logs = (logsRes.data ?? []) as unknown as LogWithExtras[];

  // Safety guidance comes first and does not depend on the alert setting.
  const notices = detectSafety(logs, today);
  if (notices.length > 0) {
    await cancelAlertNotification();
    return { kind: 'safety', notices };
  }

  if (!settings.enabled) {
    await cancelAlertNotification();
    return { kind: 'off' };
  }

  const patterns = learnPatterns(periods, logs);
  const ev = evaluateCurrent(patterns, logs, today, input.daysUntilPeriod);
  if (!ev.eligible || input.daysUntilPeriod === null) {
    await cancelAlertNotification();
    return { kind: 'none', reason: ev.reason, usableCycles: ev.usableCycles };
  }

  const level: 'possible' | 'strong' = ev.level === 'strong' ? 'strong' : 'possible';
  const text = buildAlertText(ev, { prepReminders: settings.prepReminders });
  const evidence: EvidenceRow[] = ev.matched.map((m) => ({
    symptom: m.symptom,
    cyclesSeen: m.cyclesSeen,
    cyclesObserved: m.cyclesObserved,
    typicalLeadDays: m.typicalLeadDays,
    seenInCycles: m.seenInCycles,
  }));
  const matchedNames = ev.matched.map((m) => m.symptom);
  const cycleKey = periods.reduce((a, p) => (p.start_date > a ? p.start_date : a), '');
  if (!cycleKey) return { kind: 'none', reason: 'insufficient_history', usableCycles: 0 };

  const priorRes = await supabase
    .from('symptom_alerts')
    .select('id, created_at, matched, dismissed_at')
    .eq('user_id', input.userId)
    .eq('cycle_key', cycleKey)
    .order('created_at', { ascending: false });
  if (priorRes.error) return { kind: 'none', reason: 'insufficient_history', usableCycles: ev.usableCycles };

  const prior = (priorRes.data ?? []) as unknown as { id: string; created_at: string; matched: string[] | null; dismissed_at: string | null }[];
  const forRule = prior.map((p) => ({ created_at: p.created_at, matched: p.matched ?? [] }));

  if (prior.length > 0 && !canAlert(forRule, matchedNames, settings.maxPerCycle, now.toISOString())) {
    if (prior[0].dismissed_at) return { kind: 'dismissed' };
    return { kind: 'alert', alertId: prior[0].id, level, text, evidence };
  }

  const ins = await supabase
    .from('symptom_alerts')
    .insert({
      user_id: input.userId,
      cycle_key: cycleKey,
      matched: matchedNames,
      level,
      evidence: { matched: evidence, combos: ev.combos, usableCycles: ev.usableCycles },
      predicted_days: input.daysUntilPeriod,
    })
    .select('id')
    .single();
  if (ins.error) return { kind: 'none', reason: 'insufficient_history', usableCycles: ev.usableCycles };

  await scheduleAlertNotification(input.userId, now, input.daysUntilPeriod, text.notificationBody);
  const newId = (ins.data as unknown as { id: string } | null)?.id ?? null;
  return { kind: 'alert', alertId: newId, level, text, evidence };
}

export async function dismissSymptomAlert(alertId: string | null): Promise<void> {
  await cancelAlertNotification();
  if (alertId) await supabase.from('symptom_alerts').update({ dismissed_at: new Date().toISOString() }).eq('id', alertId);
}

export async function markAlertSeen(alertId: string): Promise<void> {
  await supabase.from('symptom_alerts').update({ seen_at: new Date().toISOString() }).eq('id', alertId).is('seen_at', null);
}

export async function listRecentAlerts(userId: string, limit = 5): Promise<StoredAlert[]> {
  const { data, error } = await supabase
    .from('symptom_alerts')
    .select('id, created_at, matched, level, evidence, predicted_days')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as StoredAlert[];
}
