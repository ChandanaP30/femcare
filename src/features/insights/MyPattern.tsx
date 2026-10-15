import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { getCycleLengths, getAverageCycleLength, getAveragePeriodDuration } from '@/lib/cycle';
import { predictNextCycle, getPastPredictions } from '@/lib/prediction';
import { LoadingState, EmptyState, Badge } from '@/components/ui';
import { TrendingUp, Activity, Heart, AlertCircle, Brain, Target } from 'lucide-react';
import type { PageId } from '@/components/AppShell';

export default function MyPattern({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user, profile } = useAuth();
  const { periods, symptoms, loading } = useCycleData(user?.id);
  const [predInfo, setPredInfo] = useState<{ algorithm: string; accuracy: any } | null>(null);

  useEffect(() => {
    if (user) {
      getPastPredictions(user.id).then((past) => {
        const pred = predictNextCycle(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5, past);
        setPredInfo({ algorithm: pred.algorithm, accuracy: pred.accuracyInfo });
      });
    } else {
      const pred = predictNextCycle(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5);
      setPredInfo({ algorithm: pred.algorithm, accuracy: pred.accuracyInfo });
    }
  }, [periods, symptoms, profile, user]);

  const stats = useMemo(() => {
    const cycleLengths = getCycleLengths(periods);
    const avgCycle = getAverageCycleLength(periods, profile?.cycle_length || 28);
    const avgPeriod = getAveragePeriodDuration(periods, profile?.period_duration || 5);
    const shortCycle = cycleLengths.length ? Math.min(...cycleLengths) : null;
    const longCycle = cycleLengths.length ? Math.max(...cycleLengths) : null;

    const symptomFreq = new Map<string, number>();
    symptoms.forEach(s => (s.symptoms || []).forEach(sym => symptomFreq.set(sym, (symptomFreq.get(sym) || 0) + 1)));
    const commonSymptoms = [...symptomFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const painEntries = symptoms.filter(s => s.pain > 0);
    const avgPain = painEntries.length ? (painEntries.reduce((a, s) => a + s.pain, 0) / painEntries.length).toFixed(1) : null;

    return { cycleLengths, avgCycle, avgPeriod, shortCycle, longCycle, commonSymptoms, avgPain };
  }, [periods, symptoms, profile]);

  if (loading) return <LoadingState />;

  if (periods.length === 0 && symptoms.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">My Pattern</h1>
        <EmptyState icon={<TrendingUp size={40} />} title="Not enough data yet" message="Keep logging your cycles and symptoms to discover your personal patterns." />
      </div>
    );
  }

  const interpretation = (() => {
    if (stats.cycleLengths.length >= 3) {
      const range = (stats.longCycle || 0) - (stats.shortCycle || 0);
      if (range <= 7) return { text: 'Your recent cycles have been fairly consistent.', type: 'success' as const };
      return { text: 'Your cycle lengths show some variation. This is common, but if the pattern changes significantly, consider speaking with a healthcare professional.', type: 'warning' as const };
    }
    if (stats.cycleLengths.length >= 2) {
      return { text: 'You have some cycle data. Keep logging to build a clearer picture of your pattern.', type: 'info' as const };
    }
    return { text: 'Not enough personal data yet. Keep logging your cycles to improve your personal estimates.', type: 'info' as const };
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">My Pattern</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average cycle</p>
          <p className="text-2xl font-bold text-primary">{stats.avgCycle} days</p>
          <Badge color="primary">Calculated</Badge>
        </div>
        <div className="card">
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average period</p>
          <p className="text-2xl font-bold text-primary">{stats.avgPeriod} days</p>
          <Badge color="primary">Calculated</Badge>
        </div>
        {stats.shortCycle && (
          <div className="card">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Shortest cycle</p>
            <p className="text-2xl font-bold text-ink dark:text-gray-100">{stats.shortCycle} days</p>
          </div>
        )}
        {stats.longCycle && (
          <div className="card">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Longest cycle</p>
            <p className="text-2xl font-bold text-ink dark:text-gray-100">{stats.longCycle} days</p>
          </div>
        )}
        {stats.avgPain && (
          <div className="card">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Average pain</p>
            <p className="text-2xl font-bold text-ink dark:text-gray-100">{stats.avgPain}/10</p>
          </div>
        )}
        {stats.shortCycle && stats.longCycle && (
          <div className="card">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Recent range</p>
            <p className="text-2xl font-bold text-ink dark:text-gray-100">{stats.shortCycle}–{stats.longCycle}</p>
          </div>
        )}
      </div>

      {/* Common symptoms */}
      {stats.commonSymptoms.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={18} className="text-accent" />
            <h2 className="section-title">Common Symptoms</h2>
          </div>
          <div className="space-y-2">
            {stats.commonSymptoms.map(([sym, count]) => (
              <div key={sym} className="flex items-center justify-between">
                <span className="text-sm text-ink dark:text-gray-200">{sym}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${(count / stats.commonSymptoms[0][1]) * 100}%` }} />
                  </div>
                  <span className="text-xs text-ink-muted dark:text-ink-muted-dark w-6">{count}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction engine info */}
      {predInfo && periods.length >= 2 && (
        <div className="card bg-primary-50 dark:bg-primary-900/20">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-primary" />
            <h2 className="section-title">Prediction Engine</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Algorithm</span>
              <Badge color="primary">{predInfo.algorithm.replace(/_/g, ' ')}</Badge>
            </div>
            {predInfo.accuracy?.avgErrorDays != null && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Avg error</span>
                  <span className="text-sm font-medium text-ink dark:text-gray-100">{predInfo.accuracy.avgErrorDays} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Accuracy</span>
                  <span className="text-sm font-medium text-success">{predInfo.accuracy.accuracyPercentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Past predictions</span>
                  <span className="text-sm font-medium text-ink dark:text-gray-100">{predInfo.accuracy.pastPredictions}</span>
                </div>
              </>
            )}
            {(!predInfo.accuracy?.avgErrorDays || predInfo.accuracy.avgErrorDays == null) && (
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark italic">
                Keep logging your periods — the engine learns from past prediction accuracy to improve future estimates.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div className={`card ${interpretation.type === 'success' ? 'bg-success-50 dark:bg-success-900/20' : interpretation.type === 'warning' ? 'bg-warning-50 dark:bg-warning-900/20' : 'bg-primary-50 dark:bg-primary-900/20'}`}>
        <div className="flex items-start gap-2">
          <Activity size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <Badge color="accent">AI-generated insight</Badge>
            <p className="text-sm text-ink dark:text-gray-200 mt-2">{interpretation.text}</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink dark:text-gray-200">
            These statistics are calculated from your logged data and are not a medical diagnosis. If symptoms are severe, persistent, or concerning, consider contacting a qualified healthcare professional.
          </p>
        </div>
      </div>
    </div>
  );
}
