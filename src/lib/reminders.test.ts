import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));
import { DEFAULT_PREFS, buildSchedule, isInQuietHours } from './reminders';
import type { ReminderPrefs } from './reminders';

const on = (p: Partial<ReminderPrefs> = {}): ReminderPrefs => ({ ...DEFAULT_PREFS, master: true, ...p });
const profile = { last_period_date: '2026-10-01', cycle_length: 28, period_duration: 5 } as any;
const noPeriods: any[] = [];

describe('quiet hours', () => {
  it('treats 22:00 to 07:00 as quiet, including across midnight', () => {
    const p = on();
    expect(isInQuietHours(23, 0, p)).toBe(true);
    expect(isInQuietHours(3, 30, p)).toBe(true);
    expect(isInQuietHours(7, 0, p)).toBe(false);
    expect(isInQuietHours(12, 0, p)).toBe(false);
  });

  it('is off when quiet hours are disabled', () => {
    expect(isInQuietHours(23, 0, on({ quietEnabled: false }))).toBe(false);
  });

  it('treats equal start and end as no quiet window', () => {
    expect(isInQuietHours(10, 0, on({ quietStart: '08:00', quietEnd: '08:00' }))).toBe(false);
  });
});

describe('buildSchedule', () => {
  const now = new Date(2026, 9, 10, 8, 0, 0); // 10 Oct 2026, 08:00 local

  it('schedules nothing when the master switch is off', () => {
    expect(buildSchedule({ prefs: { ...DEFAULT_PREFS, master: false }, periods: noPeriods, profile, now })).toEqual([]);
  });

  it('schedules a period reminder that opens the calendar', () => {
    const items = buildSchedule({ prefs: on({ dailyCheckin: false, carePeriodTips: false }), periods: noPeriods, profile, now });
    const period = items.find((i) => i.route === 'calendar');
    expect(period).toBeDefined();
    expect(period!.at!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('schedules seven daily check-ins that open symptoms', () => {
    const items = buildSchedule({ prefs: on({ periodReminders: false, dailyCheckin: true, checkinTime: '20:00' }), periods: noPeriods, profile, now });
    const checkins = items.filter((i) => i.route === 'symptoms');
    expect(checkins).toHaveLength(7);
    checkins.forEach((c) => expect(c.at!.getHours()).toBe(20));
  });

  it('drops the check-in when its time falls inside quiet hours', () => {
    const items = buildSchedule({ prefs: on({ periodReminders: false, dailyCheckin: true, checkinTime: '22:09' }), periods: noPeriods, profile, now });
    expect(items.filter((i) => i.route === 'symptoms')).toHaveLength(0);
  });

  it('adds care tips only on remaining days of a logged period, at most three', () => {
    const periods = [{ id: 'p', user_id: 'u', start_date: '2026-10-09', end_date: '2026-10-16', blood_flow: null, notes: null, created_at: '' }] as any;
    const items = buildSchedule({ prefs: on({ periodReminders: false, carePeriodTips: true }), periods, profile, now });
    const tips = items.filter((i) => i.route === 'home');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it('adds no care tips when no period is active today', () => {
    const items = buildSchedule({ prefs: on({ periodReminders: false, carePeriodTips: true }), periods: noPeriods, profile, now });
    expect(items.filter((i) => i.route === 'home')).toHaveLength(0);
  });

  it('never schedules anything in the past', () => {
    const items = buildSchedule({ prefs: on(), periods: noPeriods, profile, now });
    items.filter((i) => i.at).forEach((i) => expect(i.at!.getTime()).toBeGreaterThan(now.getTime()));
  });
});