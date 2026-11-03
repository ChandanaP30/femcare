import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDate, toDateStr, todayStr, addDays, formatDate, formatDateShort,
  computeCycleInfo, buildPredictionModel, getFertileWindows, getPredictedPeriodDates, getPhase, ovulationOffset,
} from './cycle';

// Tests for the FemCare+ cycle logic: exponentially weighted average of recent cycle lengths,
// a capped linear-trend correction, and clamping. They run on a FIXED date (11 Oct 2026) and give the
// same result in any time zone:  npm run test:tz   (or just  npm test)

const profile = { last_period_date: null, cycle_length: 28, period_duration: 5 };
const p = (start: string, end: string | null = null) => ({ start_date: start, end_date: end }) as never;

// A history whose cycle lengths are exactly `lengths`, starting 1 Jan 2026.
function history(lengths: number[]) {
  let d = parseDate('2026-01-01')!;
  const out = [p('2026-01-01')];
  for (const len of lengths) {
    d = addDays(d, len);
    out.push(p(toDateStr(d)));
  }
  return out;
}

const regular28 = [
  p('2026-07-01', '2026-07-05'),
  p('2026-07-29', '2026-08-02'),
  p('2026-08-26', '2026-08-30'),
  p('2026-09-23', '2026-09-27'),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); // the tests assume today = 11 Oct 2026
});
afterEach(() => vi.useRealTimers());

describe('date helpers', () => {
  it('round-trips date strings without shifting the day', () => {
    for (const s of ['2026-01-01', '2026-10-11', '2026-12-31', '2028-02-29']) expect(toDateStr(parseDate(s)!)).toBe(s);
  });
  it('returns null for empty or invalid input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });
  it('adds days across month, year and leap-year boundaries', () => {
    expect(toDateStr(addDays(parseDate('2026-12-25')!, 28))).toBe('2027-01-22');
    expect(toDateStr(addDays(parseDate('2028-02-20')!, 10))).toBe('2028-03-01');
    expect(toDateStr(addDays(parseDate('2027-02-20')!, 10))).toBe('2027-03-02');
  });
  it('todayStr uses the local calendar date, also at 01:00 local time', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 1, 0, 0));
    expect(todayStr()).toBe('2026-10-11');
  });
  it('shows an em dash for missing or invalid dates (no garbled characters)', () => {
    expect(formatDate(null)).toBe('\u2014');
    expect(formatDateShort(null)).toBe('\u2014');
    expect(formatDate('nonsense')).toBe('\u2014');
  });
});

describe('prediction model: learning from logged cycles', () => {
  it('predicts the usual length for perfectly regular cycles, with full regularity and confidence', () => {
    const m = buildPredictionModel(profile, history([28, 28, 28, 28, 28, 28]));
    expect(m).toMatchObject({ predictedCycleLength: 28, regularityScore: 100, confidence: 100, trendDirection: 'stable', sampleSize: 6 });
  });

  it('detects a lengthening trend and nudges the estimate upward', () => {
    const m = buildPredictionModel(profile, history([26, 27, 28, 29, 30]));
    expect(m.trendDirection).toBe('lengthening');
    expect(m.predictedCycleLength).toBe(29);
  });

  it('detects a shortening trend', () => {
    expect(buildPredictionModel(profile, history([30, 29, 28, 27, 26])).trendDirection).toBe('shortening');
  });

  it('caps the trend correction at 2 days so one unusual history cannot swing the estimate', () => {
    // weighted average is about 39.8; an uncapped correction would give 44
    expect(buildPredictionModel(profile, history([15, 30, 45, 60])).predictedCycleLength).toBe(42);
  });

  it('keeps the predicted length within 21-45 days', () => {
    expect(buildPredictionModel(profile, history([16, 16, 16])).predictedCycleLength).toBe(21);
    expect(buildPredictionModel(profile, history([58, 58, 58])).predictedCycleLength).toBe(45);
  });

  it('treats gaps shorter than 15 days as duplicate logs and falls back to the profile', () => {
    const m = buildPredictionModel(profile, history([11, 11, 11]));
    expect(m.sampleSize).toBe(0);
    expect(m.predictedCycleLength).toBe(28);
  });

  it('ignores gaps longer than 60 days (missed logs) and falls back to the profile', () => {
    const m = buildPredictionModel({ cycle_length: 30, period_duration: 5 }, history([68, 68]));
    expect(m.sampleSize).toBe(0);
    expect(m.predictedCycleLength).toBe(30);
  });

  it('uses a single valid cycle as it is', () => {
    expect(buildPredictionModel(profile, history([33])).predictedCycleLength).toBe(33);
  });

  it('reports regularity from the spread of cycle lengths (0 when the spread is 7 days or more)', () => {
    expect(buildPredictionModel(profile, history([21, 35, 21, 35])).regularityScore).toBe(0);
    expect(buildPredictionModel(profile, history([28, 28])).regularityScore).toBe(100);
    expect(buildPredictionModel(profile, history([28, 31])).regularityScore).toBe(57);
  });

  it('confidence reflects how much data there is, not clinical certainty', () => {
    expect(buildPredictionModel(profile, []).confidence).toBe(29); // no data
    expect(buildPredictionModel(profile, history([28])).confidence).toBe(41); // one cycle
    expect(buildPredictionModel(profile, history([28, 28])).confidence).toBe(60); // two cycles
  });

  it('learns the period duration from logged end dates', () => {
    expect(buildPredictionModel(profile, regular28).predictedPeriodDuration).toBe(5);
    const nineAndTen = [p('2026-01-01', '2026-01-09'), p('2026-01-29', '2026-02-07')]; // 9 and 10 days
    expect(buildPredictionModel(profile, nineAndTen).predictedPeriodDuration).toBe(9);
  });

  it('ignores implausible period durations (over 10 days) and uses the profile value', () => {
    const tooLong = [p('2026-01-01', '2026-01-20'), p('2026-01-29', '2026-02-20')];
    expect(buildPredictionModel(profile, tooLong).predictedPeriodDuration).toBe(5);
    expect(buildPredictionModel({ cycle_length: 28, period_duration: 6 }, history([28])).predictedPeriodDuration).toBe(6);
  });

  it('is not affected by the order periods are supplied in', () => {
    const shuffled = [regular28[2], regular28[0], regular28[3], regular28[1]];
    expect(buildPredictionModel(profile, shuffled)).toEqual(buildPredictionModel(profile, regular28));
  });
});

describe('cycle information on the fixed date (11 Oct 2026)', () => {
  it('regular 28-day cycles: next period, ovulation and fertile window', () => {
    const info = computeCycleInfo(profile, regular28)!;
    expect(info).toMatchObject({
      cycleLength: 28,
      nextPeriodDate: '2026-10-21',
      ovulationDate: '2026-10-07',
      fertileWindowStart: '2026-10-03',
      fertileWindowEnd: '2026-10-08',
      currentDay: 19,
      daysUntilNextPeriod: 10,
      phase: 'luteal',
      isOnPeriod: false,
    });
  });

  it('35-day cycles: ovulation stays 14 days before the next period', () => {
    const periods = [p('2026-07-20', '2026-07-24'), p('2026-08-24', '2026-08-28'), p('2026-09-28', '2026-10-02')];
    const info = computeCycleInfo(profile, periods)!;
    expect(info).toMatchObject({ cycleLength: 35, nextPeriodDate: '2026-11-02', ovulationDate: '2026-10-19', daysUntilNextPeriod: 22 });
  });

  it('returns null without any period data', () => {
    expect(computeCycleInfo(profile, [])).toBeNull();
  });

  it('uses the profile last_period_date when no periods are logged', () => {
    const info = computeCycleInfo({ ...profile, last_period_date: '2026-10-01' }, [])!;
    expect(info.nextPeriodDate).toBe('2026-10-29');
  });

  it('ignores period starts dated after tomorrow but accepts tomorrow', () => {
    const future = [...regular28, p('2026-12-01')];
    expect(computeCycleInfo(profile, future)!.nextPeriodDate).toBe(computeCycleInfo(profile, regular28)!.nextPeriodDate);
    const tomorrow = [...regular28, p('2026-10-12')];
    expect(computeCycleInfo(profile, tomorrow)!.currentDay).toBe(1);
  });

  it('on the expected start day, the next period is today', () => {
    const info = computeCycleInfo(profile, [p('2026-09-13', '2026-09-17')])!;
    expect(info).toMatchObject({ nextPeriodDate: '2026-10-11', daysUntilNextPeriod: 0, currentDay: 28 });
  });

  it('documents current behaviour: the day after the expected start, it moves to the next cycle', () => {
    // A late period is not shown as "late": the estimate rolls forward and the phase becomes menstrual.
    const info = computeCycleInfo(profile, [p('2026-09-12', '2026-09-16')])!;
    expect(info).toMatchObject({ nextPeriodDate: '2026-11-07', currentDay: 2, phase: 'menstrual', isOnPeriod: true });
  });
});

describe('future dates and phases', () => {
  it('lists future period dates one predicted cycle apart', () => {
    const dates = getPredictedPeriodDates(profile, regular28, 3);
    expect(dates.map((d) => d.start)).toEqual(['2026-10-21', '2026-11-18', '2026-12-16']);
    expect(dates[0].end).toBe('2026-10-25');
  });

  it('lists fertile windows around each expected ovulation', () => {
    const w = getFertileWindows(profile, regular28, 2);
    expect(w[0]).toEqual({ start: '2026-10-03', end: '2026-10-08', ovulation: '2026-10-07' });
    expect(w[1].ovulation).toBe('2026-11-04');
  });

  it('returns empty lists without data', () => {
    expect(getPredictedPeriodDates(profile, [])).toEqual([]);
    expect(getFertileWindows(profile, [])).toEqual([]);
  });

  it('maps cycle days to phases for a 28-day cycle', () => {
    expect(ovulationOffset(28)).toBe(14);
    expect(getPhase(1, 5, 28)).toBe('menstrual');
    expect(getPhase(5, 5, 28)).toBe('menstrual');
    expect(getPhase(8, 5, 28)).toBe('follicular');
    expect(getPhase(15, 5, 28)).toBe('ovulation');
    expect(getPhase(24, 5, 28)).toBe('luteal');
  });
});
