import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOverdueInfo } from './cycle';
import { overdueText, overdueHint } from './overdue-labels';
import type { Period } from './types';

const profile = { last_period_date: '2026-10-12', cycle_length: 28, period_duration: 5 };
const period = (start: string, end: string | null): Period => ({
  id: 'p-' + start, user_id: 'u1', start_date: start, end_date: end, notes: '', flow_level: null, created_at: '2026-01-01T00:00:00Z',
});
const oct = [period('2026-10-12', '2026-10-16')];

function at(day: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${day}T10:00:00`));
}
afterEach(() => vi.useRealTimers());
beforeEach(() => vi.useRealTimers());

describe('late period', () => {
  it('is not late before the expected date', () => {
    at('2026-11-08');
    expect(getOverdueInfo(profile, oct)).toBeNull();
  });

  it('is not late on the expected day itself', () => {
    at('2026-11-09');
    expect(getOverdueInfo(profile, oct)).toBeNull();
  });

  it('counts the days late and keeps the original expected date', () => {
    at('2026-11-12');
    const info = getOverdueInfo(profile, oct);
    expect(info).not.toBeNull();
    expect(info!.expectedDate).toBe('2026-11-09');
    expect(info!.overdueDays).toBe(3);
    expect(info!.cycleDay).toBe(32);
  });

  it('is cleared as soon as a new period is logged', () => {
    at('2026-11-12');
    expect(getOverdueInfo(profile, [...oct, period('2026-11-12', null)])).toBeNull();
  });
});

describe('late period text', () => {
  it('is written in all three languages', () => {
    const en = overdueText('en', 3);
    expect(en).toBe('Period 3 days late');
    expect(overdueText('en', 1)).toBe('Period 1 day late');
    expect(overdueText('hi', 3)).toContain('3');
    expect(overdueText('hi', 3)).not.toBe(en);
    expect(overdueText('kn', 3)).toContain('3');
    expect(overdueText('kn', 3)).not.toBe(en);
  });

  it('adds the gentle doctor note only after a week', () => {
    for (const lang of ['en', 'hi', 'kn']) {
      expect(overdueHint(lang, 8, '9 Nov').length).toBeGreaterThan(overdueHint(lang, 3, '9 Nov').length);
    }
  });
});