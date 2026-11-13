import { PageHeader } from '@/components/PageHeader';
import { canonicalSymptom } from '@/lib/symptom-names';
// fc-insights-v2
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog, PeriodDayLog } from '@/lib/types';
import { generateInsights, type Insight } from '@/lib/symptoms';
import { buildPredictionModel } from '@/lib/cycle';
import { formatLocalDate } from '@/lib/format-date';
import { translateSymptom } from '@/lib/symptom-labels';
import { tr, type TextKey } from '@/lib/insights-text';
import { TrendingUp, AlertCircle, Lightbulb, Bell, Activity, Gauge, type LucideIcon } from 'lucide-react';

type RangeKey = '3m' | '6m' | '1y' | 'all';
const RANGES: { key: RangeKey; labelKey: TextKey; months: number | null }[] = [
  { key: '3m', labelKey: 'range3m', months: 3 },
  { key: '6m', labelKey: 'range6m', months: 6 },
  { key: '1y', labelKey: 'range1y', months: 12 },
  { key: 'all', labelKey: 'rangeAll', months: null },
];

const MOOD_COLORS = ['bg-primary-400', 'bg-accent-500', 'bg-success-500', 'bg-warning-500', 'bg-error-500', 'bg-primary-200'];

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function cutoffFor(months: number | null): string | null {
  if (months === null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toIso(d);
}

function inRange(date: string, cutoff: string | null): boolean {
  return cutoff === null || date.slice(0, 10) >= cutoff;
}

function fmtDate(s: string, lang: string, withYear = false): string {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return s;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(
      lang,
      withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' },
    );
  } catch {
    return s;
  }
}

function pct(v: number, total: number): number {
  return total > 0 ? Math.round((v / total) * 100) : 0;
}

export function InsightsScreen() {
  const { profile, user } = useAuth();
  const { t, lang } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [dayLogs, setDayLogs] = useState<PeriodDayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [range, setRange] = useState<RangeKey>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);

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
      setInsights(generateInsights(periods, dailyLogs, profile.cycle_length, profile.period_duration, t, lang));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, dailyLogs, profile, lang]);

  // ---- date-range filtering (charts and history only; insight cards and prediction use all data) ----
  const cutoff = useMemo(() => cutoffFor(RANGES.find((r) => r.key === range)?.months ?? null), [range]);
  const fDaily = useMemo(() => dailyLogs.filter((l) => inRange(l.log_date, cutoff)), [dailyLogs, cutoff]);
  const fDay = useMemo(() => dayLogs.filter((l) => inRange(l.log_date, cutoff)), [dayLogs, cutoff]);

  const cycleView = useMemo(() => {
    const pts = computeCycleLengths(periods).filter((c) => inRange(c.to, cutoff));
    if (pts.length === 0) return null;
    const vals = pts.map((c) => c.value);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const lo = Math.max(0, Math.floor(Math.min(min, mean)) - 2);
    let hi = Math.ceil(Math.max(max, mean)) + 2;
    if (hi - lo < 6) hi = lo + 6;
    return { pts, mean, avg: Math.round(mean), min, max, last: vals[vals.length - 1], lo, hi };
  }, [periods, cutoff]);

  const symptoms = useMemo(() => computeSymptomFrequency(fDaily, fDay), [fDaily, fDay]);
  const moods = useMemo(() => computeMoodDistribution(fDaily, fDay, t, tr(lang, 'okay')), [fDaily, fDay, t, lang]);
  const moodTotal = moods.reduce((a, m) => a + m.value, 0);
  const painTrend = useMemo(() => computePainTrend(fDaily, fDay), [fDaily, fDay]);
  const flowDistribution = useMemo(() => computeFlowDistribution(fDay, t), [fDay, t]);

  const historyRows = useMemo(
    () =>
      periods
        .map((p, i) => {
          const next = periods[i - 1];
          const cycleLen = next ? Math.round((new Date(next.start_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
          const duration = p.end_date ? Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1 : null;
          return { p, num: periods.length - i, cycleLen, duration };
        })
        .filter((r) => inRange(r.p.start_date, cutoff)),
    [periods, cutoff],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = periods.length > 0 || dailyLogs.length > 0;
  const visibleHistory = showAllHistory ? historyRows : historyRows.slice(0, 6);

  return (
    <div className="space-y-5 pb-6 animate-fade-in">
      <PageHeader title={t('personalInsights')} subtitle={t('insightsSubtitle')} art="leaves" />

      {/* Disclaimer */}
      <div className="card-soft flex items-start gap-3 p-3.5">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning-500 dark:text-warning-300" />
        <p className="text-xs leading-relaxed text-ink-muted">{t('cyclePredictionsEstimates')}</p>
      </div>

      {/* Prediction model summary */}
      {profile && periods.length >= 1 && (() => {
        const model = buildPredictionModel(profile, periods);
        const trendLabel = model.trendDirection === 'shortening' ? t('cyclesShortening') : model.trendDirection === 'lengthening' ? t('cyclesLengthening') : t('cyclesStable');
        return (
          <div className="card animate-slide-up p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300">
                <Gauge size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">{t('predictionModel')}</h3>
                <p className="text-xs text-ink-muted">{t('learnsFromCycles', { n: model.sampleSize })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-primary-50 p-2.5 dark:bg-white/5">
                <p className="text-[11px] text-ink-muted">{t('predictedCycle')}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{model.predictedCycleLength} {t('days')}</p>
              </div>
              <div className="rounded-xl bg-primary-50 p-2.5 dark:bg-white/5">
                <p className="text-[11px] text-ink-muted">{t('predictedPeriod')}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{model.predictedPeriodDuration} {t('days')}</p>
              </div>
              <div className="rounded-xl bg-primary-50 p-2.5 dark:bg-white/5">
                <p className="text-[11px] text-ink-muted">{t('regularity')}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-success-500 transition-all duration-500" style={{ width: `${model.regularityScore}%` }} />
                  </div>
                  <span className="text-xs font-medium text-ink">{model.regularityScore}%</span>
                </div>
              </div>
              <div className="rounded-xl bg-primary-50 p-2.5 dark:bg-white/5">
                <p className="text-[11px] text-ink-muted">{t('confidence')}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${model.confidence}%` }} />
                  </div>
                  <span className="text-xs font-medium text-ink">{model.confidence}%</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-muted">{trendLabel}. {t('recentCyclesInfluence')}</p>
          </div>
        );
      })()}

      {/* Insight cards */}
      {insights.length > 0 && (
        <div className="space-y-2.5">
          {insights.map((insight, i) => {
            const Icon = insightIcon(insight.type);
            const color = insightColor(insight.type);
            return (
              <div key={i} className="card animate-slide-up p-4" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-0.5 text-sm font-semibold text-ink">{insight.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-muted">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasData ? (
        <>
          {/* Date range filter */}
          <div>
            <div className="grid grid-cols-4 gap-1 rounded-full bg-secondary-200 p-1 dark:bg-white/10" role="tablist" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={range === r.key}
                  onClick={() => { setRange(r.key); setShowAllHistory(false); }}
                  className={`rounded-full py-1.5 text-xs font-medium transition-colors ${
                    range === r.key ? 'bg-primary-500 text-ink-onlight shadow-soft' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tr(lang, r.labelKey)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-ink-muted">{tr(lang, 'rangeNote')}</p>
          </div>

          {/* Cycle length trend */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">{t('cycleLength')}</h3>
              <span className="text-xs text-ink-muted">{t('days')}</span>
            </div>
            {cycleView ? (
              <>
                <div className="mb-3 grid grid-cols-4 divide-x divide-primary-100 rounded-xl bg-primary-50 py-2 text-center dark:divide-white/10 dark:bg-white/5">
                  {[
                    [tr(lang, 'average'), cycleView.avg],
                    [tr(lang, 'shortest'), cycleView.min],
                    [tr(lang, 'longest'), cycleView.max],
                    [tr(lang, 'cycles'), cycleView.pts.length],
                  ].map(([label, value]) => (
                    <div key={label} className="px-1">
                      <p className="text-base font-semibold leading-tight text-ink">{value}</p>
                      <p className="text-[10px] text-ink-muted">{label}</p>
                    </div>
                  ))}
                </div>
                {cycleView.pts.length >= 2 ? (
                  <TrendChart
                    key={range}
                    points={cycleView.pts.map((c) => ({
                      axis: fmtDate(c.to, lang),
                      value: c.value,
                      detail: `${fmtDate(c.from, lang, true)} \u2192 ${fmtDate(c.to, lang, true)}`,
                      valueText: `${c.value} ${t('days')}`,
                    }))}
                    yMin={cycleView.lo}
                    yMax={cycleView.hi}
                    avg={cycleView.mean}
                    avgLabel={tr(lang, 'avgLabel', { n: cycleView.avg })}
                    seriesLabel={t('cycleLength')}
                    ariaLabel={t('cycleLength')}
                  />
                ) : (
                  <p className="text-sm text-ink-muted">{t('moreDataNeeded')}</p>
                )}
                <Takeaway text={cycleTakeaway(cycleView, lang)} />
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t('moreDataNeeded')}</p>
            )}
          </div>

          {/* Symptoms */}
          <div className="card p-4">
            <h3 className="section-title mb-3">{t('topSymptomsLabel')}</h3>
            {symptoms.items.length > 0 ? (
              <>
                <RankedBars
                  key={range}
                  items={symptoms.items.map((s) => ({ label: translateSymptom(s.label, lang), value: s.value }))}
                  total={symptoms.total}
                />
                <Takeaway
                  text={tr(lang, 'symptomTop', { name: translateSymptom(symptoms.items[0].label, lang), n: symptoms.items[0].value, p: pct(symptoms.items[0].value, symptoms.total) })}
                />
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t('moreDataNeeded')}</p>
            )}
          </div>

          {/* Moods */}
          {moods.length > 0 && (
            <div className="card p-4">
              <h3 className="section-title mb-3">{t('moodDistribution')}</h3>
              <MoodBar key={range} items={moods} total={moodTotal} />
              <Takeaway text={tr(lang, 'moodTop', { name: moods[0].label, n: moods[0].value, total: moodTotal })} />
            </div>
          )}

          {/* Pain trend */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">{t('painTrend')}</h3>
              <span className="text-xs text-ink-muted">0-10</span>
            </div>
            {painTrend.length >= 3 ? (
              <>
                <TrendChart
                  key={range}
                  points={painTrend.map((p) => ({
                    axis: fmtDate(p.label, lang),
                    value: p.value,
                    detail: fmtDate(p.label, lang, true),
                    valueText: `${p.value}/10`,
                  }))}
                  yMin={0}
                  yMax={10}
                  seriesLabel={t('painTrend')}
                  ariaLabel={t('painTrend')}
                />
                <Takeaway text={painTakeaway(painTrend, lang)} />
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t('moreDataNeeded')}</p>
            )}
          </div>

          {/* Flow distribution */}
          {flowDistribution.length > 0 && (
            <div className="card p-4">
              <h3 className="section-title mb-3">{t('avgFlowLabel')}</h3>
              <div className="flex gap-3">
                {flowDistribution.map((f) => (
                  <div key={f.label} className="flex-1 text-center">
                    <div className="flex h-16 items-end overflow-hidden rounded-xl bg-primary-100/70 dark:bg-white/10">
                      <div className={`w-full rounded-xl transition-all duration-500 ${f.color}`} style={{ height: `${Math.max(f.pct, 5)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-ink">{f.label}</p>
                    <p className="text-[11px] text-ink-muted">{f.value} {t('days')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period history */}
          <div className="card p-4">
            <h3 className="section-title mb-3">{t('periodHistory')}</h3>
            {historyRows.length > 0 ? (
              <>
                <div className="grid grid-cols-[1.75rem_1fr_1fr_1fr] gap-2 border-b border-primary-100 pb-2 text-[11px] font-medium text-ink-muted dark:border-white/10">
                  <span>#</span>
                  <span>{t('date')}</span>
                  <span>{t('duration')}</span>
                  <span>{t('cycleLength')}</span>
                </div>
                <div className="divide-y divide-primary-100 dark:divide-white/10">
                  {visibleHistory.map((r) => (
                    <div key={r.p.id} className="grid grid-cols-[1.75rem_1fr_1fr_1fr] items-center gap-2 py-2 text-xs">
                      <span className="text-ink-muted">{r.num}</span>
                      <span className="text-ink">{formatLocalDate(r.p.start_date)}</span>
                      <span className="text-ink">{r.duration ? `${r.duration} ${t('days')}` : '\u2014'}</span>
                      <span className="text-ink">{r.cycleLen ? `${r.cycleLen} ${t('days')}` : '\u2014'}</span>
                    </div>
                  ))}
                </div>
                {historyRows.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory((v) => !v)}
                    className="mt-2 w-full rounded-full bg-secondary-200 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-primary-100 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    {showAllHistory ? tr(lang, 'showLess') : tr(lang, 'showAll', { n: historyRows.length })}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t('moreDataNeeded')}</p>
            )}
          </div>
        </>
      ) : (
        <div className="card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
            <Activity className="text-primary-500" size={28} />
          </div>
          <h3 className="mb-2 font-serif text-lg font-semibold text-ink">{t('noPeriodData')}</h3>
          <p className="mx-auto max-w-sm text-sm text-ink-muted">{t('startByLogging')}</p>
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

// ---------------------------------------------------------------------------
// Data calculations (same rules as before; cycle lengths now also keep their dates)
// ---------------------------------------------------------------------------

interface CyclePoint { from: string; to: string; value: number }

function computeCycleLengths(periods: Period[]): CyclePoint[] {
  const sorted = [...periods].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const result: CyclePoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i].start_date).getTime() - new Date(sorted[i - 1].start_date).getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < 90) {
      result.push({ from: sorted[i - 1].start_date, to: sorted[i].start_date, value: diff });
    }
  }
  return result;
}

function computeSymptomFrequency(logs: DailyLog[], dayLogs: PeriodDayLog[]): { items: { label: string; value: number }[]; total: number } {
  const counts: Record<string, number> = {};
  logs.forEach((l) => l.symptoms.forEach((s) => { const k = canonicalSymptom(s); counts[k] = (counts[k] || 0) + 1; }));
  dayLogs.forEach((l) => l.symptoms.forEach((s) => { const k = canonicalSymptom(s); counts[k] = (counts[k] || 0) + 1; }));
  const all = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return { items: all.slice(0, 6), total: all.reduce((a, s) => a + s.value, 0) };
}

function computePainTrend(logs: DailyLog[], dayLogs: PeriodDayLog[]): { label: string; value: number }[] {
  const allLogs = [
    ...logs.map((l) => ({ date: l.log_date, pain: l.pain_level })),
    ...dayLogs.map((l) => ({ date: l.log_date, pain: l.pain_level })),
  ]
    .filter((l) => Number.isFinite(l.pain))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return allLogs.slice(-10).map((l) => ({ label: l.date, value: l.pain }));
}

function computeMoodDistribution(logs: DailyLog[], dayLogs: PeriodDayLog[], t: (key: 'happy' | 'good' | 'neutral' | 'low' | 'difficult' | 'irritable') => string, okayLabel: string): { label: string; value: number }[] {
  const counts: Record<string, number> = {};
  logs.forEach((l) => { if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1; });
  dayLogs.forEach((l) => { if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1; });
  const labelMap: Record<string, 'happy' | 'good' | 'neutral' | 'low' | 'difficult' | 'irritable'> = { happy: 'happy', good: 'good', neutral: 'neutral', low: 'low', difficult: 'difficult', irritable: 'irritable' };
  return Object.entries(counts).map(([k, v]) => ({ label: labelMap[k] ? t(labelMap[k]) : k === 'okay' ? okayLabel : k, value: v })).sort((a, b) => b.value - a.value);
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

// Plain-language sentences. They only restate numbers from the user's own logs.
function cycleTakeaway(v: { pts: CyclePoint[]; avg: number; min: number; max: number; last: number }, lang: string): string {
  if (v.pts.length === 1) return tr(lang, 'cycleOne', { n: v.last });
  let s = tr(lang, 'cycleRange', { n: v.pts.length, min: v.min, max: v.max, avg: v.avg });
  const diff = v.last - v.avg;
  if (diff === 0) {
    s += tr(lang, 'latestSame');
  } else {
    const n = Math.abs(diff);
    s += tr(lang, diff > 0 ? 'latestLonger' : 'latestShorter', { n, d: tr(lang, n === 1 ? 'dayOne' : 'dayMany') });
  }
  return s;
}

function painTakeaway(data: { value: number }[], lang: string): string {
  const vals = data.map((d) => d.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return tr(lang, 'painTake', { n: vals.length, avg: avg.toFixed(1), max: Math.max(...vals) });
}
// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function Takeaway({ text }: { text: string }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-primary-50 p-3 dark:bg-white/5">
      <Lightbulb size={14} className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-300" />
      <p className="text-xs leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function Readout({ title, value }: { title: string; value: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 rounded-xl bg-primary-50 px-3 py-2 dark:bg-white/5" aria-live="polite">
      <p className="min-w-0 truncate text-xs text-ink-muted">{title}</p>
      <p className="shrink-0 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

interface TrendPoint { axis: string; value: number; detail: string; valueText: string }

function TrendChart({ points, yMin, yMax, avg, avgLabel, seriesLabel, ariaLabel }: {
  points: TrendPoint[];
  yMin: number;
  yMax: number;
  avg?: number;
  avgLabel?: string;
  seriesLabel: string;
  ariaLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, el.clientWidth));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const height = 180;
  const padL = 28;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (i: number) => (n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const active = sel !== null && sel < n ? sel : n - 1;
  const cur = points[active];
  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const baseY = (padT + innerH).toFixed(1);
  const area = `${line} L${coords[n - 1].x.toFixed(1)} ${baseY} L${coords[0].x.toFixed(1)} ${baseY} Z`;
  const ticks = [yMin, Math.round((yMin + yMax) / 2), yMax];
  const labelIdx = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));
  const showAllDots = n <= 20;

  function pick(clientX: number, left: number) {
    if (n === 1) { setSel(0); return; }
    const raw = ((clientX - left - padL) / innerW) * (n - 1);
    setSel(Math.max(0, Math.min(n - 1, Math.round(raw))));
  }

  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(Math.max(0, active - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setSel(Math.min(n - 1, active + 1)); }
  }

  return (
    <div>
      <Readout title={cur.detail} value={cur.valueText} />
      <div ref={wrapRef} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="block max-w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          style={{ touchAction: 'pan-y' }}
        >
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={padL} x2={width - padR} y1={yAt(tk)} y2={yAt(tk)} strokeWidth="1" style={{ stroke: 'rgb(var(--line))' }} />
              <text x={padL - 6} y={yAt(tk) + 3} textAnchor="end" fontSize="10" style={{ fill: 'rgb(var(--ink-muted))' }}>{tk}</text>
            </g>
          ))}
          {avg !== undefined && (
            <line x1={padL} x2={width - padR} y1={yAt(avg)} y2={yAt(avg)} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.7" style={{ stroke: 'rgb(var(--ink-muted))' }} />
          )}
          <path d={area} className="fill-primary-500 dark:fill-primary-300" opacity="0.12" />
          <path d={line} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-500 dark:stroke-primary-300" />
          <line x1={coords[active].x} x2={coords[active].x} y1={padT} y2={padT + innerH} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" style={{ stroke: 'rgb(var(--ink-muted))' }} />
          {coords.map((c, i) =>
            i === active ? null : showAllDots ? <circle key={i} cx={c.x} cy={c.y} r="3" className="fill-primary-500 dark:fill-primary-300" /> : null,
          )}
          <circle cx={coords[active].x} cy={coords[active].y} r="5.5" strokeWidth="2.5" className="fill-primary-500 dark:fill-primary-300" style={{ stroke: 'rgb(var(--card))' }} />
          {labelIdx.map((i, k) => (
            <text
              key={i}
              x={coords[i].x}
              y={height - 6}
              fontSize="10"
              textAnchor={k === 0 && labelIdx.length > 1 ? 'start' : i === n - 1 && labelIdx.length > 1 ? 'end' : 'middle'}
              style={{ fill: 'rgb(var(--ink-muted))' }}
            >
              {points[i].axis}
            </text>
          ))}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
          />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary-500 dark:bg-primary-300" />
          {seriesLabel}
        </span>
        {avg !== undefined && avgLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-current opacity-70" />
            {avgLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function RankedBars({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  const [sel, setSel] = useState(0);
  const active = sel < items.length ? sel : 0;
  const top = items[0].value || 1;
  const cur = items[active];
  return (
    <div>
      <Readout title={cur.label} value={`${cur.value}\u00d7 \u00b7 ${pct(cur.value, total)}%`} />
      <div className="space-y-1">
        {items.map((s, i) => (
          <button
            key={`${i}-${s.label}`}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === active}
            className="flex w-full items-center gap-3 rounded-lg py-1 text-left"
          >
            <span className={`w-24 shrink-0 truncate text-xs ${i === active ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{s.label}</span>
            <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-primary-100/70 dark:bg-white/10">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${i === active ? 'bg-primary-500' : 'bg-accent-500'}`}
                style={{ width: `${(s.value / top) * 100}%` }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-xs font-medium text-ink">{s.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MoodBar({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  const [sel, setSel] = useState(0);
  const active = sel < items.length ? sel : 0;
  const cur = items[active];
  return (
    <div>
      <Readout title={cur.label} value={`${cur.value}\u00d7 \u00b7 ${pct(cur.value, total)}%`} />
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        {items.map((m, i) => (
          <button
            key={`${i}-${m.label}`}
            type="button"
            onClick={() => setSel(i)}
            aria-label={`${m.label} ${m.value}`}
            className={`h-full transition-opacity ${MOOD_COLORS[i % MOOD_COLORS.length]} ${i === active ? 'opacity-100' : 'opacity-60'}`}
            style={{ width: `${(m.value / total) * 100}%`, minWidth: 6 }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((m, i) => (
          <button
            key={`${i}-${m.label}`}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === active}
            className={`inline-flex items-center gap-1.5 text-xs ${i === active ? 'font-semibold text-ink' : 'text-ink-muted'}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${MOOD_COLORS[i % MOOD_COLORS.length]}`} />
            {m.label} <span className="text-ink-muted">{m.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}