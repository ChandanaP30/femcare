import { useEffect, useState, useMemo } from 'react';
import { Sparkles, TrendingUp, BarChart3, Calendar as CalIcon, Brain, Target } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { getCycleLengths, getPeriodDurations, getAverageCycleLength, getAveragePeriodDuration, parseDate, computeCycleInfoML, type CycleInfo } from '@/lib/cycle';
import { predictNextCycle, getPastPredictions } from '@/lib/prediction';
import { Badge, EmptyState, LoadingState } from '@/components/ui';
import type { PageId } from '@/components/AppShell';

export default function Insights({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user, profile } = useAuth();
  const { periods, symptoms, loading } = useCycleData(user?.id);
  const [prediction, setPrediction] = useState<{ algorithm: string; accuracy: any } | null>(null);

  useEffect(() => {
    if (user) {
      getPastPredictions(user.id).then((past) => {
        const pred = predictNextCycle(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5, past);
        setPrediction({ algorithm: pred.algorithm, accuracy: pred.accuracyInfo });
      });
    } else {
      const pred = predictNextCycle(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5);
      setPrediction({ algorithm: pred.algorithm, accuracy: pred.accuracyInfo });
    }
  }, [periods, symptoms, profile, user]);

  if (loading) return <LoadingState />;

  const cycleLengths = getCycleLengths(periods);
  const periodDurations = getPeriodDurations(periods);
  const avgCycle = getAverageCycleLength(periods, profile?.cycle_length || 28);
  const avgPeriod = getAveragePeriodDuration(periods, profile?.period_duration || 5);

  const shortCycle = cycleLengths.length ? Math.min(...cycleLengths) : null;
  const longCycle = cycleLengths.length ? Math.max(...cycleLengths) : null;

  // Symptom frequency
  const symptomFreq = useMemo(() => {
    const map = new Map<string, number>();
    symptoms.forEach((s) => {
      (s.symptoms || []).forEach((sym) => {
        map.set(sym, (map.get(sym) || 0) + 1);
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [symptoms]);

  // Pain average
  const painEntries = symptoms.filter((s) => s.pain > 0);
  const avgPain = painEntries.length ? (painEntries.reduce((a, s) => a + s.pain, 0) / painEntries.length).toFixed(1) : null;

  // Mood frequency
  const moodFreq = useMemo(() => {
    const map = new Map<string, number>();
    symptoms.forEach((s) => {
      if (s.mood) map.set(s.mood, (map.get(s.mood) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [symptoms]);

  // AI Insights generation
  const insights = useMemo(() => {
    const result: { text: string; type: 'calculated' | 'ai' }[] = [];
    if (periods.length >= 2) {
      result.push({
        text: `Your recent cycle lengths ranged from ${shortCycle}–${longCycle} days.`,
        type: 'calculated',
      });
    }
    if (symptomFreq.length > 0) {
      const top = symptomFreq.slice(0, 3).map((s) => s[0].toLowerCase());
      result.push({
        text: `You most frequently log: ${top.join(', ')}.`,
        type: 'calculated',
      });
    }
    // Check cramps during period
    const periodDays = new Set<string>();
    periods.forEach((p) => {
      if (!p.end_date) {
        periodDays.add(p.start_date);
      } else {
        const start = parseDate(p.start_date);
        const end = parseDate(p.end_date);
        let d = start;
        while (d <= end) {
          periodDays.add(d.toISOString().split('T')[0]);
          d = new Date(d);
          d.setDate(d.getDate() + 1);
        }
      }
    });
    const crampsOnPeriod = symptoms.filter((s) => periodDays.has(s.entry_date) && s.symptoms?.includes('Cramps'));
    if (crampsOnPeriod.length >= 2) {
      result.push({
        text: `You logged cramps on ${crampsOnPeriod.length} of your logged period days.`,
        type: 'ai',
      });
    }
    if (avgPain && Number(avgPain) > 6) {
      result.push({
        text: `Your average pain level is ${avgPain}/10. If this is severe or concerning, consider speaking with a qualified healthcare professional.`,
        type: 'ai',
      });
    }
    if (cycleLengths.length >= 2) {
      const recent = cycleLengths.slice(-2);
      const older = cycleLengths.slice(0, -2);
      if (older.length > 0) {
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (Math.abs(recent[recent.length - 1] - olderAvg) > 7) {
          result.push({
            text: `Your last cycle was ${Math.abs(recent[recent.length - 1] - olderAvg) > 0 ? 'longer' : 'shorter'} than your recent average.`,
            type: 'ai',
          });
        }
      }
    }
    return result;
  }, [periods, symptoms, symptomFreq, avgPain, cycleLengths]);

  const hasData = periods.length > 0 || symptoms.length > 0;

  const tabs = [
    { id: 'ai' as const, label: 'AI Insights', icon: Sparkles },
    { id: 'pattern' as const, label: 'My Pattern', icon: TrendingUp },
    { id: 'history' as const, label: 'Cycle History', icon: BarChart3 },
  ];
  const [tab, setTab] = useState<'ai' | 'pattern' | 'history'>('ai');

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Insights</h1>

      {/* Tab buttons */}
      <div className="flex gap-2">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === tb.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'
              }`}
            >
              <Icon size={16} /> {tb.label}
            </button>
          );
        })}
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Sparkles size={40} />}
          title="Not enough data for insights"
          message="Keep logging your periods and symptoms to unlock personalised insights."
        />
      ) : tab === 'ai' ? (
        <div className="space-y-3">
          {insights.length === 0 ? (
            <EmptyState icon={<Sparkles size={40} />} title="No insights yet" message="Log more periods and symptoms to generate insights." />
          ) : (
            insights.map((ins, i) => (
              <div key={i} className="card">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ins.type === 'ai' ? 'bg-accent-50 dark:bg-accent-900/30' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
                    <Sparkles size={16} className={ins.type === 'ai' ? 'text-accent' : 'text-primary'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink dark:text-gray-100">{ins.text}</p>
                    <Badge color={ins.type === 'ai' ? 'accent' : 'primary'}>{ins.type === 'ai' ? 'AI-generated insight' : 'Calculated from your data'}</Badge>
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
            <p className="text-sm text-ink dark:text-gray-200">
              These insights are based on your logged data and are not a medical diagnosis. If symptoms are severe, persistent, or concerning, consider contacting a qualified healthcare professional.
            </p>
          </div>
        </div>
      ) : tab === 'pattern' ? (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-title mb-4">My Cycle Pattern</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average cycle</p>
                <p className="text-lg font-bold text-primary">{avgCycle} days</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average period</p>
                <p className="text-lg font-bold text-primary">{avgPeriod} days</p>
              </div>
              {shortCycle && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Shortest cycle</p>
                  <p className="text-lg font-bold text-ink dark:text-gray-100">{shortCycle} days</p>
                </div>
              )}
              {longCycle && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Longest cycle</p>
                  <p className="text-lg font-bold text-ink dark:text-gray-100">{longCycle} days</p>
                </div>
              )}
              {avgPain && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average pain</p>
                  <p className="text-lg font-bold text-ink dark:text-gray-100">{avgPain}/10</p>
                </div>
              )}
              {cycleLengths.length >= 2 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Recent range</p>
                  <p className="text-lg font-bold text-ink dark:text-gray-100">{shortCycle}–{longCycle} days</p>
                </div>
              )}
            </div>
          </div>

          {symptomFreq.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-3">Common Symptoms</h2>
              <div className="space-y-2">
                {symptomFreq.slice(0, 5).map(([sym, count]) => (
                  <div key={sym} className="flex items-center justify-between">
                    <span className="text-sm text-ink dark:text-gray-200">{sym}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(count / symptomFreq[0][1]) * 100}%` }} />
                      </div>
                      <span className="text-xs text-ink-muted dark:text-ink-muted-dark w-6">{count}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {moodFreq.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-3">Mood Pattern</h2>
              <div className="flex flex-wrap gap-2">
                {moodFreq.map(([mood, count]) => (
                  <Badge key={mood} color="accent">{mood}: {count}x</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="card bg-primary-50 dark:bg-primary-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={18} className="text-primary" />
              <h2 className="section-title">Prediction Engine</h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Algorithm</span>
                <Badge color="primary">{prediction?.algorithm ? prediction.algorithm.replace(/_/g, ' ') : '—'}</Badge>
              </div>
              {prediction?.accuracy?.avgErrorDays != null && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Avg error</span>
                    <span className="text-sm font-medium text-ink dark:text-gray-100">{prediction.accuracy.avgErrorDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Accuracy</span>
                    <span className="text-sm font-medium text-success">{prediction.accuracy.accuracyPercentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Past predictions</span>
                    <span className="text-sm font-medium text-ink dark:text-gray-100">{prediction.accuracy.pastPredictions}</span>
                  </div>
                </>
              )}
              {(!prediction?.accuracy?.avgErrorDays || prediction.accuracy.avgErrorDays == null) && periods.length >= 2 && (
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark italic">
                  Keep logging your periods — the engine will learn from prediction accuracy over time to improve future estimates.
                </p>
              )}
            </div>
          </div>

          <div className="card bg-primary-50 dark:bg-primary-900/20">
            <Badge color="primary">AI-generated insight</Badge>
            <p className="text-sm text-ink dark:text-gray-200 mt-2">
              {cycleLengths.length >= 3 && longCycle !== null && shortCycle !== null && Math.abs(longCycle - shortCycle) <= 7
                ? 'Your recent cycles have been fairly consistent.'
                : cycleLengths.length >= 2
                ? 'Your cycle lengths show some variation. This is common, but if the pattern changes significantly, consider speaking with a healthcare professional.'
                : 'More data is needed to show this trend.'}
            </p>
          </div>
        </div>
      ) : (
        <CycleHistoryView periods={periods} symptoms={symptoms} cycleLengths={cycleLengths} periodDurations={periodDurations} />
      )}
    </div>
  );
}

function CycleHistoryView({ periods, symptoms, cycleLengths, periodDurations }: {
  periods: any[]; symptoms: any[]; cycleLengths: number[]; periodDurations: number[];
}) {
  const painEntries = symptoms.filter((s) => s.pain > 0);

  return (
    <div className="space-y-4">
      {/* Cycle lengths chart */}
      <div className="card">
        <h2 className="section-title mb-3">Cycle Length Over Time</h2>
        {cycleLengths.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">More data is needed to show this trend.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {cycleLengths.map((len, i) => {
              const max = Math.max(...cycleLengths);
              const min = Math.min(...cycleLengths);
              const range = max - min || 1;
              const height = 30 + ((len - min) / range) * 70;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-ink-muted dark:text-ink-muted-dark">{len}</span>
                  <div className="w-full bg-primary rounded-t-lg" style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period duration chart */}
      <div className="card">
        <h2 className="section-title mb-3">Period Duration</h2>
        {periodDurations.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">More data is needed to show this trend.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {periodDurations.map((dur, i) => {
              const max = Math.max(...periodDurations);
              const height = (dur / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-ink-muted dark:text-ink-muted-dark">{dur}d</span>
                  <div className="w-full bg-accent rounded-t-lg" style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pain trend */}
      <div className="card">
        <h2 className="section-title mb-3">Pain Trend</h2>
        {painEntries.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">More data is needed to show this trend.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {painEntries.slice(-15).map((entry, i) => {
              const height = (entry.pain / 10) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-error rounded-t-lg" style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period history list */}
      <div className="card">
        <h2 className="section-title mb-3">Period History</h2>
        {periods.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">No periods logged yet.</p>
        ) : (
          <div className="space-y-2">
            {[...periods].reverse().map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <CalIcon size={16} className="text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-ink dark:text-gray-100">
                    {new Date(p.start_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                    {p.end_date && ' – ' + new Date(p.end_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                  </p>
                  {i < periods.length - 1 && cycleLengths.length > 0 && (
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                      Cycle: {cycleLengths[cycleLengths.length - 2 - i] || '—'} days
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
