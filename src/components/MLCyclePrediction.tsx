import { useState } from 'react';
import { CYCLE_MODEL_PARAMS } from '../lib/cycleModelParams';
import { cycleLengthsFromStarts, predictCycle, estimateDates } from '../lib/cycleModel';

interface Props {
  /** Period start dates as ISO strings, in any order. */
  periodStarts: string[];
  /** Main app estimate (cycleInfo.nextPeriodDate, YYYY-MM-DD). */
  appNextPeriodDate?: string;
}

const DAY_MS = 86400000;

function toLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const fmt = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MLCyclePrediction({ periodStarts, appNextPeriodDate }: Props) {
  const [open, setOpen] = useState(false);

  if (periodStarts.length === 0) return null;

  const sorted = [...periodStarts].sort();
  const lastStart = toLocalDate(sorted[sorted.length - 1]);
  if (isNaN(lastStart.getTime())) return null;

  const history = cycleLengthsFromStarts(sorted);
  const pred = predictCycle(CYCLE_MODEL_PARAMS, history);
  const { point } = estimateDates(lastStart, pred);

  const appDate = appNextPeriodDate ? toLocalDate(appNextPeriodDate) : null;
  const appValid = appDate !== null && !isNaN(appDate.getTime());
  const gap = appValid
    ? Math.round((startOfDay(point).getTime() - startOfDay(appDate!).getTime()) / DAY_MS)
    : 0;

  const cycleCount = history.length;
  const average = cycleCount ? history.reduce((a, b) => a + b, 0) / cycleCount : null;
  const recent = history.slice(-6);

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Alternative estimate
          </p>
          <p className="mt-1 font-serif text-lg text-ink">{fmt(point)}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {appValid && gap !== 0
              ? `${Math.abs(gap)} day${Math.abs(gap) > 1 ? 's' : ''} ${gap > 0 ? 'later' : 'earlier'} than the main estimate. `
              : appValid
                ? 'Same date as the main estimate. '
                : ''}
            Not used in the calendar or reminders.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
          Experimental
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-4 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        {open ? 'Hide details' : 'How was this estimated?'}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-primary-100 pt-4 text-sm text-ink">
          <p className="leading-relaxed text-ink-muted">
            This model starts from a typical cycle length and adjusts it toward your own logged cycles.
            The more cycles you log, the more your pattern counts.
          </p>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary-100 p-3">
              <dt className="text-xs text-ink-muted">Cycles used</dt>
              <dd className="mt-0.5 font-semibold">{cycleCount}</dd>
            </div>
            <div className="rounded-xl bg-secondary-100 p-3">
              <dt className="text-xs text-ink-muted">Your average cycle</dt>
              <dd className="mt-0.5 font-semibold">
                {average !== null ? `${average.toFixed(1)} days` : 'Not yet'}
              </dd>
            </div>
          </dl>
          {recent.length > 0 && (
            <div>
              <p className="text-xs text-ink-muted">Recent cycle lengths</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {recent.map((d, i) => (
                  <span key={`${d}-${i}`} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-primary-100">
                    {d} days
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-ink-muted">
            Trained on simulated data only and not clinically validated. Not a contraceptive, fertility,
            or medical tool.
          </p>
        </div>
      )}
    </section>
  );
}