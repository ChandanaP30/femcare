import { describe, it, expect } from 'vitest';
import { cycleLengthsFromStarts, predictCycle, ruleBaseline, estimateDates } from './cycleModel';
import { CYCLE_MODEL_PARAMS } from './cycleModelParams';

const DAY = 86400000;

describe('cycleLengthsFromStarts', () => {
  it('computes gaps and drops implausible ones', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-02-27', '2026-06-01'];
    expect(cycleLengthsFromStarts(starts)).toEqual([28, 28]);
  });

  it('sorts unsorted input and ignores invalid dates', () => {
    expect(cycleLengthsFromStarts(['2026-02-26', 'bad', '2026-01-29', '2026-01-01'])).toEqual([28, 28]);
  });
});

describe('predictCycle', () => {
  it('returns the population prior with no history', () => {
    const p = predictCycle(CYCLE_MODEL_PARAMS, []);
    expect(p.meanDays).toBeCloseTo(CYCLE_MODEL_PARAMS.mu0, 1);
    expect(p.historyLength).toBe(0);
  });

  it('keeps the mean within 21 to 45 days', () => {
    const p = predictCycle({ mu0: 80, tau: 1, sigma: 1 }, []);
    expect(p.meanDays).toBe(45);
    expect(predictCycle({ mu0: 5, tau: 1, sigma: 1 }, []).meanDays).toBe(21);
  });

  it('nests the 80% interval inside the 95% interval', () => {
    const p = predictCycle(CYCLE_MODEL_PARAMS, [27, 30, 28]);
    expect(p.interval95[0]).toBeLessThanOrEqual(p.interval80[0]);
    expect(p.interval95[1]).toBeGreaterThanOrEqual(p.interval80[1]);
  });

  it('narrows uncertainty as history grows', () => {
    const few = predictCycle(CYCLE_MODEL_PARAMS, [28]);
    const many = predictCycle(CYCLE_MODEL_PARAMS, [28, 29, 28, 30, 28, 29, 28, 29]);
    expect(many.sdDays).toBeLessThan(few.sdDays);
  });
});

describe('ruleBaseline and estimateDates', () => {
  it('repeats the last cycle, else uses the profile default', () => {
    expect(ruleBaseline([27, 31])).toBe(31);
    expect(ruleBaseline([], 26)).toBe(26);
  });

  it('adds the predicted days to the last start', () => {
    const d = estimateDates(new Date(2026, 0, 1), { meanDays: 28, interval80: [26, 30], interval95: [24, 32], sdDays: 1, historyLength: 0 });
    expect(d.point.getDate()).toBe(29);
    expect(d.range80[0].getDate()).toBe(27);
    expect(d.range80[1].getDate()).toBe(31);
  });
});