import type { Period, SymptomEntry } from './types';
import { getSortedPeriods, parseDate, daysBetween, formatDate, addDays } from './cycle';

export interface PredictionResult {
  predictedCycleLength: number;
  predictedPeriodDuration: number;
  nextPeriodDate: string;
  ovulationDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  algorithm: string;
  confidence: 'low' | 'medium' | 'high';
  modelParams: {
    weights: number[];
    trend: number;
    intercept: number;
    slope: number;
    variability: number;
    sampleSize: number;
    biasCorrection: number;
  };
  accuracyInfo: {
    pastPredictions: number;
    avgErrorDays: number | null;
    maxErrorDays: number | null;
    accuracyPercentage: number | null;
  };
}

interface PastPrediction {
  predicted_date: string;
  actual_date: string | null;
  error_days: number | null;
}

function haversineWeight(index: number, total: number): number {
  const normalized = total > 1 ? index / (total - 1) : 0.5;
  return Math.exp(-2 * (1 - normalized));
}

function linearRegression(xs: number[], ys: number[], weights: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum === 0) return { slope: 0, intercept: ys[0] || 0 };

  const xMean = xs.reduce((sum, x, i) => sum + x * weights[i], 0) / wSum;
  const yMean = ys.reduce((sum, y, i) => sum + y * weights[i], 0) / wSum;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += weights[i] * (xs[i] - xMean) * (ys[i] - yMean);
    denominator += weights[i] * (xs[i] - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function detectSymptomCycleCorrelation(symptoms: SymptomEntry[], periods: Period[]): number {
  if (symptoms.length < 5 || periods.length < 2) return 0;

  const sorted = getSortedPeriods(periods);
  const prePeriodSymptoms: number[] = [];
  const otherSymptoms: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const cycleStart = parseDate(sorted[i - 1].start_date);
    const nextStart = parseDate(sorted[i].start_date);
    const cycleLength = daysBetween(cycleStart, nextStart);

    const prePeriodStart = addDays(nextStart, -7);
    const prePeriodEnd = addDays(nextStart, -1);

    let preCount = 0;
    let otherCount = 0;

    symptoms.forEach((s) => {
      const d = parseDate(s.entry_date);
      if (d >= cycleStart && d < nextStart) {
        if (d >= prePeriodStart && d <= prePeriodEnd) {
          preCount += (s.symptoms?.length || 0) + (s.pain > 0 ? 1 : 0);
        } else {
          otherCount += (s.symptoms?.length || 0) + (s.pain > 0 ? 1 : 0);
        }
      }
    });

    if (cycleLength > 0) {
      prePeriodSymptoms.push(preCount / 7);
      otherSymptoms.push(otherCount / (cycleLength - 7));
    }
  }

  if (prePeriodSymptoms.length === 0) return 0;
  const avgPre = prePeriodSymptoms.reduce((a, b) => a + b, 0) / prePeriodSymptoms.length;
  const avgOther = otherSymSafe(otherSymptoms);
  if (avgOther === 0) return 0;
  return (avgPre - avgOther) / Math.max(avgOther, 1);
}

function otherSymSafe(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function predictNextCycle(
  periods: Period[],
  symptoms: SymptomEntry[],
  fallbackCycleLength: number,
  fallbackPeriodDuration: number,
  pastPredictions: PastPrediction[] = [],
): PredictionResult {
  const sorted = getSortedPeriods(periods);

  if (sorted.length === 0) {
    return {
      predictedCycleLength: fallbackCycleLength,
      predictedPeriodDuration: fallbackPeriodDuration,
      nextPeriodDate: '',
      ovulationDate: '',
      fertileWindowStart: '',
      fertileWindowEnd: '',
      algorithm: 'fallback',
      confidence: 'low',
      modelParams: {
        weights: [],
        trend: 0,
        intercept: fallbackCycleLength,
        slope: 0,
        variability: 0,
        sampleSize: 0,
        biasCorrection: 0,
      },
      accuracyInfo: {
        pastPredictions: 0,
        avgErrorDays: null,
        maxErrorDays: null,
        accuracyPercentage: null,
      },
    };
  }

  const cycleLengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(parseDate(sorted[i - 1].start_date), parseDate(sorted[i].start_date));
    if (diff > 10 && diff < 90) cycleLengths.push(diff);
  }

  const durations: number[] = [];
  sorted.forEach((p) => {
    if (p.end_date) {
      const d = daysBetween(parseDate(p.start_date), parseDate(p.end_date!)) + 1;
      if (d > 0 && d < 15) durations.push(d);
    }
  });

  let predictedCycleLength: number;
  let slope = 0;
  let intercept = 0;
  let weights: number[] = [];
  let algorithm = 'simple_average';

  if (cycleLengths.length >= 3) {
    const xs = cycleLengths.map((_, i) => i);
    weights = cycleLengths.map((_, i) => haversineWeight(i, cycleLengths.length));
    const reg = linearRegression(xs, cycleLengths, weights);
    slope = reg.slope;
    intercept = reg.intercept;

    const nextX = cycleLengths.length;
    const regressionPrediction = intercept + slope * nextX;

    const weightedAvg = cycleLengths.reduce((sum, val, i) => sum + val * weights[i], 0) / weights.reduce((a, b) => a + b, 0);

    predictedCycleLength = Math.round(regressionPrediction * 0.65 + weightedAvg * 0.35);
    algorithm = 'weighted_regression';

    if (predictedCycleLength < 21 || predictedCycleLength > 45) {
      predictedCycleLength = Math.round(weightedAvg);
      algorithm = 'weighted_average_fallback';
    }
  } else if (cycleLengths.length === 2) {
    weights = [0.35, 0.65];
    predictedCycleLength = Math.round(
      cycleLengths[0] * 0.35 + cycleLengths[1] * 0.65,
    );
    algorithm = 'weighted_average';
  } else if (cycleLengths.length === 1) {
    predictedCycleLength = cycleLengths[0];
    algorithm = 'last_cycle';
  } else {
    predictedCycleLength = fallbackCycleLength;
    algorithm = 'fallback';
  }

  const variability = standardDeviation(cycleLengths);

  let biasCorrection = 0;
  const resolvedPredictions = pastPredictions.filter((p) => p.actual_date && p.error_days !== null);
  let accuracyInfo: PredictionResult['accuracyInfo'] = {
    pastPredictions: resolvedPredictions.length,
    avgErrorDays: null,
    maxErrorDays: null,
    accuracyPercentage: null,
  };

  if (resolvedPredictions.length >= 2) {
    const errors = resolvedPredictions.map((p) => Math.abs(p.error_days!));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxError = Math.max(...errors);
    const biasSum = resolvedPredictions.reduce((sum, p) => sum + (p.error_days || 0), 0);
    biasCorrection = Math.round(biasSum / resolvedPredictions.length);

    accuracyInfo = {
      pastPredictions: resolvedPredictions.length,
      avgErrorDays: Math.round(avgError * 10) / 10,
      maxErrorDays: maxError,
      accuracyPercentage: Math.round((1 - Math.min(avgError / 14, 1)) * 100),
    };

    if (Math.abs(biasCorrection) >= 1 && Math.abs(biasCorrection) <= 5) {
      predictedCycleLength += biasCorrection;
    }
  }

  const symptomCorrelation = detectSymptomCycleCorrelation(symptoms, sorted);
  if (Math.abs(symptomCorrelation) > 0.3 && cycleLengths.length >= 3) {
    algorithm += '+symptom_correlation';
  }

  const predictedPeriodDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : fallbackPeriodDuration;

  const lastPeriod = sorted[sorted.length - 1];
  const lastStart = parseDate(lastPeriod.start_date);
  const nextPeriod = addDays(lastStart, predictedCycleLength);
  const ovulation = addDays(lastStart, predictedCycleLength - 14);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);

  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (sorted.length >= 4 && variability <= 3) {
    confidence = 'high';
  } else if (sorted.length >= 3 && variability <= 5) {
    confidence = 'medium';
  } else if (sorted.length >= 2) {
    confidence = 'medium';
  }

  if (accuracyInfo.accuracyPercentage !== null) {
    if (accuracyInfo.accuracyPercentage >= 85) confidence = 'high';
    else if (accuracyInfo.accuracyPercentage < 60) confidence = 'low';
  }

  return {
    predictedCycleLength,
    predictedPeriodDuration,
    nextPeriodDate: formatDate(nextPeriod),
    ovulationDate: formatDate(ovulation),
    fertileWindowStart: formatDate(fertileStart),
    fertileWindowEnd: formatDate(fertileEnd),
    algorithm,
    confidence,
    modelParams: {
      weights,
      trend: Math.round(slope * 100) / 100,
      intercept: Math.round(intercept * 10) / 10,
      slope: Math.round(slope * 1000) / 1000,
      variability: Math.round(variability * 10) / 10,
      sampleSize: cycleLengths.length,
      biasCorrection,
    },
    accuracyInfo,
  };
}

export async function savePrediction(userId: string, prediction: PredictionResult): Promise<void> {
  const { supabase } = await import('./supabase');
  if (!prediction.nextPeriodDate) return;

  const { data: existing } = await supabase
    .from('prediction_audit')
    .select('id')
    .eq('user_id', userId)
    .is('actual_date', null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('prediction_audit')
      .update({
        predicted_date: prediction.nextPeriodDate,
        algorithm: prediction.algorithm,
        model_params: prediction.modelParams,
        confidence: prediction.confidence,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('prediction_audit').insert({
      user_id: userId,
      predicted_date: prediction.nextPeriodDate,
      algorithm: prediction.algorithm,
      model_params: prediction.modelParams,
      confidence: prediction.confidence,
    });
  }
}

export async function resolvePredictions(userId: string, periods: Period[]): Promise<void> {
  const { supabase } = await import('./supabase');
  if (periods.length < 2) return;

  const sorted = getSortedPeriods(periods);

  const { data: unresolved } = await supabase
    .from('prediction_audit')
    .select('*')
    .eq('user_id', userId)
    .is('actual_date', null)
    .order('created_at', { ascending: true });

  if (!unresolved || unresolved.length === 0) return;

  for (const pred of unresolved) {
    const predictedDate = parseDate(pred.predicted_date);
    let bestActual: string | null = null;
    let bestError = Infinity;

    for (const p of sorted) {
      const actual = parseDate(p.start_date);
      const error = Math.abs(daysBetween(predictedDate, actual));
      if (error < bestError && error < 21) {
        bestError = error;
        bestActual = p.start_date;
      }
    }

    if (bestActual) {
      const errorDays = daysBetween(parseDate(pred.predicted_date), parseDate(bestActual));
      await supabase
        .from('prediction_audit')
        .update({
          actual_date: bestActual,
          error_days: errorDays,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', pred.id);
    }
  }
}

export async function getPastPredictions(userId: string): Promise<PastPrediction[]> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase
    .from('prediction_audit')
    .select('predicted_date, actual_date, error_days')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  return (data as PastPrediction[]) || [];
}
