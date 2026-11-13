import { describe, it, expect } from 'vitest';
import {
  toSmartPrefs, localDate, currentCycleStart, buildEvidence, slotFromAlert, isCardVisible, readEvidence,
  type AlertRow, type SmartPrefsSource,
} from './symptomAlertPlan';
import { DEFAULT_SMART_ALERT_PREFERENCES as DEF, type SmartAlertDecision } from './symptomAlertScheduler';

const src: SmartPrefsSource = { master: true, smartAlerts: true, quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' };
const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m, 0, 0);

const decision: Extract<SmartAlertDecision, { action: 'schedule' }> = {
  action: 'schedule',
  deliverAt: at(10, 9),
  cycleKey: '2026-01-01',
  level: 'possible',
  matched: ['Bloating', 'Fatigue'],
  daysUntilPeriod: 2,
  text: {
    title: 'A pattern from your past cycles',
    body: 'body',
    notificationBody: 'A gentle heads-up from FemCare+.',
    observed: ['Bloating: logged before 3 of your 4 observed periods, usually from about 2 days before.'],
    predicted: 'x',
    prep: ['Keep pads ready.'],
    caution: 'See a doctor if severe.',
  },
};

const row = (over: Partial<AlertRow> = {}): AlertRow => ({
  id: 'a1', cycle_key: '2026-01-01', matched: ['Bloating'], level: 'possible',
  evidence: buildEvidence(decision), predicted_days: 2,
  created_at: at(8, 12).toISOString(), seen_at: null, dismissed_at: null, ...over,
});

describe('preferences mapping', () => {
  it('needs both the master switch and the Smart Alerts switch', () => {
    expect(toSmartPrefs(src).enabled).toBe(true);
    expect(toSmartPrefs({ ...src, master: false }).enabled).toBe(false);
    expect(toSmartPrefs({ ...src, smartAlerts: false }).enabled).toBe(false);
  });
  it('treats a missing Smart Alerts flag as off (old saved settings)', () => {
    const { smartAlerts: _omit, ...old } = src;
    expect(toSmartPrefs(old).enabled).toBe(false);
  });
  it('carries quiet hours across and defaults tips on, one alert per cycle', () => {
    const p = toSmartPrefs({ ...src, quietStart: '23:00', quietEnd: '06:30' });
    expect(p.quietHours).toEqual({ enabled: true, start: '23:00', end: '06:30' });
    expect(p.prepReminders).toBe(true);
    expect(p.maxPerCycle).toBe(1);
    expect(toSmartPrefs({ ...src, smartAlertTips: false }).prepReminders).toBe(false);
  });
});

describe('cycle key', () => {
  it('formats local dates', () => expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
  it('picks the latest period start on or before today', () => {
    const ps = [{ start_date: '2025-11-30' }, { start_date: '2026-01-01' }, { start_date: '2026-02-01' }];
    expect(currentCycleStart(ps, '2026-01-20')).toBe('2026-01-01');
    expect(currentCycleStart(ps, '2025-11-30')).toBe('2025-11-30');
    expect(currentCycleStart(ps, '2025-01-01')).toBe(null);
    expect(currentCycleStart([], '2026-01-01')).toBe(null);
    expect(currentCycleStart([{ start_date: null }, {}], '2026-01-01')).toBe(null);
  });
});

describe('rebuilding the notification from a stored alert', () => {
  const prefs = toSmartPrefs(src);
  it('returns the same delivery time while it is still in the future', () => {
    const s = slotFromAlert(row(), at(9, 15), prefs)!;
    expect(s.at.getTime()).toBe(at(10, 9).getTime());
    expect(s.body).toBe('A gentle heads-up from FemCare+.');
  });
  it('returns nothing once due, dismissed or unreadable', () => {
    expect(slotFromAlert(row(), at(10, 9, 1), prefs)).toBe(null);
    expect(slotFromAlert(row({ dismissed_at: at(9, 10).toISOString() }), at(9, 15), prefs)).toBe(null);
    expect(slotFromAlert(row({ evidence: { nope: 1 } }), at(9, 15), prefs)).toBe(null);
    expect(slotFromAlert(row({ evidence: { ...buildEvidence(decision), deliverAt: 'garbage' } }), at(9, 15), prefs)).toBe(null);
  });
  it('re-applies quiet hours if the user changed them after the alert was stored', () => {
    const late = { ...prefs, quietHours: { enabled: true, start: '08:00', end: '11:00' } };
    const s = slotFromAlert(row(), at(9, 15), late)!;
    expect(s.at.getHours()).toBe(11);
  });
  it('never exposes symptom names in the notification body', () => {
    const s = slotFromAlert(row(), at(9, 15), prefs)!;
    expect(s.body.toLowerCase()).not.toMatch(/bloat|fatigue/);
  });
});

describe('home card timing', () => {
  it('is hidden before the delivery time, so logging never shows it instantly', () => {
    expect(isCardVisible(row(), at(9, 20))).toBe(false);
  });
  it('shows once the delivery time has arrived', () => {
    expect(isCardVisible(row(), at(10, 9))).toBe(true);
    expect(isCardVisible(row(), at(11, 12))).toBe(true);
  });
  it('hides when dismissed, missing, stale or malformed', () => {
    expect(isCardVisible(null, at(10, 12))).toBe(false);
    expect(isCardVisible(row({ dismissed_at: at(10, 10).toISOString() }), at(10, 12))).toBe(false);
    expect(isCardVisible(row(), at(16, 12))).toBe(false);
    expect(isCardVisible(row({ evidence: 5 }), at(10, 12))).toBe(false);
    expect(isCardVisible(row({ created_at: 'bad' }), at(10, 12))).toBe(false);
  });
});

describe('stored evidence', () => {
  it('round-trips and keeps the explanation parts for "Why am I seeing this?"', () => {
    const ev = readEvidence(buildEvidence(decision))!;
    expect(ev.observed.length).toBe(1);
    expect(ev.prep).toEqual(['Keep pads ready.']);
    expect(ev.caution).toBe('See a doctor if severe.');
  });
  it('tolerates partly missing fields', () => {
    const ev = readEvidence({ deliverAt: at(10, 9).toISOString(), body: 'b', notificationBody: 'n' })!;
    expect(ev.observed).toEqual([]);
    expect(ev.title.length).toBeGreaterThan(0);
  });
  it('uses the default scheduler preferences shape', () => {
    expect(toSmartPrefs(src).preferredTime).toBe(DEF.preferredTime);
  });
});
