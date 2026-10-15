import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, PeriodDayLog, FlowLevel } from '@/lib/types';
import { parseDate, formatDateShort, daysBetween, buildPredictionModel } from '@/lib/cycle';
import { ChevronLeft, Droplet, TrendingUp, Calendar, Edit2, BarChart3, Activity } from 'lucide-react';

export function PeriodHistoryScreen({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [dayLogs, setDayLogs] = useState<PeriodDayLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [periodsRes, logsRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('period_day_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: true }),
    ]);
    setPeriods((periodsRes.data as Period[]) || []);
    setDayLogs((logsRes.data as PeriodDayLog[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100">{t('periodHistory')}</h1>
        </div>
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <Calendar className="text-primary-500" size={32} />
          </div>
          <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{t('noPeriodsLogged')}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-4">{t('noPeriodsLoggedDesc')}</p>
          <button onClick={() => onNavigate('log-period')} className="btn-primary">{t('logPeriod')}</button>
        </div>
      </div>
    );
  }

  // Compute cycle data
  const sortedPeriods = [...periods].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const model = profile ? buildPredictionModel(profile, periods) : null;

  // Cycle lengths
  const cycleLengths: { label: string; value: number }[] = [];
  for (let i = 1; i < sortedPeriods.length; i++) {
    const diff = daysBetween(parseDate(sortedPeriods[i - 1].start_date)!, parseDate(sortedPeriods[i].start_date)!);
    if (diff > 0 && diff < 90) {
      cycleLengths.push({ label: formatDateShort(sortedPeriods[i].start_date), value: diff });
    }
  }

  // Period durations
  const durations: number[] = sortedPeriods
    .filter((p) => p.end_date)
    .map((p) => daysBetween(parseDate(p.start_date)!, parseDate(p.end_date)!) + 1);

  // Flow patterns
  const flowCounts: Record<string, number> = { light: 0, medium: 0, heavy: 0 };
  dayLogs.forEach((l) => {
    if (l.flow_level) flowCounts[l.flow_level] = (flowCounts[l.flow_level] || 0) + 1;
  });

  // Symptom frequency from day logs
  const symptomCounts: Record<string, number> = {};
  dayLogs.forEach((l) => {
    l.symptoms.forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
  });
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Mood patterns from day logs
  const moodCounts: Record<string, number> = {};
  dayLogs.forEach((l) => {
    if (l.mood) moodCounts[l.mood] = (moodCounts[l.mood] || 0) + 1;
  });

  const avgCycle = cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((a, b) => a + b.value, 0) / cycleLengths.length) : profile?.cycle_length || 28;
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : profile?.period_duration || 5;
  const cycleVariation = cycleLengths.length >= 2 ? Math.round(Math.sqrt(cycleLengths.reduce((sum, c) => sum + Math.pow(c.value - avgCycle, 2), 0) / cycleLengths.length)) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100">{t('periodHistory')}</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('periodHistorySubtitle')}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-neutral-400">{t('averageCycleLength')}</p>
          <p className="font-serif text-xl font-bold text-primary-600 dark:text-primary-400 mt-1">{avgCycle}</p>
          <p className="text-xs text-neutral-400">{t('days')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-neutral-400">{t('periodDuration')}</p>
          <p className="font-serif text-xl font-bold text-accent-600 dark:text-accent-400 mt-1">{avgDuration}</p>
          <p className="text-xs text-neutral-400">{t('days')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-neutral-400">{t('cycleVariation')}</p>
          <p className="font-serif text-xl font-bold text-neutral-700 dark:text-neutral-300 mt-1">{cycleVariation || '—'}</p>
          <p className="text-xs text-neutral-400">{cycleVariation ? t('days') : ''}</p>
        </div>
      </div>

      {/* Cycle length chart */}
      {cycleLengths.length >= 2 && (
        <div className="card p-5">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary-500" />
            {t('cycleLength')} — {t('average')} {avgCycle} {t('days')}
          </h3>
          <div className="space-y-2">
            {cycleLengths.slice(-8).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 truncate">{c.label}</span>
                <div className="flex-1 h-6 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-lg transition-all flex items-center justify-end pr-2"
                    style={{ width: `${(c.value / Math.max(...cycleLengths.map((cl) => cl.value))) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{c.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flow pattern */}
      {(flowCounts.light + flowCounts.medium + flowCounts.heavy > 0) && (
        <div className="card p-5">
          <h3 className="section-title mb-4">{t('flowPattern')}</h3>
          <div className="flex gap-3">
            {(['light', 'medium', 'heavy'] as FlowLevel[]).map((f) => {
              const count = flowCounts[f] || 0;
              const total = Object.values(flowCounts).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = f === 'light' ? 'bg-success-500' : f === 'medium' ? 'bg-warning-500' : 'bg-error-500';
              const labelKey = f === 'light' ? 'flowLight' : f === 'medium' ? 'flowMedium' : 'flowHeavy';
              return (
                <div key={f} className="flex-1 text-center">
                  <div className="h-20 bg-neutral-100 dark:bg-neutral-700/30 rounded-xl flex items-end overflow-hidden">
                    <div className={`w-full ${color} transition-all`} style={{ height: `${Math.max(pct, 5)}%` }} />
                  </div>
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-2">{t(labelKey)}</p>
                  <p className="text-xs text-neutral-400">{count} {t('days')}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top symptoms */}
      {topSymptoms.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <Activity size={16} className="text-accent-500" />
            {t('commonSymptoms')}
          </h3>
          <div className="space-y-2">
            {topSymptoms.map(([symptom, count]) => (
              <div key={symptom} className="flex items-center gap-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 w-32 truncate">{symptom}</span>
                <div className="flex-1 h-5 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-accent-500 rounded-lg transition-all"
                    style={{ width: `${(count / topSymptoms[0][1]) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mood patterns */}
      {Object.keys(moodCounts).length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-4">{t('moodPatternsLabel')}</h3>
          <div className="flex items-end justify-around gap-2 h-28">
            {Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).map(([mood, count]) => {
              const maxCount = Math.max(...Object.values(moodCounts));
              const moodLabels: Record<string, string> = { happy: t('happy'), good: t('good'), neutral: t('neutral'), low: t('low'), difficult: t('difficult'), irritable: t('irritable') };
              return (
                <div key={mood} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full bg-neutral-100 dark:bg-neutral-700/30 rounded-lg relative flex items-end" style={{ height: '70px' }}>
                    <div className="w-full bg-primary-400 rounded-lg transition-all" style={{ height: `${(count / maxCount) * 100}%` }} />
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{count}</span>
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{moodLabels[mood] || mood}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Period cards */}
      <div>
        <h3 className="section-title mb-3">{t('periodHistory')}</h3>
        <div className="space-y-3">
          {periods.map((p, idx) => {
            const start = parseDate(p.start_date)!;
            const end = p.end_date ? parseDate(p.end_date) : null;
            const duration = end ? daysBetween(start, end) + 1 : null;
            const nextPeriod = periods[idx - 1];
            const cycleLen = nextPeriod ? daysBetween(start, parseDate(nextPeriod.start_date)!) : null;
            const periodDayLogs = dayLogs.filter((l) => l.period_id === p.id);
            const periodSymptoms = new Set<string>();
            periodDayLogs.forEach((l) => l.symptoms.forEach((s) => periodSymptoms.add(s)));
            const flowLabel = p.flow_level ? (p.flow_level === 'light' ? t('flowLight') : p.flow_level === 'medium' ? t('flowMedium') : t('flowHeavy')) : null;

            return (
              <div key={p.id} className="card p-5 animate-slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                      <Droplet size={18} fill="currentColor" />
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                        {formatDateShort(p.start_date)}{end ? ` → ${formatDateShort(end)}` : ' (ongoing)'}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {periods.length - idx} / {periods.length}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('log-period')}
                    className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label={t('edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-2">
                    <p className="text-xs text-neutral-400">{t('duration')}</p>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{duration ? `${duration}d` : '—'}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-2">
                    <p className="text-xs text-neutral-400">{t('cycleLength')}</p>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{cycleLen ? `${cycleLen}d` : '—'}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-2">
                    <p className="text-xs text-neutral-400">{t('overallFlow')}</p>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{flowLabel || '—'}</p>
                  </div>
                </div>

                {periodSymptoms.size > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {[...periodSymptoms].slice(0, 5).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 text-xs">
                          {s}
                        </span>
                      ))}
                      {periodSymptoms.size > 5 && <span className="px-2 py-0.5 text-xs text-neutral-400">+{periodSymptoms.size - 5}</span>}
                    </div>
                  </div>
                )}

                {p.notes && (
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 italic border-l-2 border-neutral-200 dark:border-neutral-700 pl-3">
                    {p.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prediction info */}
      {model && model.sampleSize >= 1 && (
        <div className="card p-5 bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-primary-500" />
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{t('predictionModel')}</h3>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('learnsFromCycles', { n: model.sampleSize })} · {t('predictedCycle')}: {model.predictedCycleLength} {t('days')}
          </p>
          {model.sampleSize < 3 && (
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">{t('logFewMoreCycles')}</p>
          )}
        </div>
      )}

      <button onClick={() => onNavigate('log-period')} className="btn-primary w-full flex items-center justify-center gap-2">
        <Calendar size={18} />
        {t('logPeriod')}
      </button>
    </div>
  );
}
