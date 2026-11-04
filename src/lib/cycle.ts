import { getLangCode } from './lang-store';
import type { CycleInfo, CyclePhase, Period, Profile } from './types';

// Date-only strings (YYYY-MM-DD) are parsed as LOCAL dates. new Date('2026-10-01')
// would be UTC midnight, which lands on the wrong day in time zones west of UTC.
export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Format a Date as YYYY-MM-DD using LOCAL calendar fields.
// (toISOString() converts to UTC and shifts the date by one day in India.)
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLangCode(), { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLangCode(), { month: 'short', day: 'numeric' });
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── ML-enhanced prediction helpers ─────────────────────────────────────────
// These implement lightweight statistical learning over the user's own logged
// cycle history. No external model or API — everything runs in the browser.

interface CycleInterval {
  startDate: string;
  cycleLength: number | null;
  periodDuration: number | null;
}

function extractCycleIntervals(periods: Period[]): CycleInterval[] {
  periods = periods.filter((p) => parseDate(p.start_date) !== null); // ignore unparseable starts
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  const intervals: CycleInterval[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const startD = parseDate(sorted[i].start_date);
    const endD = parseDate(sorted[i].end_date);
    const dur = startD && endD ? daysBetween(startD, endD) + 1 : null;

    if (i < sorted.length - 1) {
      const nextStart = parseDate(sorted[i + 1].start_date)!;
      const thisStart = parseDate(sorted[i].start_date)!;
      const cycleLen = daysBetween(thisStart, nextStart);
      if (cycleLen > 0 && cycleLen < 90) {
        intervals.push({ startDate: sorted[i].start_date, cycleLength: cycleLen, periodDuration: dur });
      }
    } else {
      intervals.push({ startDate: sorted[i].start_date, cycleLength: null, periodDuration: dur });
    }
  }

  return intervals;
}

function exponentialWeightedAverage(
  values: number[],
  alpha: number = 0.35
): number {
  if (values.length === 0) return 0;
  let ewa = values[0];
  for (let i = 1; i < values.length; i++) {
    ewa = alpha * values[i] + (1 - alpha) * ewa;
  }
  return ewa;
}

function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface PredictionModel {
  predictedCycleLength: number;
  predictedPeriodDuration: number;
  confidence: number;
  regularityScore: number;
  trendDirection: 'stable' | 'shortening' | 'lengthening';
  sampleSize: number;
}

// Cycles and periods outside these ranges are treated as missed or duplicate logs for prediction.
const PREDICT_CYCLE_MIN = 15;
const PREDICT_CYCLE_MAX = 60;
const PREDICT_PERIOD_MIN = 1;
const PREDICT_PERIOD_MAX = 10;
const MAX_TREND_ADJUST = 2; // days

export function buildPredictionModel(
  profile: Pick<Profile, 'cycle_length' | 'period_duration'>,
  periods: Period[]
): PredictionModel {
  const intervals = extractCycleIntervals(periods);
  const cycleLengths = intervals
    .map((i) => i.cycleLength)
    .filter((v): v is number => v !== null && v >= PREDICT_CYCLE_MIN && v <= PREDICT_CYCLE_MAX);
  const periodDurations = intervals
    .map((i) => i.periodDuration)
    .filter((v): v is number => v !== null && v >= PREDICT_PERIOD_MIN && v <= PREDICT_PERIOD_MAX);

  // Cycle length
  let predictedCycleLength: number;
  let trendDirection: 'stable' | 'shortening' | 'lengthening' = 'stable';

  if (cycleLengths.length >= 2) {
    predictedCycleLength = exponentialWeightedAverage(cycleLengths, 0.35);
    const slope = linearRegressionSlope(cycleLengths);
    if (slope < -0.5) trendDirection = 'shortening';
    else if (slope > 0.5) trendDirection = 'lengthening';
    // Small, capped correction so one unusual cycle cannot swing the estimate.
    const adjust = Math.max(-MAX_TREND_ADJUST, Math.min(MAX_TREND_ADJUST, slope * 0.3));
    predictedCycleLength += adjust;
  } else if (cycleLengths.length === 1) {
    predictedCycleLength = cycleLengths[0];
  } else {
    predictedCycleLength = profile.cycle_length || 28;
  }
  predictedCycleLength = Math.round(Math.min(45, Math.max(21, predictedCycleLength)));

  // Period duration
  let predictedPeriodDuration: number;
  if (periodDurations.length >= 2) {
    predictedPeriodDuration = exponentialWeightedAverage(periodDurations, 0.4);
  } else if (periodDurations.length === 1) {
    predictedPeriodDuration = periodDurations[0];
  } else {
    predictedPeriodDuration = profile.period_duration || 5;
  }
  predictedPeriodDuration = Math.round(Math.min(10, Math.max(2, predictedPeriodDuration)));

  // Regularity (0-100): SD of 0 gives 100, SD of 7 or more gives 0
  let regularityScore: number;
  if (cycleLengths.length >= 3) {
    const sd = standardDeviation(cycleLengths);
    regularityScore = Math.round(Math.max(0, Math.min(100, 100 - (sd / 7) * 100)));
  } else if (cycleLengths.length === 2) {
    const diff = Math.abs(cycleLengths[0] - cycleLengths[1]);
    regularityScore = Math.round(Math.max(0, Math.min(100, 100 - (diff / 7) * 100)));
  } else {
    regularityScore = 50;
  }

  // Confidence (0-100): sample size plus regularity. This is data quality, not clinical certainty.
  const sampleSize = cycleLengths.length;
  let sampleConfidence = Math.min(100, (sampleSize / 6) * 100);
  if (sampleSize === 0) sampleConfidence = 15;
  else if (sampleSize === 1) sampleConfidence = 35;
  const confidence = Math.round(sampleConfidence * 0.6 + regularityScore * 0.4);

  return {
    predictedCycleLength,
    predictedPeriodDuration,
    confidence,
    regularityScore,
    trendDirection,
    sampleSize,
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Most recent logged start that is not in the future. Falls back to the profile's last period date.
function lastLoggedStart(
  profile: Pick<Profile, 'last_period_date'>,
  periods: Period[]
): Date | null {
  const limit = addDays(startOfToday(), 1);
  const starts = periods
    .map((p) => parseDate(p.start_date))
    .filter((d): d is Date => d !== null && d <= limit);
  if (starts.length > 0) {
    return starts.reduce((latest, d) => (d > latest ? d : latest));
  }
  return profile.last_period_date ? parseDate(profile.last_period_date) : null;
}

// Locates today within the cycle. If the expected start has passed without a log,
// the estimate moves to the next expected start instead of staying in the past.
interface CyclePosition {
  cycleStart: Date;
  nextStart: Date;
  cycleDay: number;
}

function locateCycle(lastStart: Date, cycleLength: number, today: Date): CyclePosition {
  const days = daysBetween(lastStart, today);
  const index = days <= 0 ? 0 : Math.floor((days - 1) / cycleLength);
  const cycleStart = addDays(lastStart, index * cycleLength);
  const nextStart = addDays(cycleStart, cycleLength);
  const cycleDay = Math.min(cycleLength, Math.max(1, daysBetween(cycleStart, today) + 1));
  return { cycleStart, nextStart, cycleDay };
}

// Ovulation is anchored to the NEXT period: about 14 days before it (luteal phase is relatively constant).
// This is an estimate, not a clinical measurement.
export const LUTEAL_PHASE_DAYS = 14;

// Days after the cycle start on which ovulation is expected (0-based offset).
export function ovulationOffset(cycleLength: number): number {
  return Math.max(1, cycleLength - LUTEAL_PHASE_DAYS);
}

export function getPhase(cycleDay: number, periodDuration: number, cycleLength: number): CyclePhase {
  if (cycleDay <= periodDuration) return 'menstrual';
  const ovulationDay = ovulationOffset(cycleLength) + 1; // 1-based cycle day
  if (cycleDay >= ovulationDay - 2 && cycleDay <= ovulationDay + 1) return 'ovulation';
  if (cycleDay > periodDuration && cycleDay < ovulationDay - 2) return 'follicular';
  return 'luteal';
}

export function phaseLabel(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Menstrual';
    case 'follicular': return 'Follicular';
    case 'ovulation': return 'Ovulation';
    case 'luteal': return 'Luteal';
  }
}

export function phaseDescription(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Your period is active. Rest and practice self-care.';
    case 'follicular': return 'Energy may be rising. A good time for new activities.';
    case 'ovulation': return 'Near ovulation. You may feel more energetic and social.';
    case 'luteal': return 'PMS symptoms may appear. Be gentle with yourself.';
  }
}

export function computeCycleInfo(
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>,
  periods: Period[]
): CycleInfo | null {
  const lastStart = lastLoggedStart(profile, periods);
  if (!lastStart) return null;

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const periodDuration = model.predictedPeriodDuration;
  const today = startOfToday();
  const pos = locateCycle(lastStart, cycleLength, today);

  const daysUntilNextPeriod = daysBetween(today, pos.nextStart);
  const ovulationDate = addDays(pos.cycleStart, ovulationOffset(cycleLength));
  const fertileWindowStart = addDays(ovulationDate, -4);
  const fertileWindowEnd = addDays(ovulationDate, 1);

  return {
    currentDay: pos.cycleDay,
    phase: getPhase(pos.cycleDay, periodDuration, cycleLength),
    nextPeriodDate: toDateStr(pos.nextStart),
    fertileWindowStart: toDateStr(fertileWindowStart),
    fertileWindowEnd: toDateStr(fertileWindowEnd),
    ovulationDate: toDateStr(ovulationDate),
    cycleLength,
    periodDuration,
    daysUntilNextPeriod,
    isOnPeriod: pos.cycleDay <= periodDuration,
    confidence: model.confidence,
    predictedCycleLength: model.predictedCycleLength,
    predictedPeriodDuration: model.predictedPeriodDuration,
    regularityScore: model.regularityScore,
    trendDirection: model.trendDirection,
  };
}

export function getPredictedPeriodDates(
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>,
  periods: Period[],
  monthsAhead: number = 3
): { start: string; end: string }[] {
  const lastStart = lastLoggedStart(profile, periods);
  if (!lastStart) return [];

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const periodDuration = model.predictedPeriodDuration;
  const pos = locateCycle(lastStart, cycleLength, startOfToday());
  const results: { start: string; end: string }[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const start = addDays(pos.nextStart, i * cycleLength);
    const end = addDays(start, periodDuration - 1);
    results.push({ start: toDateStr(start), end: toDateStr(end) });
  }

  return results;
}

export function getFertileWindows(
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>,
  periods: Period[],
  monthsAhead: number = 3
): { start: string; end: string; ovulation: string }[] {
  const lastStart = lastLoggedStart(profile, periods);
  if (!lastStart) return [];

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const pos = locateCycle(lastStart, cycleLength, startOfToday());
  const results: { start: string; end: string; ovulation: string }[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const cycleStart = addDays(pos.cycleStart, i * cycleLength);
    const ovulation = addDays(cycleStart, ovulationOffset(cycleLength));
    results.push({
      start: toDateStr(addDays(ovulation, -4)),
      end: toDateStr(addDays(ovulation, 1)),
      ovulation: toDateStr(ovulation),
    });
  }

  return results;
}
