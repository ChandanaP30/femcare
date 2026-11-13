import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildPredictionModel, computeCycleInfo, getPredictedPeriodDates, getFertileWindows, getPhase, addDays, toDateStr } from './cycle';
import type { Period } from './types';

const mk = (start: string, end: string | null = null): Period =>
  ({ id: 'id-' + start, user_id: 'u1', start_date: start, end_date: end, blood_flow: null, notes: null, created_at: '' } as unknown as Period);

const prof = (cycle_length: number | null = 28, period_duration: number | null = 5, last_period_date: string | null = null) =>
  ({ cycle_length, period_duration, last_period_date } as any);

function series(first: string, lengths: number[]): Period[] {
  const out = [mk(first)];
  let d = new Date(first + 'T00:00:00');
  for (const L of lengths) {
    d = addDays(d, L);
    out.push(mk(toDateStr(d)));
  }
  return out;
}

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('boundary values', () => {
  it('keeps 40-day intervals and clamps 60-day histories to 45', () => {
    expect(buildPredictionModel(prof(), series('2026-01-01', [40, 40])).predictedCycleLength).toBe(40);
    expect(buildPredictionModel(prof(), series('2026-01-01', [60, 60])).predictedCycleLength).toBe(45);
  });

  it('ignores 61-day intervals and uses the profile value', () => {
    const m = buildPredictionModel(prof(30), series('2026-01-01', [61, 61]));
    expect(m.predictedCycleLength).toBe(30);
    expect(m.sampleSize).toBe(0);
  });

  it('keeps 10-day periods and ignores 11-day periods', () => {
    const ten = [mk('2026-01-01', '2026-01-10'), mk('2026-01-29', '2026-02-07')];
    expect(buildPredictionModel(prof(), ten).predictedPeriodDuration).toBe(10);
    const eleven = [mk('2026-01-01', '2026-01-11'), mk('2026-01-29', '2026-02-08')];
    expect(buildPredictionModel(prof(28, 6), eleven).predictedPeriodDuration).toBe(6);
  });

  it('uses the profile period duration when end dates are missing', () => {
    expect(buildPredictionModel(prof(28, 6), [mk('2026-01-01'), mk('2026-01-29')]).predictedPeriodDuration).toBe(6);
  });

  it('treats a null cycle length as the 28-day default', () => {
    expect(buildPredictionModel(prof(null, 5), []).predictedCycleLength).toBe(28);
  });

  it('a duplicated start date does not create a zero-length cycle', () => {
    const p = [...series('2026-01-01', [28, 28]), mk('2026-01-29')];
    const m = buildPredictionModel(prof(), p);
    expect(m.predictedCycleLength).toBe(28);
    expect(m.sampleSize).toBe(2);
  });

  it('invalid date strings are ignored without throwing', () => {
    const p = [mk('not-a-date'), ...series('2026-08-01', [28, 28])];
    expect(buildPredictionModel(prof(), p).predictedCycleLength).toBe(28);
    vi.setSystemTime(at(2026, 10, 1));
    expect(() => computeCycleInfo(prof(), p)).not.toThrow();
  });
});

describe('regularity and confidence', () => {
  it('alternating 21- and 45-day cycles give zero regularity', () => {
    expect(buildPredictionModel(prof(), series('2026-01-01', [21, 45, 21, 45, 21])).regularityScore).toBe(0);
  });

  it('more regular history never lowers confidence', () => {
    const scores = [2, 3, 4, 5, 6, 8].map((n) => buildPredictionModel(prof(), series('2026-01-01', Array(n).fill(28))).confidence);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
  });

  it('a constant history is predicted exactly for every cycle length from 21 to 45', () => {
    for (let L = 21; L <= 45; L++) {
      expect(buildPredictionModel(prof(), series('2026-01-01', [L, L, L])).predictedCycleLength).toBe(L);
    }
  });
});

describe('calendar edge cases', () => {
  it('handles a leap-year February', () => {
    vi.setSystemTime(at(2028, 2, 25));
    expect(computeCycleInfo(prof(), [mk('2028-02-20')])!.nextPeriodDate).toBe('2028-03-19');
  });

  it('handles the year boundary', () => {
    vi.setSystemTime(at(2026, 12, 22));
    expect(computeCycleInfo(prof(), [mk('2026-12-20')])!.nextPeriodDate).toBe('2027-01-17');
  });

  it('never shows a cycle day beyond the cycle length or a next date in the past', () => {
    const periods = series('2026-09-01', [28, 28]); // last start 2026-10-27
    const base = at(2026, 10, 27);
    for (let i = 0; i <= 120; i++) {
      const now = addDays(base, i);
      vi.setSystemTime(now);
      const info = computeCycleInfo(prof(), periods)!;
      expect(info.currentDay).toBeGreaterThanOrEqual(1);
      expect(info.currentDay).toBeLessThanOrEqual(info.cycleLength);
      expect(info.nextPeriodDate! >= toDateStr(now)).toBe(true);
    }
  });

  it('phase boundaries for a 35-day cycle', () => {
    expect(getPhase(5, 5, 35)).toBe('menstrual');
    expect(getPhase(6, 5, 35)).toBe('follicular');
    expect(getPhase(19, 5, 35)).toBe('follicular');
    expect(getPhase(21, 5, 35)).toBe('ovulation');
    expect(getPhase(24, 5, 35)).toBe('luteal');
  });

  it('fertile windows fall 4 days before to 1 day after ovulation', () => {
    vi.setSystemTime(at(2026, 10, 10));
    const w = getFertileWindows(prof(), [mk('2026-10-01')], 2);
    expect(w[0]).toEqual({ start: '2026-10-11', end: '2026-10-16', ovulation: '2026-10-15' });
    expect(w[1].ovulation).toBe('2026-11-12');
  });

  it('predicted period starts are one cycle apart', () => {
    vi.setSystemTime(at(2026, 10, 10));
    expect(getPredictedPeriodDates(prof(), [mk('2026-10-01')], 3).map((x) => x.start))
      .toEqual(['2026-10-29', '2026-11-26', '2026-12-24']);
  });
});
