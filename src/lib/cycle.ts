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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  const intervals: CycleInterval[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const dur = sorted[i].end_date
      ? daysBetween(parseDate(sorted[i].start_date)!, parseDate(sorted[i].end_date)!) + 1
      : null;

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

export function buildPredictionModel(
  profile: Pick<Profile, 'cycle_length' | 'period_duration'>,
  periods: Period[]
): PredictionModel {
  const intervals = extractCycleIntervals(periods);
  const cycleLengths = intervals
    .map((i) => i.cycleLength)
    .filter((v): v is number => v !== null);
  const periodDurations = intervals
    .map((i) => i.periodDuration)
    .filter((v): v is number => v !== null);

  // ── Cycle length prediction ──
  let predictedCycleLength: number;
  let trendDirection: 'stable' | 'shortening' | 'lengthening' = 'stable';

  if (cycleLengths.length >= 2) {
    // Exponential weighted moving average — recent cycles matter more
    predictedCycleLength = exponentialWeightedAverage(cycleLengths, 0.35);

    // Linear regression slope for trend detection
    const slope = linearRegressionSlope(cycleLengths);
    if (slope < -0.5) trendDirection = 'shortening';
    else if (slope > 0.5) trendDirection = 'lengthening';

    // Apply trend correction: blend EWMA with a small slope projection
    predictedCycleLength += slope * 0.3;
  } else if (cycleLengths.length === 1) {
    predictedCycleLength = cycleLengths[0];
  } else {
    predictedCycleLength = profile.cycle_length || 28;
  }

  // Clamp to a reasonable range
  predictedCycleLength = Math.round(Math.min(45, Math.max(21, predictedCycleLength)));

  // ── Period duration prediction ──
  let predictedPeriodDuration: number;
  if (periodDurations.length >= 2) {
    predictedPeriodDuration = exponentialWeightedAverage(periodDurations, 0.4);
  } else if (periodDurations.length === 1) {
    predictedPeriodDuration = periodDurations[0];
  } else {
    predictedPeriodDuration = profile.period_duration || 5;
  }
  predictedPeriodDuration = Math.round(Math.min(10, Math.max(2, predictedPeriodDuration)));

  // ── Regularity score (0-100) ──
  let regularityScore: number;
  if (cycleLengths.length >= 3) {
    const sd = standardDeviation(cycleLengths);
    // SD of 0 → 100, SD of 7+ → 0
    regularityScore = Math.round(Math.max(0, Math.min(100, 100 - (sd / 7) * 100)));
  } else if (cycleLengths.length === 2) {
    const diff = Math.abs(cycleLengths[0] - cycleLengths[1]);
    regularityScore = Math.round(Math.max(0, Math.min(100, 100 - (diff / 7) * 100)));
  } else {
    regularityScore = 50;
  }

  // ── Confidence score (0-100) ──
  // More data → higher confidence. Regularity also boosts confidence.
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

// Ovulation is anchored to the NEXT period: it typically occurs about 14 days before it
// (luteal phase length is relatively constant, the follicular phase varies).
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
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  let lastStart: Date | null = null;

  if (sortedPeriods.length > 0) {
    lastStart = parseDate(sortedPeriods[0].start_date);
  } else if (profile.last_period_date) {
    lastStart = parseDate(profile.last_period_date);
  }

  if (!lastStart) return null;

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const periodDuration = model.predictedPeriodDuration;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDay = daysBetween(lastStart, today) + 1;
  const nextPeriodDate = addDays(lastStart, cycleLength);
  const daysUntilNextPeriod = daysBetween(today, nextPeriodDate);
  const ovulationDate = addDays(lastStart, ovulationOffset(cycleLength));
  const fertileWindowStart = addDays(ovulationDate, -4);
  const fertileWindowEnd = addDays(ovulationDate, 1);

  const isOnPeriod = currentDay <= periodDuration;

  return {
    currentDay: Math.max(1, currentDay),
    phase: getPhase(currentDay, periodDuration, cycleLength),
    nextPeriodDate: toDateStr(nextPeriodDate),
    fertileWindowStart: toDateStr(fertileWindowStart),
    fertileWindowEnd: toDateStr(fertileWindowEnd),
    ovulationDate: toDateStr(ovulationDate),
    cycleLength,
    periodDuration,
    daysUntilNextPeriod,
    isOnPeriod,
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
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  let lastStart: Date | null = null;
  if (sortedPeriods.length > 0) {
    lastStart = parseDate(sortedPeriods[0].start_date);
  } else if (profile.last_period_date) {
    lastStart = parseDate(profile.last_period_date);
  }

  if (!lastStart) return [];

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const periodDuration = model.predictedPeriodDuration;
  const results: { start: string; end: string }[] = [];

  for (let i = 1; i <= monthsAhead; i++) {
    const start = addDays(lastStart, cycleLength * i);
    const end = addDays(start, periodDuration - 1);
    results.push({
      start: toDateStr(start),
      end: toDateStr(end),
    });
  }

  return results;
}

export function getFertileWindows(
  profile: Pick<Profile, 'last_period_date' | 'cycle_length' | 'period_duration'>,
  periods: Period[],
  monthsAhead: number = 3
): { start: string; end: string; ovulation: string }[] {
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  let lastStart: Date | null = null;
  if (sortedPeriods.length > 0) {
    lastStart = parseDate(sortedPeriods[0].start_date);
  } else if (profile.last_period_date) {
    lastStart = parseDate(profile.last_period_date);
  }

  if (!lastStart) return [];

  const model = buildPredictionModel(profile, periods);
  const cycleLength = model.predictedCycleLength;
  const results: { start: string; end: string; ovulation: string }[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const cycleStart = addDays(lastStart, cycleLength * i);
    const ovulation = addDays(cycleStart, ovulationOffset(cycleLength));
    results.push({
      start: toDateStr(addDays(ovulation, -4)),
      end: toDateStr(addDays(ovulation, 1)),
      ovulation: toDateStr(ovulation),
    });
  }

  return results;
}
