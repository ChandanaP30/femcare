import type { DailyLog, Period } from './types';

export const PHYSICAL_SYMPTOMS = [
  'Cramps',
  'Headache',
  'Back pain',
  'Bloating',
  'Acne',
  'Fatigue',
  'Nausea',
  'Breast tenderness',
  'Dizziness',
];

export const EMOTIONAL_SYMPTOMS = [
  'Irritability',
  'Anxiety',
  'Sadness',
  'Mood swings',
  'Stress',
  'Low energy',
];

export const ALL_SYMPTOMS = [...PHYSICAL_SYMPTOMS, ...EMOTIONAL_SYMPTOMS];

export const MOODS = [
  { key: 'good', emoji: '😊', label: 'Good', color: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' },
  { key: 'okay', emoji: '🙂', label: 'Okay', color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' },
  { key: 'neutral', emoji: '😐', label: 'Neutral', color: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300' },
  { key: 'low', emoji: '😔', label: 'Low', color: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300' },
  { key: 'difficult', emoji: '😣', label: 'Difficult', color: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300' },
];

export function getMood(key: string) {
  return MOODS.find((m) => m.key === key);
}

export function symptomCategory(symptom: string): 'physical' | 'emotional' {
  return EMOTIONAL_SYMPTOMS.includes(symptom) ? 'emotional' : 'physical';
}

export interface Insight {
  type: 'pattern' | 'frequency' | 'cycle' | 'reminder' | 'selfcare';
  title: string;
  description: string;
}

export function generateInsights(
  periods: Period[],
  dailyLogs: DailyLog[],
  cycleLength: number,
  periodDuration: number
): Insight[] {
  const insights: Insight[] = [];

  if (periods.length === 0 && dailyLogs.length === 0) {
    insights.push({
      type: 'reminder',
      title: 'Welcome to FemCare+',
      description:
        'Start by logging your period and daily symptoms. The more you log, the more personalised your insights become.',
    });
    return insights;
  }

  // Symptom frequency
  const symptomCounts: Record<string, number> = {};
  dailyLogs.forEach((log) => {
    log.symptoms.forEach((s) => {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    });
  });

  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topSymptoms.length > 0) {
    const topSymptom = topSymptoms[0];
    const totalLogs = dailyLogs.length;
    const percentage = Math.round((topSymptom[1] / totalLogs) * 100);
    insights.push({
      type: 'frequency',
      title: 'Most frequent symptom',
      description: `You logged "${topSymptom[0]}" on ${topSymptom[1]} of ${totalLogs} days (${percentage}%). If this symptom is severe or persistent, consider speaking with a healthcare professional.`,
    });
  }

  // Period-day symptom patterns
  if (periods.length > 0 && dailyLogs.length > 0) {
    const sortedPeriods = [...periods].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
    const lastPeriod = sortedPeriods[0];
    const periodStart = new Date(lastPeriod.start_date);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + periodDuration - 1);

    const periodLogs = dailyLogs.filter((log) => {
      const d = new Date(log.log_date);
      return d >= periodStart && d <= periodEnd;
    });

    if (periodLogs.length > 0) {
      const periodSymptomCounts: Record<string, number> = {};
      periodLogs.forEach((log) => {
        log.symptoms.forEach((s) => {
          periodSymptomCounts[s] = (periodSymptomCounts[s] || 0) + 1;
        });
      });

      const topPeriodSymptom = Object.entries(periodSymptomCounts).sort((a, b) => b[1] - a[1])[0];
      if (topPeriodSymptom) {
        insights.push({
          type: 'pattern',
          title: 'Symptoms during your period',
          description: `You logged "${topPeriodSymptom[0]}" on ${topPeriodSymptom[1]} of your last ${periodLogs.length} period day(s).`,
        });
      }
    }
  }

  // Cycle length changes
  if (periods.length >= 3) {
    const sortedPeriods = [...periods].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    const cycleLengths: number[] = [];
    for (let i = 1; i < sortedPeriods.length; i++) {
      const diff = Math.round(
        (new Date(sortedPeriods[i].start_date).getTime() - new Date(sortedPeriods[i - 1].start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (diff > 0 && diff < 90) cycleLengths.push(diff);
    }

    if (cycleLengths.length >= 2) {
      const avg = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      const last = cycleLengths[cycleLengths.length - 1];
      const diff = Math.abs(last - avg);

      if (diff > 5) {
        insights.push({
          type: 'cycle',
          title: 'Cycle length variation',
          description: `Your last cycle was ${last} days, which is ${diff} days ${last > avg ? 'longer' : 'shorter'} than your average of ${avg} days. Some variation is normal. If cycles are consistently irregular, consider speaking with a healthcare professional.`,
        });
      } else {
        insights.push({
          type: 'cycle',
          title: 'Cycle consistency',
          description: `Your recent cycles average ${avg} days, which is within a typical range. Keep logging to maintain accurate tracking.`,
        });
      }
    }
  }

  // Pain level trends
  const logsWithPain = dailyLogs.filter((l) => l.pain_level > 0);
  if (logsWithPain.length >= 3) {
    const avgPain = Math.round((logsWithPain.reduce((sum, l) => sum + l.pain_level, 0) / logsWithPain.length) * 10) / 10;
    const highPainDays = logsWithPain.filter((l) => l.pain_level >= 7).length;

    if (highPainDays > 0) {
      insights.push({
        type: 'pattern',
        title: 'Pain levels',
        description: `Your average pain level is ${avgPain}/10, with ${highPainDays} day(s) rated 7 or above. If you experience severe pain regularly, this is worth discussing with a qualified healthcare professional.`,
      });
    }
  }

  // Mood trends
  const moodCounts: Record<string, number> = {};
  dailyLogs.forEach((log) => {
    if (log.mood) moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
  });

  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  if (dominantMood && (dominantMood[0] === 'low' || dominantMood[0] === 'difficult')) {
    insights.push({
      type: 'pattern',
      title: 'Mood patterns',
      description: `You've logged "${dominantMood[0]}" as your most common mood. If you're feeling persistently low, consider reaching out to someone you trust or a mental health professional.`,
    });
  }

  // Self-care suggestions based on phase
  insights.push({
    type: 'selfcare',
    title: 'Self-care reminder',
    description:
      'Staying hydrated, getting enough sleep, and gentle movement can help manage symptoms throughout your cycle. Consider tracking these alongside your symptoms.',
  });

  if (insights.length < 2) {
    insights.push({
      type: 'reminder',
      title: 'Keep logging',
      description: 'More data is needed to show additional patterns. Try logging daily for more personalised insights.',
    });
  }

  return insights;
}
