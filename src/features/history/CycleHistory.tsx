import { getLangCode } from '@/lib/lang-store';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { getCycleLengths, getPeriodDurations, parseDate } from '@/lib/cycle';
import { LoadingState, EmptyState } from '@/components/ui';
import { Calendar as CalIcon, TrendingUp, BarChart3, Activity } from 'lucide-react';

export default function CycleHistory() {
  const { user, profile } = useAuth();
  const { periods, symptoms, loading } = useCycleData(user?.id);

  if (loading) return <LoadingState />;

  const cycleLengths = getCycleLengths(periods);
  const periodDurations = getPeriodDurations(periods);
  const painEntries = symptoms.filter(s => s.pain > 0);

  if (periods.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Cycle History</h1>
        <EmptyState icon={<CalIcon size={40} />} title="No cycle history yet" message="Log your periods to see your cycle history and trends here." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Cycle History</h1>

      {/* Cycle length chart */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} className="text-primary" />
          <h2 className="section-title">Cycle Length Over Time</h2>
        </div>
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
                  <div className="w-full bg-primary rounded-t-lg transition-all" style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period duration chart */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-accent" />
          <h2 className="section-title">Period Duration</h2>
        </div>
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
        <div className="flex items-center gap-2 mb-3">
          <Activity size={18} className="text-error" />
          <h2 className="section-title">Pain Trend</h2>
        </div>
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
        <div className="flex items-center gap-2 mb-3">
          <CalIcon size={18} className="text-primary" />
          <h2 className="section-title">Period History</h2>
        </div>
        <div className="space-y-2">
          {[...periods].reverse().map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <CalIcon size={16} className="text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-ink dark:text-gray-100">
                  {new Date(p.start_date + 'T00:00:00').toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short', year: 'numeric' })}
                  {p.end_date && ` – ${new Date(p.end_date + 'T00:00:00').toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short' })}`}
                </p>
                {i < periods.length - 1 && cycleLengths.length > 0 && (
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                    Cycle: {cycleLengths[cycleLengths.length - 2 - i] || '—'} days
                  </p>
                )}
              </div>
              {p.duration && <span className="text-xs text-ink-muted dark:text-ink-muted-dark">{p.duration}d</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
