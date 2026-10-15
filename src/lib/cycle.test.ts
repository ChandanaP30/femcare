import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseDate,
  toDateStr,
  todayStr,
  addDays,
  computeCycleInfo,
  buildPredictionModel,
  getFertileWindows,
  getPredictedPeriodDates,
  getPhase,
  ovulationOffset,
} from './cycle';
import { generateResponse } from './chatbot';

// These tests are designed to give the SAME result in any time zone.
// Run them in several zones with:  npm run test:tz

const profile = { last_period_date: null, cycle_length: 28, period_duration: 5 };
const p = (start: string, end: string | null = null) => ({ start_date: start, end_date: end }) as never;

const regular28 = [
  p('2026-07-01', '2026-07-05'),
  p('2026-07-29', '2026-08-02'),
  p('2026-08-26', '2026-08-30'),
  p('2026-09-23', '2026-09-27'),
];

afterEach(() => vi.useRealTimers());

describe('date helpers', () => {
  it('round-trips date strings without shifting the day', () => {
    for (const s of ['2026-01-01', '2026-10-11', '2026-12-31', '2028-02-29']) {
      expect(toDateStr(parseDate(s)!)).toBe(s);
    }
  });

  it('returns null for empty or invalid input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('adds days across month, year and leap-year boundaries', () => {
    expect(toDateStr(addDays(parseDate('2026-12-25')!, 28))).toBe('2027-01-22');
    expect(toDateStr(addDays(parseDate('2028-02-20')!, 10))).toBe('2028-03-01'); // leap year
    expect(toDateStr(addDays(parseDate('2027-02-20')!, 10))).toBe('2027-03-02'); // non-leap
  });

  it("todayStr uses the local calendar date (not UTC) at 01:00 local time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 1, 0, 0)); // 11 Oct 2026, 01:00 local
    expect(todayStr()).toBe('2026-10-11');
  });
});

describe('cycle prediction', () => {
  it('predicts next period 28 days after the last start for regular cycles', () => {
    const info = computeCycleInfo(profile, regular28)!;
    expect(info.cycleLength).toBe(28);
    expect(info.nextPeriodDate).toBe('2026-10-21');
  });

  it('places ovulation 14 days before the next period', () => {
    const info = computeCycleInfo(profile, regular28)!;
    expect(info.ovulationDate).toBe('2026-10-07');
    expect(info.fertileWindowStart).toBe('2026-10-03');
    expect(info.fertileWindowEnd).toBe('2026-10-08');
  });

  it('keeps ovulation 14 days before the next period for a 35-day cycle', () => {
    const periods = [p('2026-06-01', '2026-06-05'), p('2026-07-06', '2026-07-10'), p('2026-08-10', '2026-08-14')];
    const info = computeCycleInfo(profile, periods)!;
    expect(info.cycleLength).toBe(35);
    expect(info.nextPeriodDate).toBe('2026-09-14');
    expect(info.ovulationDate).toBe('2026-08-31');
  });

  it('returns null when there is no period data at all', () => {
    expect(computeCycleInfo(profile, [])).toBeNull();
  });

  it('uses the profile last_period_date when no periods are logged', () => {
    const info = computeCycleInfo({ ...profile, last_period_date: '2026-10-01' }, [])!;
    expect(info.nextPeriodDate).toBe('2026-10-29');
  });

  it('uses profile defaults for the model with zero or one logged cycle', () => {
    expect(buildPredictionModel(profile, []).predictedCycleLength).toBe(28);
    expect(buildPredictionModel(profile, [p('2026-09-01', '2026-09-05')]).predictedCycleLength).toBe(28);
  });

  it('clamps predicted cycle length to 21-45 days', () => {
    const short = [p('2026-01-01'), p('2026-01-12'), p('2026-01-23'), p('2026-02-03')]; // 11-day gaps
    const long = [p('2026-01-01'), p('2026-03-10'), p('2026-05-18'), p('2026-07-26')]; // ~68-day gaps
    expect(buildPredictionModel(profile, short).predictedCycleLength).toBe(21);
    expect(buildPredictionModel(profile, long).predictedCycleLength).toBe(45);
  });

  it('ignores gaps of 90 days or more when learning cycle length', () => {
    const periods = [p('2026-01-01'), p('2026-05-01'), p('2026-05-29')]; // 120-day gap ignored
    expect(buildPredictionModel(profile, periods).sampleSize).toBe(1);
  });

  it('scores perfectly regular cycles as fully regular', () => {
    expect(buildPredictionModel(profile, regular28).regularityScore).toBe(100);
  });

  it('is not affected by the order periods are supplied in', () => {
    const shuffled = [regular28[2], regular28[0], regular28[3], regular28[1]];
    expect(computeCycleInfo(profile, shuffled)!.nextPeriodDate).toBe('2026-10-21');
  });

  it('generates future period dates spaced by the predicted cycle length', () => {
    const dates = getPredictedPeriodDates(profile, regular28, 3);
    expect(dates.map((d) => d.start)).toEqual(['2026-10-21', '2026-11-18', '2026-12-16']);
    expect(dates[0].end).toBe('2026-10-25');
  });

  it('generates fertile windows consistent with ovulation timing', () => {
    const w = getFertileWindows(profile, regular28, 2);
    expect(w[0].ovulation).toBe('2026-10-07');
    expect(w[1].ovulation).toBe('2026-11-04');
  });
});

describe('cycle phases', () => {
  it('maps cycle days to phases for a 28-day cycle', () => {
    expect(ovulationOffset(28)).toBe(14);
    expect(getPhase(1, 5, 28)).toBe('menstrual');
    expect(getPhase(5, 5, 28)).toBe('menstrual');
    expect(getPhase(8, 5, 28)).toBe('follicular');
    expect(getPhase(15, 5, 28)).toBe('ovulation');
    expect(getPhase(24, 5, 28)).toBe('luteal');
  });
});

describe('chatbot keyword matching', () => {
  it('answers a real question about a late period', () => {
    expect(generateResponse('my period is late', [])).toContain('late for many reasons');
  });

  it("does not match 'late' inside other words", () => {
    expect(generateResponse('please translate this', [])).toContain('Could you rephrase');
  });

  it('answers cramps questions', () => {
    expect(generateResponse('Why do I get cramps?', [])).toContain('uterus contracting');
  });

  it('falls back safely for unrecognised input', () => {
    expect(generateResponse('blorp zxqv', [])).toContain('Could you rephrase');
  });
});
