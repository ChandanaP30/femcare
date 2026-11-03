import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog, PeriodDayLog } from '@/lib/types';
import { generateInsights, type Insight } from '@/lib/symptoms';
import { formatDate, buildPredictionModel } from '@/lib/cycle';
import { TrendingUp, AlertCircle, Lightbulb, Bell, Activity, Gauge, type LucideIcon } from 'lucide-react';

export function InsightsScreen() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [dayLogs, setDayLogs] = useState<PeriodDayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [periodsRes, logsRes, dayLogsRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }),
      supabase.from('period_day_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }),
    ]);
    setPeriods(periodsRes.data as Period[] || []);
    setDailyLogs(logsRes.data as DailyLog[] || []);
    setDayLogs(dayLogsRes.data as PeriodDayLog[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (profile) {
      setInsights(generateInsights(periods, dailyLogs, profile.cycle_length, profile.period_duration));
    }
  }, [periods, dailyLogs, profile]);

  // Compute chart data
  const cycleLengthData = computeCycleLengths(periods);
  const symptomFrequency = computeSymptomFrequency(dailyLogs, dayLogs);
  const painTrend = computePainTrend(dailyLogs, dayLogs);
  const moodDistribution = computeMoodDistribution(dailyLogs, dayLogs, t);
  const flowDistribution = computeFlowDistribution(dayLogs, t);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = periods.length > 0 || dailyLogs.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('personalInsights')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('insightsSubtitle')}</p>
      </div>

      {/* Disclaimer */}
      <div className="card-soft p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-warning-500 shrink-0 mt-0.5 dark:text-warning-300" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('cyclePredictionsEstimates')}
        </p>
      </div>

      {/* Prediction model summary */}
      {profile && periods.length >= 1 && (() => {
        const model = buildPredictionModel(profile, periods);
        const trendLabel = model.trendDirection === 'shortening' ? t('cyclesShortening') : model.trendDirection === 'lengthening' ? t('cyclesLengthening') : t('cyclesStable');
        return (
          <div className="card p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                <Gauge size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{t('predictionModel')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('learnsFromCycles', { n: model.sampleSize })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('predictedCycle')}</p>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{model.predictedCycleLength} {t('days')}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('predictedPeriod')}</p>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{model.predictedPeriodDuration} {t('days')}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('regularity')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                    <div className="h-full bg-success-500 rounded-full transition-all duration-500" style={{ width: `${model.regularityScore}%` }} />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{model.regularityScore}%</span>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('confidence')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${model.confidence}%` }} />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{model.confidence}%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
              {trendLabel}. {t('recentCyclesInfluence')}
            </p>
          </div>
        );
      })()}

      {/* Insights cards */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = insightIcon(insight.type);
          const color = insightColor(insight.type);
          return (
            <div key={i} className="card p-5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm mb-1">{insight.title}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {hasData ? (
        <div className="space-y-6">
          {/* Cycle length over time */}
          {cycleLengthData.length >= 2 ? (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('cycleLength')}</h3>
              <BarChart data={cycleLengthData} unit={t('days')} color="bg-gradient-to-r from-primary-400 to-primary-500" />
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="section-title mb-2">{t('cycleLength')}</h3>
              <p className="text-sm text-neutral-400">{t('moreDataNeeded')}</p>
            </div>
          )}

          {/* Flow distribution */}
          {flowDistribution.length > 0 && (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('avgFlowLabel')}</h3>
              <div className="flex gap-3">
                {flowDistribution.map((f) => (
                  <div key={f.label} className="flex-1 text-center">
                    <div className="h-20 bg-neutral-100 dark:bg-neutral-700/30 rounded-xl flex items-end overflow-hidden">
                      <div className={`w-full ${f.color} rounded-xl transition-all duration-500`} style={{ height: `${Math.max(f.pct, 5)}%` }} />
                    </div>
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-2">{f.label}</p>
                    <p className="text-xs text-neutral-400">{f.value} {t('days')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Symptom frequency */}
          {symptomFrequency.length > 0 ? (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('topSymptomsLabel')}</h3>
              <div className="space-y-2">
                {symptomFrequency.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 w-32 truncate">{s.label}</span>
                    <div className="flex-1 h-6 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg overflow-hidden">
                      <div className="h-full bg-accent-500 rounded-lg transition-all duration-500" style={{ width: `${(s.value / symptomFrequency[0].value) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 w-8 text-right">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="section-title mb-2">{t('topSymptomsLabel')}</h3>
              <p className="text-sm text-neutral-400">{t('moreDataNeeded')}</p>
            </div>
          )}

          {/* Pain trend */}
          {painTrend.length >= 3 ? (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('painTrend')}</h3>
              <LineChart data={painTrend} max={10} />
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="section-title mb-2">{t('painTrend')}</h3>
              <p className="text-sm text-neutral-400">{t('moreDataNeeded')}</p>
            </div>
          )}

          {/* Mood distribution */}
          {moodDistribution.length > 0 ? (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('moodDistribution')}</h3>
              <div className="flex items-end justify-around gap-2 h-32">
                {moodDistribution.map((m) => (
                  <div key={m.label} className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-full bg-neutral-100 dark:bg-neutral-700/30 rounded-lg relative flex items-end" style={{ height: '80px' }}>
                      <div className="w-full bg-primary-400 rounded-lg transition-all duration-500" style={{ height: `${(m.value / moodDistribution[0].value) * 100}%` }} />
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{m.value}</span>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Period history table */}
          {periods.length > 0 && (
            <div className="card p-5">
              <h3 className="section-title mb-4">{t('periodHistory')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">{t('date')}</th>
                      <th className="pb-2 font-medium">{t('duration')}</th>
                      <th className="pb-2 font-medium">{t('cycleLength')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => {
                      const next = periods[i - 1];
                      const cycleLen = next ? Math.round((new Date(next.start_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
                      const duration = p.end_date ? Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1 : null;
                      return (
                        <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-700/50">
                          <td className="py-2.5 text-neutral-500 dark:text-neutral-400">{periods.length - i}</td>
                          <td className="py-2.5 text-neutral-700 dark:text-neutral-300">{formatDate(p.start_date)}</td>
                          <td className="py-2.5 text-neutral-700 dark:text-neutral-300">{duration ? `${duration} ${t('days')}` : '—'}</td>
                          <td className="py-2.5 text-neutral-700 dark:text-neutral-300">{cycleLen ? `${cycleLen} ${t('days')}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <Activity className="text-primary-500" size={32} />
          </div>
          <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{t('noPeriodData')}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            {t('startByLogging')}
          </p>
        </div>
      )}
    </div>
  );
}

function insightIcon(type: Insight['type']): LucideIcon {
  switch (type) {
    case 'pattern': return TrendingUp;
    case 'frequency': return Activity;
    case 'cycle': return TrendingUp;
    case 'reminder': return Bell;
    case 'selfcare': return Lightbulb;
  }
}

function insightColor(type: Insight['type']): string {
  switch (type) {
    case 'pattern': return 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400';
    case 'frequency': return 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400';
    case 'cycle': return 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400';
    case 'reminder': return 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400';
    case 'selfcare': return 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400';
  }
}

function computeCycleLengths(periods: Period[]): { label: string; value: number }[] {
  const sorted = [...periods].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const result: { label: string; value: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i].start_date).getTime() - new Date(sorted[i - 1].start_date).getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < 90) {
      result.push({ label: formatDate(sorted[i].start_date), value: diff });
    }
  }
  return result;
}

function computeSymptomFrequency(logs: DailyLog[], dayLogs: PeriodDayLog[]): { label: string; value: number }[] {
  const counts: Record<string, number> = {};
  logs.forEach((l) => l.symptoms.forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
  dayLogs.forEach((l) => l.symptoms.forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
  return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
}

function computePainTrend(logs: DailyLog[], dayLogs: PeriodDayLog[]): { label: string; value: number }[] {
  const allLogs = [
    ...logs.map((l) => ({ date: l.log_date, pain: l.pain_level })),
    ...dayLogs.map((l) => ({ date: l.log_date, pain: l.pain_level })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return allLogs.slice(-10).map((l) => ({ label: l.date, value: l.pain }));
}

function computeMoodDistribution(logs: DailyLog[], dayLogs: PeriodDayLog[], t: (key: 'happy' | 'good' | 'neutral' | 'low' | 'difficult' | 'irritable') => string): { label: string; value: number }[] {
  const counts: Record<string, number> = {};
  logs.forEach((l) => { if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1; });
  dayLogs.forEach((l) => { if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1; });
  const labelMap: Record<string, 'happy' | 'good' | 'neutral' | 'low' | 'difficult' | 'irritable'> = { happy: 'happy', good: 'good', neutral: 'neutral', low: 'low', difficult: 'difficult', irritable: 'irritable' };
  return Object.entries(counts).map(([k, v]) => ({ label: labelMap[k] ? t(labelMap[k]) : k, value: v })).sort((a, b) => b.value - a.value);
}

function computeFlowDistribution(dayLogs: PeriodDayLog[], t: (key: 'flowLight' | 'flowMedium' | 'flowHeavy') => string): { label: string; value: number; pct: number; color: string }[] {
  const counts: Record<string, number> = { light: 0, medium: 0, heavy: 0 };
  dayLogs.forEach((l) => { if (l.flow_level) counts[l.flow_level] = (counts[l.flow_level] || 0) + 1; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return [
    { label: t('flowLight'), value: counts.light, pct: total > 0 ? Math.round((counts.light / total) * 100) : 0, color: 'bg-success-500' },
    { label: t('flowMedium'), value: counts.medium, pct: total > 0 ? Math.round((counts.medium / total) * 100) : 0, color: 'bg-warning-500' },
    { label: t('flowHeavy'), value: counts.heavy, pct: total > 0 ? Math.round((counts.heavy / total) * 100) : 0, color: 'bg-error-500' },
  ].filter((f) => f.value > 0);
}

function BarChart({ data, unit, color }: { data: { label: string; value: number }[]; unit: string; color: string }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 truncate">{d.label}</span>
          <div className="flex-1 h-7 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg overflow-hidden">
            <div className={`h-full ${color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`} style={{ width: `${(d.value / max) * 100}%` }}>
              <span className="text-xs text-white font-medium">{d.value}</span>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-neutral-400 mt-2">{unit}</p>
    </div>
  );
}

function LineChart({ data, max }: { data: { label: string; value: number }[]; max: number }) {
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (d.value / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-full h-32" preserveAspectRatio="none">
        <polyline points={points} fill="none" className="stroke-primary-500 dark:stroke-primary-300" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * 100;
          const y = 100 - (d.value / max) * 100;
          return <circle key={i} cx={x} cy={y} r="2" className="fill-primary-500 dark:fill-primary-300" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-neutral-400 mt-1">
        <span>0</span><span>{max}</span>
      </div>
    </div>
  );
}
