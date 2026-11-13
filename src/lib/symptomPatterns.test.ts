import { describe, it, expect } from 'vitest';
import {
  learnPatterns, evaluateCurrent, canAlert, buildAlertText, dayNum, dayStr,
  type PeriodRow, type LogRow,
} from './symptomPatterns';
import { detectSafety } from './symptomSafety';
import { findSymptomKnowledge } from './symptomKnowledge';

const BASE = dayNum('2026-01-01');
const d = (n: number) => dayStr(BASE + n);
const periods = (...days: number[]): PeriodRow[] => days.map((n) => ({ start_date: d(n), duration: 5 }));
const log = (day: number, symptoms: string[]): LogRow => ({ log_date: d(day), symptoms });

/** Pre-period pattern: logged relative to each period start in `starts`. */
function pre(starts: number[]): LogRow[] {
  return starts.flatMap((s) => [
    log(s - 3, ['Bloating', 'Breast tenderness']),
    log(s - 2, ['Bloating', 'Breast tenderness', 'Fatigue']),
    log(s - 1, ['Fatigue']),
    log(s + 10, ['Acne']),
    log(s + 14, ['Headache']),
  ]);
}

const names = (p: { symptoms: { symptom: string }[] }) => p.symptoms.map((s) => s.symptom).sort();

describe('learning from several cycles', () => {
  const ps = periods(0, 28, 56, 84, 112);
  const logs = pre([28, 56, 84, 112]);
  const patterns = learnPatterns(ps, logs);

  it('learns the repeated symptoms and their lead time', () => {
    expect(patterns.enoughHistory).toBe(true);
    expect(patterns.usableCycles).toBe(4);
    expect(names(patterns)).toEqual(['Bloating', 'Breast tenderness', 'Fatigue']);
    const bloating = patterns.symptoms.find((s) => s.symptom === 'Bloating')!;
    expect(bloating.cyclesSeen).toBe(4);
    expect(bloating.typicalLeadDays).toBe(3);
    const fatigue = patterns.symptoms.find((s) => s.symptom === 'Fatigue')!;
    expect(fatigue.maxLeadDays).toBe(2);
  });

  it('finds the recurring combination', () => {
    const c = patterns.combos.find((x) => x.symptoms.includes('Bloating') && x.symptoms.includes('Breast tenderness'));
    expect(c?.cyclesSeen).toBe(4);
  });

  it('is eligible when similar symptoms appear again and the estimate agrees', () => {
    const now = [...logs, log(135, ['Bloating', 'Fatigue']), log(136, ['Breast tenderness'])];
    const ev = evaluateCurrent(patterns, now, d(137), 3);
    expect(ev.eligible).toBe(true);
    expect(ev.level).toBe('strong');
    expect(ev.matched.length).toBeGreaterThanOrEqual(2);
  });

  it('does not alert on a single symptom', () => {
    const ev = evaluateCurrent(patterns, [...logs, log(136, ['Bloating'])], d(137), 3);
    expect(ev.eligible).toBe(false);
    expect(ev.reason).toBe('single_symptom');
  });

  it('does not alert when the estimate is far away', () => {
    const now = [...logs, log(136, ['Bloating', 'Breast tenderness'])];
    expect(evaluateCurrent(patterns, now, d(137), 14).reason).toBe('period_not_near');
    expect(evaluateCurrent(patterns, now, d(137), -2).reason).toBe('period_overdue');
    expect(evaluateCurrent(patterns, now, d(137), null).reason).toBe('no_prediction');
  });

  it('only alerts when the predicted date is near', () => {
    const now = [...logs, log(135, ['Bloating', 'Fatigue']), log(136, ['Breast tenderness'])];
    expect(evaluateCurrent(patterns, now, d(137), 3).eligible).toBe(true);
    expect(evaluateCurrent(patterns, now, d(137), 1).eligible).toBe(true);
    expect(evaluateCurrent(patterns, now, d(137), 4).reason).toBe('period_not_near');
    expect(evaluateCurrent(patterns, now, d(137), 7).reason).toBe('period_not_near');
  });

  it('does not alert when nothing recent matches', () => {
    expect(evaluateCurrent(patterns, logs, d(137), 3).reason).toBe('no_recent_match');
  });
});

describe('thin or odd histories', () => {
  it('one recorded cycle: nothing learned', () => {
    const p = learnPatterns(periods(0, 28), pre([28]));
    expect(p.enoughHistory).toBe(false);
    expect(p.symptoms).toEqual([]);
    expect(evaluateCurrent(p, [log(40, ['Bloating', 'Fatigue'])], d(41), 2).reason).toBe('insufficient_history');
  });

  it('two cycles with logs is still not enough', () => {
    const p = learnPatterns(periods(0, 28, 56), pre([28, 56]));
    expect(p.enoughHistory).toBe(false);
  });

  it('no symptom history at all', () => {
    const p = learnPatterns(periods(0, 28, 56, 84), []);
    expect(p.usableCycles).toBe(0);
    expect(p.symptoms).toEqual([]);
  });

  it('no periods at all', () => {
    const p = learnPatterns([], pre([28, 56, 84]));
    expect(p.totalCycles).toBe(0);
    expect(p.enoughHistory).toBe(false);
  });

  it('irregular cycle lengths still learn, anchored to each period start', () => {
    const starts = [0, 24, 55, 79, 113];
    const p = learnPatterns(periods(...starts), pre(starts.slice(1)));
    expect(names(p)).toEqual(['Bloating', 'Breast tenderness', 'Fatigue']);
  });

  it('cycles without logs are not counted against the user', () => {
    const ps = periods(0, 28, 56, 84, 112, 140);
    const p = learnPatterns(ps, pre([56, 84, 112]));
    expect(p.usableCycles).toBe(3);
    expect(p.symptoms.find((s) => s.symptom === 'Bloating')?.cyclesObserved).toBe(3);
  });

  it('ignores malformed rows', () => {
    const bad = [{ log_date: 'x', symptoms: ['Bloating'] }, { log_date: d(1), symptoms: null }] as LogRow[];
    expect(() => learnPatterns([{ start_date: 'nope' }, ...periods(0, 28)], bad)).not.toThrow();
  });
});

describe('symptoms in unexpected places', () => {
  const ps = periods(0, 28, 56, 84, 112);

  it('a symptom only seen mid-cycle is not a pre-period pattern', () => {
    const logs = [...pre([28, 56, 84, 112]), ...[14, 42, 70, 98].map((n) => log(n, ['Dizziness']))];
    expect(names(learnPatterns(ps, logs))).not.toContain('Dizziness');
  });

  it('a symptom logged during bleeding is not a pre-period pattern', () => {
    const logs = [...pre([28, 56, 84, 112]), ...[28, 56, 84, 112].map((n) => log(n + 1, ['Cramps']))];
    expect(names(learnPatterns(ps, logs))).not.toContain('Cramps');
  });

  it('a symptom logged every day is not treated as a signal', () => {
    const everyDay: LogRow[] = [];
    for (let n = 0; n <= 120; n++) everyDay.push(log(n, ['Fatigue']));
    const preOnly = [28, 56, 84, 112].flatMap((s) => [log(s - 3, ['Bloating', 'Fatigue']), log(s - 2, ['Bloating', 'Fatigue'])]);
    const merged = everyDay.map((l) => {
      const extra = preOnly.find((x) => x.log_date === l.log_date);
      return extra ? { ...l, symptoms: extra.symptoms } : l;
    });
    const p = learnPatterns(ps, merged);
    expect(names(p)).toContain('Bloating');
    expect(names(p)).not.toContain('Fatigue');
  });
});

describe('repeat prevention', () => {
  const t0 = '2026-05-01T09:00:00Z';
  it('allows the first alert in a cycle', () => {
    expect(canAlert([], ['Bloating', 'Fatigue'], 1, t0)).toBe(true);
  });
  it('blocks a second alert when the limit is one', () => {
    expect(canAlert([{ created_at: t0, matched: ['Bloating', 'Fatigue'] }], ['Bloating', 'Fatigue', 'Acne'], 1, '2026-05-04T09:00:00Z')).toBe(false);
  });
  it('allows a second alert only with a new symptom and 2+ days gap', () => {
    const prior = [{ created_at: t0, matched: ['Bloating', 'Fatigue'] }];
    expect(canAlert(prior, ['Bloating', 'Fatigue', 'Acne'], 2, '2026-05-01T20:00:00Z')).toBe(false);
    expect(canAlert(prior, ['Bloating', 'Fatigue'], 2, '2026-05-04T09:00:00Z')).toBe(false);
    expect(canAlert(prior, ['Bloating', 'Fatigue', 'Acne'], 2, '2026-05-04T09:00:00Z')).toBe(true);
  });
  it('never allows a third', () => {
    const prior = [
      { created_at: t0, matched: ['Bloating'] },
      { created_at: '2026-05-04T09:00:00Z', matched: ['Acne'] },
    ];
    expect(canAlert(prior, ['Nausea'], 2, '2026-05-09T09:00:00Z')).toBe(false);
  });
});

describe('separate users', () => {
  const ps = periods(0, 28, 56, 84, 112);
  const a = learnPatterns(ps, pre([28, 56, 84, 112]));
  const bLogs = [28, 56, 84, 112].flatMap((s) => [log(s - 2, ['Nausea', 'Headache']), log(s - 1, ['Nausea', 'Headache'])]);
  const b = learnPatterns(ps, bLogs);

  it('each user only learns their own symptoms', () => {
    expect(names(a)).toEqual(['Bloating', 'Breast tenderness', 'Fatigue']);
    expect(names(b)).toEqual(['Headache', 'Nausea']);
  });
  it('user B with no history is unaffected by user A', () => {
    const c = learnPatterns(ps, []);
    expect(c.symptoms).toEqual([]);
    expect(evaluateCurrent(c, [log(136, ['Bloating', 'Fatigue'])], d(137), 3).eligible).toBe(false);
  });
  it('results do not depend on input order or earlier calls', () => {
    const again = learnPatterns([...ps].reverse(), [...pre([28, 56, 84, 112])].reverse());
    expect(names(again)).toEqual(names(a));
  });
});

describe('alert text', () => {
  const ps = periods(0, 28, 56, 84, 112);
  const logs = pre([28, 56, 84, 112]);
  const p = learnPatterns(ps, logs);
  const ev = evaluateCurrent(p, [...logs, log(135, ['Bloating', 'Fatigue']), log(136, ['Breast tenderness'])], d(137), 3);

  it('keeps health details out of the tray text and separates observed from predicted', () => {
    const t = buildAlertText(ev, { prepReminders: true });
    expect(t.notificationBody.toLowerCase()).not.toMatch(/bloat|breast|fatigue|period|cramp/);
    expect(t.observed.length).toBe(ev.matched.length);
    expect(t.predicted).toMatch(/estimate/);
    expect(t.prep.length).toBeGreaterThan(0);
    expect(t.caution).toMatch(/doctor/);
    expect(t.body).not.toMatch(/%/);
  });
  it('omits preparation tips when the user turned them off', () => {
    const t = buildAlertText(ev, { prepReminders: false });
    expect(t.prep).toEqual([]);
    expect(t.body).not.toMatch(/pads/);
  });
});

describe('safety', () => {
  const today = '2026-05-10';
  it('flags recent severe pain but not old pain', () => {
    expect(detectSafety([{ log_date: '2026-05-09', pain_level: 9 }], today).map((n) => n.flag)).toEqual(['severe_pain']);
    expect(detectSafety([{ log_date: '2026-05-01', pain_level: 9 }], today)).toEqual([]);
    expect(detectSafety([{ log_date: '2026-05-09', pain_level: 5 }], today)).toEqual([]);
  });
  it('flags self-harm wording in notes or custom symptoms, in several languages', () => {
    expect(detectSafety([{ log_date: today, notes: 'I want to die' }], today)[0].flag).toBe('self_harm_language');
    expect(detectSafety([{ log_date: today, symptoms: ['ಆತ್ಮಹತ್ಯೆ'] }], today)[0].urgent).toBe(true);
    expect(detectSafety([{ log_date: today, notes: 'आत्महत्या के विचार' }], today)[0].flag).toBe('self_harm_language');
  });
  it('puts urgent support first and mentions Tele-MANAS and 112', () => {
    const n = detectSafety([{ log_date: today, pain_level: 10, notes: 'self-harm thoughts' }], today);
    expect(n[0].flag).toBe('self_harm_language');
    expect(n[0].body).toMatch(/14416/);
    expect(n[0].body).toMatch(/112/);
  });
  it('flags heavy bleeding wording', () => {
    expect(detectSafety([{ log_date: today, symptoms: ['soaking a pad every hour'] }], today)[0].flag).toBe('heavy_bleeding');
  });
  it('stays quiet for ordinary logs', () => {
    expect(detectSafety([{ log_date: today, symptoms: ['Cramps'], pain_level: 4, notes: 'tired' }], today)).toEqual([]);
  });
});

describe('knowledge base', () => {
  it('finds entries by stored name', () => {
    expect(findSymptomKnowledge('breast tenderness')?.phases).toContain('late_luteal');
    expect(findSymptomKnowledge('Cramps')?.phases).toContain('menstrual');
    expect(findSymptomKnowledge('not a symptom')).toBeUndefined();
  });
});
