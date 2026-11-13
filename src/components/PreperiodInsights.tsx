import { useCallback, useEffect, useState } from 'react';
import { Phone, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { REMINDERS_CHANGED } from '@/lib/reminders';
import { SYMPTOM_ALERTS_CHANGED } from '@/lib/symptomAlertSettings';
import { checkSymptomAlerts, dismissSymptomAlert, markAlertSeen, type AlertState } from '@/lib/symptomAlertService';

function fmt(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Home card: personal symptom-pattern alert, or safety guidance. Shows nothing otherwise. */
export default function PreperiodInsights({ daysUntil }: { daysUntil: number }) {
  const { user } = useAuth();
  const [state, setState] = useState<AlertState | null>(null);
  const [open, setOpen] = useState(false);
  const [hideSafety, setHideSafety] = useState(false);

  const run = useCallback(async () => {
    if (!user) return;
    try {
      setState(await checkSymptomAlerts({ userId: user.id, daysUntilPeriod: daysUntil }));
    } catch {
      setState({ kind: 'off' });
    }
  }, [user, daysUntil]);

  useEffect(() => { void run(); }, [run]);

  useEffect(() => {
    const again = () => { void run(); };
    const onVisible = () => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener(SYMPTOM_ALERTS_CHANGED, again);
    window.addEventListener(REMINDERS_CHANGED, again);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(SYMPTOM_ALERTS_CHANGED, again);
      window.removeEventListener(REMINDERS_CHANGED, again);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run]);

  useEffect(() => {
    if (state?.kind === 'alert' && state.alertId) void markAlertSeen(state.alertId);
  }, [state]);

  if (!state) return null;

  if (state.kind === 'safety') {
    if (hideSafety) return null;
    return (
      <section className="card space-y-4 p-5" role="alert">
        {state.notices.map((n) => (
          <div key={n.flag} className="space-y-2">
            <h3 className="section-title">{n.title}</h3>
            <p className="text-sm leading-relaxed text-ink">{n.body}</p>
            {n.flag === 'self_harm_language' && (
              <div className="flex flex-wrap gap-2">
                <a href="tel:14416" className="btn-primary inline-flex items-center gap-2"><Phone size={16} />Tele-MANAS 14416</a>
                <a href="tel:112" className="btn-secondary inline-flex items-center gap-2"><Phone size={16} />Emergency 112</a>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setHideSafety(true)} className="text-xs text-ink-muted underline">Hide for now</button>
      </section>
    );
  }

  if (state.kind !== 'alert') return null;

  const { text, evidence, level } = state;
  return (
    <section className="card space-y-3 p-5">
      <h3 className="section-title flex items-center gap-2"><Sparkles size={16} />{text.title}</h3>
      <p className="rounded-xl bg-primary-100 px-3 py-2 text-sm leading-relaxed text-ink dark:bg-primary-900/50">{text.body}</p>
      {text.prep.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {text.prep.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-ink underline">
        {open ? 'Hide details' : 'Why am I seeing this?'}
      </button>
      {open && (
        <div className="space-y-3 text-sm text-ink">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">What your logs showed</p>
            <ul className="space-y-2">
              {evidence.map((e) => (
                <li key={e.symptom}>
                  <span className="font-medium">{e.symptom}</span>: logged before {e.cyclesSeen} of your {e.cyclesObserved} observed periods,
                  usually from about {e.typicalLeadDays} {e.typicalLeadDays === 1 ? 'day' : 'days'} before.
                  <span className="block text-xs text-ink-muted">Before the periods starting {e.seenInCycles.map(fmt).join(', ')}.</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">What your cycle estimate says</p>
            <p>{text.predicted}</p>
          </div>
          <p className="text-xs text-ink-muted">
            {level === 'strong'
              ? 'Strong match: this combination of symptoms appeared together before most of your past periods.'
              : 'Possible match: this pattern has appeared before some of your past periods.'}
          </p>
        </div>
      )}
      <p className="text-xs text-ink-muted">{text.caution}</p>
      <button
        type="button"
        onClick={() => { void dismissSymptomAlert(state.alertId); setState({ kind: 'dismissed' }); }}
        className="text-xs text-ink-muted underline"
      >
        Dismiss
      </button>
    </section>
  );
}
