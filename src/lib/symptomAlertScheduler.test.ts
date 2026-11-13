import { describe, it, expect } from 'vitest';
import { learnPatterns, dayNum, dayStr, type PeriodRow, type LogRow } from './symptomPatterns';
import {
  decideSmartAlert, isQuietTime, pickDeliveryTime, pushOutOfQuietHours,
  DEFAULT_SMART_ALERT_PREFERENCES as DEF, type SmartAlertPreferences, type DecideInput,
} from './symptomAlertScheduler';

const BASE = dayNum('2026-01-01');
const d = (n: number) => dayStr(BASE + n);
const periods = (...days: number[]): PeriodRow[] => days.map((n) => ({ start_date: d(n), duration: 5 }));
const log = (day: number, symptoms: string[]): LogRow => ({ log_date: d(day), symptoms });
const pre = (starts: number[]): LogRow[] =>
  starts.flatMap((s) => [
    log(s - 3, ['Bloating', 'Breast tenderness']),
    log(s - 2, ['Bloating', 'Breast tenderness', 'Fatigue']),
    log(s - 1, ['Fatigue']),
    log(s + 10, ['Acne']),
    log(s + 14, ['Headache']),
  ]);

/** Local wall-clock time on day offset n. */
const at = (n: number, h: number, m = 0) => {
  const [y, mo, da] = d(n).split('-').map(Number);
  return new Date(y, mo - 1, da, h, m, 0, 0);
};

const patterns = learnPatterns(periods(0, 28, 56, 84, 112), pre([28, 56, 84, 112]));
const recent: LogRow[] = [log(135, ['Bloating', 'Fatigue']), log(136, ['Breast tenderness'])];
const allLogs = [...pre([28, 56, 84, 112]), ...recent];

function input(over: Partial<DecideInput> = {}): DecideInput {
  return {
    patterns,
    logs: allLogs,
    today: d(136),
    now: at(136, 10, 0),
    daysUntilPeriod: 1,
    lastPeriodStart: d(112),
    priorAlertsThisCycle: [],
    prefs: DEF,
    lastLogSavedAt: null,
    ...over,
  };
}

describe('baseline fixture', () => {
  it('schedules an alert when pattern matches and period is near', () => {
    const r = decideSmartAlert(input());
    expect(r.action).toBe('schedule');
    if (r.action === 'schedule') expect(r.cycleKey).toBe(d(112));
  });
});

describe('both conditions are required', () => {
  it('no alert when the period is not within 3 days', () => {
    const r = decideSmartAlert(input({ daysUntilPeriod: 4 }));
    expect(r).toEqual({ action: 'none', reason: 'not_eligible', detail: 'period_not_near' });
  });
  it('no alert for a near period without a matching pattern', () => {
    const r = decideSmartAlert(input({ logs: pre([28, 56, 84, 112]) }));
    expect(r.action).toBe('none');
  });
  it('no alert without a prediction', () => {
    expect(decideSmartAlert(input({ daysUntilPeriod: null })).action).toBe('none');
  });
});

describe('logging never notifies immediately', () => {
  it('delivery is always strictly after now', () => {
    const now = at(136, 8, 59);
    const r = decideSmartAlert(input({ now, prefs: { ...DEF, quietHours: null } }));
    expect(r.action).toBe('schedule');
    if (r.action === 'schedule') expect(r.deliverAt.getTime() > now.getTime()).toBe(true);
  });
  it('a log saved just now pushes delivery at least 6 hours later', () => {
    const now = at(136, 8, 45);
    const r = decideSmartAlert(input({ now, daysUntilPeriod: 3, lastLogSavedAt: now, prefs: { ...DEF, quietHours: null } }));
    expect(r.action).toBe('schedule');
    if (r.action === 'schedule') expect(r.deliverAt.getTime() - now.getTime() >= 6 * 3_600_000).toBe(true);
  });
  it('declines rather than notifying after the estimated period day', () => {
    const now = at(136, 10, 0);
    const r = decideSmartAlert(input({ now, daysUntilPeriod: 0, lastLogSavedAt: now }));
    expect(r).toEqual({ action: 'none', reason: 'too_late' });
  });
});

describe('no duplicates', () => {
  const prior = [{ created_at: at(135, 9).toISOString(), matched: ['Bloating', 'Fatigue'] }];
  it('blocks a second alert in the same cycle by default', () => {
    expect(decideSmartAlert(input({ priorAlertsThisCycle: prior }))).toEqual({ action: 'none', reason: 'already_alerted_this_cycle' });
  });
  it('allows a second with maxPerCycle 2, 2+ days gap and a new symptom', () => {
    const p = [{ created_at: at(133, 9).toISOString(), matched: ['Bloating'] }];
    const r = decideSmartAlert(input({ priorAlertsThisCycle: p, prefs: { ...DEF, maxPerCycle: 2 } }));
    expect(r.action).toBe('schedule');
  });
});

describe('preferences and quiet hours', () => {
  it('does nothing when Smart Alerts are turned off', () => {
    expect(decideSmartAlert(input({ prefs: { ...DEF, enabled: false } }))).toEqual({ action: 'none', reason: 'disabled' });
  });
  it('detects quiet hours that wrap midnight', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(isQuietTime(at(0, 23, 30), q)).toBe(true);
    expect(isQuietTime(at(0, 3, 0), q)).toBe(true);
    expect(isQuietTime(at(0, 7, 0), q)).toBe(false);
    expect(isQuietTime(at(0, 12, 0), q)).toBe(false);
  });
  it('detects same-day quiet hours and ignores a disabled setting', () => {
    expect(isQuietTime(at(0, 14, 0), { enabled: true, start: '13:00', end: '15:00' })).toBe(true);
    expect(isQuietTime(at(0, 14, 0), { enabled: false, start: '13:00', end: '15:00' })).toBe(false);
    expect(isQuietTime(at(0, 14, 0), null)).toBe(false);
  });
  it('moves a preferred time inside quiet hours to when they end', () => {
    const prefs: SmartAlertPreferences = { ...DEF, preferredTime: '23:00' };
    const t = pickDeliveryTime(at(0, 10, 0), prefs)!;
    expect(t.getHours()).toBe(7);
    expect(t.getTime() > at(0, 23, 0).getTime()).toBe(true);
  });
  it('pushOutOfQuietHours leaves allowed times alone', () => {
    const t = at(0, 12, 0);
    expect(pushOutOfQuietHours(t, DEF.quietHours)).toBe(t);
  });
  it('the scheduled time is never inside quiet hours', () => {
    const prefs = { ...DEF, preferredTime: '06:30' };
    const r = decideSmartAlert(input({ prefs, daysUntilPeriod: 3 }));
    expect(r.action).toBe('schedule');
    if (r.action === 'schedule') expect(isQuietTime(r.deliverAt, prefs.quietHours)).toBe(false);
  });
  it('rejects an invalid preferred time', () => {
    expect(decideSmartAlert(input({ prefs: { ...DEF, preferredTime: '25:99' } }))).toEqual({ action: 'none', reason: 'invalid_time' });
  });
  it('prep tips follow the preference', () => {
    const on = decideSmartAlert(input());
    const off = decideSmartAlert(input({ prefs: { ...DEF, prepReminders: false } }));
    if (on.action === 'schedule' && off.action === 'schedule') {
      expect(on.text.prep.length).toBeGreaterThan(0);
      expect(off.text.prep).toEqual([]);
    } else throw new Error('expected schedule');
  });
});

describe('safety replaces alerts', () => {
  it('returns a safety notice instead of an alert', () => {
    const logs = [...allLogs, { log_date: d(135), symptoms: ['Cramps'], pain_level: 9 }];
    expect(decideSmartAlert(input({ logs })).action).toBe('safety');
  });
  it('still shows safety support when Smart Alerts are off', () => {
    const logs = [...allLogs, { log_date: d(136), symptoms: [], notes: 'I want to die' }];
    expect(decideSmartAlert(input({ logs, prefs: { ...DEF, enabled: false } })).action).toBe('safety');
  });
});

describe('privacy of the tray text', () => {
  it('scheduled notification text carries no symptom names', () => {
    const r = decideSmartAlert(input());
    if (r.action !== 'schedule') throw new Error('expected schedule');
    expect(r.text.notificationBody.toLowerCase()).not.toMatch(/bloat|fatigue|tender|period|cramp/);
  });
});
