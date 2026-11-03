import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/lib/supabase';
import { addDays, getFertileWindows, getPredictedPeriodDates, parseDate } from '@/lib/cycle';
import type { Period, Profile } from '@/lib/types';

export const REMINDERS_CHANGED = 'femcare:reminders-changed';

export interface ReminderPrefs {
  master: boolean;
  periodReminders: boolean;
  periodDaysBefore: 1 | 2 | 3;
  dailyCheckin: boolean;
  checkinTime: string;
  carePeriodTips: boolean;
  fertilityEstimates: boolean;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export const DEFAULT_PREFS: ReminderPrefs = {
  master: false,
  periodReminders: true,
  periodDaysBefore: 2,
  dailyCheckin: false,
  checkinTime: '20:00',
  carePeriodTips: false,
  fertilityEstimates: false,
  quietEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
};

const CHANNEL = {
  period: 'period-reminders',
  checkin: 'daily-checkins',
  tips: 'care-tips',
  fertility: 'fertility-estimates',
} as const;

const CHANNEL_DEFS = [
  { id: CHANNEL.period, name: 'Period reminders', description: 'Estimated period reminders' },
  { id: CHANNEL.checkin, name: 'Daily check-in', description: 'Gentle daily logging reminder' },
  { id: CHANNEL.tips, name: 'Care tips', description: 'Occasional wellness tips on period days' },
  { id: CHANNEL.fertility, name: 'Fertility estimates', description: 'Optional estimated fertile-window reminders' },
];

// Fixed IDs: each reschedule replaces the previous set, so nothing duplicates.
const ID = { period: 100, checkin: 200, tip: 300, fertility: 400, test: 900 };
const MANAGED_IDS = [ID.period, ID.checkin, ID.checkin + 1, ID.checkin + 2, ID.checkin + 3, ID.checkin + 4, ID.checkin + 5, ID.checkin + 6, ID.tip, ID.tip + 1, ID.tip + 2, ID.fertility, ID.test];

const TIPS = [
  'A warm compress may feel comforting today.',
  'Staying hydrated can help you feel better.',
  'Gentle movement may ease discomfort, if it feels good.',
];

// Lock-screen text stays generic. Health details appear only inside the app.
const TITLE = 'FemCare+';

interface Item {
  id: number;
  title: string;
  body: string;
  channelId: string;
  route: string;
  at?: Date;
  daily?: { hour: number; minute: number };
}

const isNative = () => Capacitor.isNativePlatform();

function parseHM(value: string) {
  const [h, m] = value.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

export function isInQuietHours(hour: number, minute: number, prefs: ReminderPrefs): boolean {
  if (!prefs.quietEnabled) return false;
  const t = hour * 60 + minute;
  const s = parseHM(prefs.quietStart);
  const e = parseHM(prefs.quietEnd);
  const start = s.h * 60 + s.m;
  const end = e.h * 60 + e.m;
  if (start === end) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

function atTime(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Moves a one-off reminder that falls in quiet hours to the end of quiet hours.
function outOfQuiet(d: Date, prefs: ReminderPrefs, now: Date): Date {
  if (!isInQuietHours(d.getHours(), d.getMinutes(), prefs)) return d;
  const e = parseHM(prefs.quietEnd);
  let moved = atTime(d, e.h, e.m);
  if (moved <= now) moved = addDays(moved, 1);
  return moved;
}

/** Pure function: builds the reminders that should exist right now. */
export function buildSchedule(input: {
  prefs: ReminderPrefs;
  periods: Period[];
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>;
  now: Date;
}): Item[] {
  const { prefs, periods, profile, now } = input;
  if (!prefs.master) return [];
  const today = startOfDay(now);
  const items: Item[] = [];

  // 1. Period reminder: next estimated start, using the existing prediction logic.
  if (prefs.periodReminders) {
    const next = getPredictedPeriodDates(profile, periods, 2)
      .map((p) => parseDate(p.start)!)
      .find((d) => d >= today);
    if (next) {
      const when = outOfQuiet(atTime(addDays(next, -prefs.periodDaysBefore), 9, 0), prefs, now);
      if (when > now) {
        items.push({ id: ID.period, title: TITLE, body: 'Your period may start soon. Tap to see the estimate.', channelId: CHANNEL.period, route: 'calendar', at: when });
      }
    }
  }

  // 2. Daily check-in: one-off reminders for the next 7 days (more reliable than a repeating alarm).
  if (prefs.dailyCheckin) {
    const { h, m } = parseHM(prefs.checkinTime);
    for (let k = 0; k < 7; k++) {
      const when = atTime(addDays(today, k), h, m);
      if (when > now && !isInQuietHours(h, m, prefs)) {
        items.push({ id: ID.checkin + k, title: TITLE, body: 'How are you feeling today? Tap to log.', channelId: CHANNEL.checkin, route: 'symptoms', at: when });
      }
    }
  }

  // 3. Care tips: only on remaining days of a logged period, at most 3 tips.
  if (prefs.carePeriodTips) {
    const dur = profile.period_duration || 5;
    const span = (p: Period) => {
      const s = parseDate(p.start_date)!;
      const e = p.end_date ? parseDate(p.end_date)! : addDays(s, dur - 1);
      return { s, e };
    };
    const active = periods.find((p) => {
      const { s, e } = span(p);
      return s <= today && e >= today;
    });
    if (active) {
      const { e } = span(active);
      for (let k = 1; k <= 3; k++) {
        const day = addDays(today, k);
        if (day > e) break;
        const when = atTime(day, 10, 0);
        if (when > now && !isInQuietHours(10, 0, prefs)) {
          items.push({ id: ID.tip + k - 1, title: TITLE, body: TIPS[k - 1], channelId: CHANNEL.tips, route: 'home', at: when });
        }
      }
    }
  }

  // 4. Optional fertility estimate: next estimated window start.
  if (prefs.fertilityEstimates) {
    const next = getFertileWindows(profile, periods, 2)
      .map((w) => parseDate(w.start)!)
      .find((d) => d >= today);
    if (next) {
      const when = outOfQuiet(atTime(next, 9, 0), prefs, now);
      if (when > now) {
        items.push({ id: ID.fertility, title: TITLE, body: 'Fertile window estimate only. Not guaranteed and not for contraception.', channelId: CHANNEL.fertility, route: 'calendar', at: when });
      }
    }
  }

  return items;
}

function toNative(item: Item) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    channelId: item.channelId,
    extra: { route: item.route },
    schedule: item.daily
      ? { on: { hour: item.daily.hour, minute: item.daily.minute }, repeats: true, allowWhileIdle: true }
      : { at: item.at, allowWhileIdle: true },
  };
}

export async function getNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return 'denied';
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'prompt';
}

/** Call only from an explicit user action. */
export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (!isNative()) return 'denied';
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? 'granted' : 'denied';
}

async function ensureChannels() {
  for (const c of CHANNEL_DEFS) {
    await LocalNotifications.createChannel({ id: c.id, name: c.name, description: c.description, importance: 3, visibility: 0 });
  }
}

async function cancelManaged() {
  await LocalNotifications.cancel({ notifications: MANAGED_IDS.map((id) => ({ id })) });
}

export async function cancelAllReminders() {
  if (!isNative()) return;
  await cancelManaged();
}

/** Recalculates all reminders. Always clears old ones first, so nothing is duplicated or stale. */
export async function syncReminders(input: {
  prefs: ReminderPrefs;
  periods: Period[];
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>;
}): Promise<number> {
  if (!isNative()) return 0;
  await cancelManaged();
  if (!input.prefs.master || (await getNotificationPermission()) !== 'granted') return 0;
  const items = buildSchedule({ ...input, now: new Date() });
  if (items.length === 0) return 0;
  await ensureChannels();
  await LocalNotifications.schedule({ notifications: items.map(toNative) });
  return items.length;
}

export async function sendTestNotification(): Promise<boolean> {
  if (!isNative() || (await getNotificationPermission()) !== 'granted') return false;
  await ensureChannels();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID.test,
        title: TITLE,
        body: 'Reminders are working.',
        channelId: CHANNEL.checkin,
        extra: { route: 'symptoms' },
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
  return true;
}

export async function loadReminderPrefs(userId: string): Promise<ReminderPrefs> {
  const { data } = await supabase.from('user_settings').select('notifications').eq('user_id', userId).maybeSingle();
  const stored = ((data?.notifications as { reminders?: Partial<ReminderPrefs> } | null)?.reminders) ?? {};
  return { ...DEFAULT_PREFS, ...stored };
}

/** Stores prefs under user_settings.notifications.reminders, keeping other keys intact. */
export async function saveReminderPrefs(userId: string, prefs: ReminderPrefs): Promise<void> {
  const { data } = await supabase.from('user_settings').select('id, notifications').eq('user_id', userId).maybeSingle();
  const current = ((data?.notifications as Record<string, unknown> | null) ?? {});
  const merged = { ...current, reminders: prefs };
  if (data) {
    const { error } = await supabase.from('user_settings').update({ notifications: merged }).eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_settings').insert({ user_id: userId, notifications: merged });
    if (error) throw error;
  }
  window.dispatchEvent(new Event(REMINDERS_CHANGED));
}
export async function getPendingCount(): Promise<number> {
  if (!isNative()) return 0;
  const { notifications } = await LocalNotifications.getPending();
  return notifications.length;
}
export async function getReminderDiagnostics(): Promise<string> {
  if (!isNative()) return 'Not running on Android.';
  const { notifications } = await LocalNotifications.getPending();
  const exact = await (LocalNotifications as any).checkExactNotificationSetting?.();
  const lines = notifications.map((n) => {
    const s = n.schedule as unknown as { at?: string; on?: unknown } | undefined;
    const when = s?.at ? new Date(s.at).toLocaleString() : `repeats ${JSON.stringify(s?.on)}`;
    return `#${n.id} ${when}`;
  });
  return `Exact alarms: ${JSON.stringify(exact ?? 'unknown')}. ${lines.join(' | ') || 'none'}`;
}
