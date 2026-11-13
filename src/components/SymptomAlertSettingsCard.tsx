import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  DEFAULT_SYMPTOM_ALERT_SETTINGS,
  loadSymptomAlertSettings,
  saveSymptomAlertSettings,
  type SymptomAlertSettings,
} from '@/lib/symptomAlertSettings';
import { listRecentAlerts, type StoredAlert } from '@/lib/symptomAlertService';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-primary-500' : 'bg-primary-100 dark:bg-primary-900/40'}`}
    >
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform dark:bg-neutral-800 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SymptomAlertSettingsCard() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SymptomAlertSettings>(DEFAULT_SYMPTOM_ALERT_SETTINGS);
  const [alerts, setAlerts] = useState<StoredAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [s, a] = await Promise.all([loadSymptomAlertSettings(user.id), listRecentAlerts(user.id)]);
    setSettings(s);
    setAlerts(a);
    setLoaded(true);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function update(patch: Partial<SymptomAlertSettings>) {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setNote('');
    try {
      await saveSymptomAlertSettings(user.id, next);
    } catch (e) {
      setNote('Could not save: ' + ((e as { message?: string })?.message ?? 'unknown error'));
    }
  }

  if (!loaded) return null;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
          <Sparkles size={17} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Symptom pattern alerts</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Learns from your own logs. It needs at least 3 periods with symptoms logged before them. You are only alerted when
            your symptoms match a past pattern and your period is estimated to be near. This is not a diagnosis.
          </p>
        </div>
        <Toggle checked={settings.enabled} onChange={(v) => update({ enabled: v })} label="Symptom pattern alerts" />
      </div>

      {settings.enabled && (
        <>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">How often</p>
            <div className="flex flex-wrap gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update({ maxPerCycle: n })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${settings.maxPerCycle === n ? 'bg-primary-500 text-ink dark:text-ink-onlight' : 'bg-primary-50 text-ink-muted dark:bg-primary-900/40'}`}
                >
                  {n === 1 ? 'Once per cycle' : 'Up to twice per cycle'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Preparation reminders</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">Adds tips such as keeping pads and comfortable clothing ready.</p>
            </div>
            <Toggle checked={settings.prepReminders} onChange={(v) => update({ prepReminders: v })} label="Preparation reminders" />
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            Phone notifications also need “Turn on reminders” above. Without it, alerts appear only inside the app.
          </p>
        </>
      )}

      {note && <p className="rounded-xl bg-accent-100 px-4 py-3 text-xs leading-relaxed text-ink dark:bg-accent-600/25">{note}</p>}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">Recent alerts</p>
        {alerts.length === 0 ? (
          <p className="text-xs text-ink-muted">No alerts yet.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="text-xs leading-relaxed text-ink">
                <span className="font-medium">{fmt(a.created_at)}</span>
                {' · '}
                {a.level === 'strong' ? 'Strong match' : 'Possible match'}
                {': '}
                {a.matched.join(', ')}
                {(a.evidence?.matched ?? []).map((e) => (
                  <span key={e.symptom} className="block text-ink-muted">
                    {e.symptom}: before {e.cyclesSeen} of {e.cyclesObserved} periods ({e.seenInCycles.map(fmt).join(', ')})
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
