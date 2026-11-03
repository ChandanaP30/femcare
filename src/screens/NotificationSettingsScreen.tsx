import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell, CalendarHeart, Clock, Droplet, Moon, Smartphone, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  DEFAULT_PREFS,
  getNotificationPermission,
  isInQuietHours,
  loadReminderPrefs,
  requestNotificationPermission,
  saveReminderPrefs,
  sendTestNotification,
  getReminderDiagnostics,
  type ReminderPrefs,
} from '@/lib/reminders';

type Perm = 'granted' | 'denied' | 'prompt';

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40 ${checked ? 'bg-primary-500' : 'bg-primary-100 dark:bg-primary-900/40'}`}
    >
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform dark:bg-neutral-800 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, control }: { icon: typeof Bell; title: string; desc?: string; control?: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{desc}</p>}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="card space-y-4 p-5">{children}</section>;
}

export function NotificationSettingsScreen() {
  const { user } = useAuth();
  const native = Capacitor.isNativePlatform();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<Perm>('prompt');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([loadReminderPrefs(user.id), getNotificationPermission()]).then(([p, state]) => {
      if (!active) return;
      setPrefs(p);
      setPerm(state);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  async function update(patch: Partial<ReminderPrefs>) {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await saveReminderPrefs(user.id, next);
    } catch (e) {
      setNote('Could not save: ' + ((e as { message?: string })?.message ?? 'unknown error'));
    }
  }

  async function setMaster(on: boolean) {
    setNote('');
    if (!on) {
      await update({ master: false });
      return;
    }
    // Permission is requested only here, on an explicit tap, and never again automatically.
    if (native && perm !== 'granted') {
      const state = await requestNotificationPermission();
      setPerm(state);
      if (state !== 'granted') {
        setNote('Notifications are blocked for FemCare+. Turn them on in Android settings to use reminders.');
        return;
      }
    }
    await update({ master: true });
  }

  async function runTest() {
    setTestSent(false);
    const ok = await sendTestNotification();
    setTestSent(ok);
    if (!ok) setNote('Test not sent. Check that notifications are allowed for FemCare+.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const [ch, cm] = prefs.checkinTime.split(':').map(Number);
  const checkinQuiet = isInQuietHours(ch, cm, prefs);
  const off = !prefs.master;

  const permText =
    !native ? 'Reminders work in the FemCare+ Android app.'
    : perm === 'granted' ? 'Allowed. Reminders can appear in your notification tray.'
    : perm === 'denied' ? 'Blocked. Open Android Settings, then Apps, then FemCare, then Notifications, and turn on Allow notifications.'
    : 'Not asked yet. You will be asked when you turn reminders on.';

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">FemCare+</p>
        <h1 className="mt-1.5 font-serif text-2xl text-ink sm:text-3xl">Reminders</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Gentle reminders in your notification tray. Lock-screen text never shows health details.
        </p>
      </header>

      <Card>
        <Row
          icon={Smartphone}
          title="Phone permission"
          desc={permText}
        />
        {native && perm === 'granted' && prefs.master && (
          <button
            onClick={runTest}
            className="w-full rounded-xl bg-primary-100 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-primary-200 dark:bg-primary-900/40"
          >
            Send a test in 5 seconds
          </button>
        )}
        {testSent && <p className="text-xs text-ink-muted">Test scheduled. Lock your phone to check.</p>}
        <button
          onClick={async () => alert(await getReminderDiagnostics())}
          className="w-full rounded-xl bg-primary-100 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-primary-200 dark:bg-primary-900/40"
        >
          Check scheduled reminders
        </button>
      </Card>

      <Card>
        <Row
          icon={Bell}
          title="Turn on reminders"
          desc="Master switch for all reminders below."
          control={<Toggle checked={prefs.master} onChange={setMaster} label="Turn on reminders" />}
        />
        {note && <p className="rounded-xl bg-accent-100 px-4 py-3 text-xs leading-relaxed text-ink dark:bg-accent-600/25">{note}</p>}
      </Card>

      <Card>
        <Row
          icon={CalendarHeart}
          title="Period reminders"
          desc="Based on your logged cycles. An estimate, so the date can change."
          control={<Toggle checked={prefs.periodReminders} onChange={(v) => update({ periodReminders: v })} label="Period reminders" disabled={off} />}
        />
        {prefs.periodReminders && (
          <div className="flex flex-wrap gap-2 pl-12">
            {([1, 2, 3] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={off}
                onClick={() => update({ periodDaysBefore: d })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${prefs.periodDaysBefore === d ? 'bg-primary-500 text-ink dark:text-ink-onlight' : 'bg-primary-50 text-ink-muted dark:bg-primary-900/40'}`}
              >
                {d} day{d > 1 ? 's' : ''} before
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Row
          icon={Clock}
          title="Daily check-in"
          desc="A gentle reminder to log symptoms, pain, mood, and flow."
          control={<Toggle checked={prefs.dailyCheckin} onChange={(v) => update({ dailyCheckin: v })} label="Daily check-in" disabled={off} />}
        />
        {prefs.dailyCheckin && (
          <div className="pl-12">
            <input
              type="time"
              value={prefs.checkinTime}
              disabled={off}
              onChange={(e) => e.target.value && update({ checkinTime: e.target.value })}
              className="input-field max-w-[160px]"
            />
            {checkinQuiet && (
              <p className="mt-2 text-xs text-ink-muted">This time is inside quiet hours, so no check-in will be sent. Pick another time.</p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Row
          icon={Droplet}
          title="Care tips"
          desc="Up to three gentle tips on the remaining days of a period you have logged."
          control={<Toggle checked={prefs.carePeriodTips} onChange={(v) => update({ carePeriodTips: v })} label="Care tips" disabled={off} />}
        />
      </Card>

      <Card>
        <Row
          icon={Sparkles}
          title="Fertility estimates (optional)"
          desc="Estimated fertile window from your logged cycles."
          control={<Toggle checked={prefs.fertilityEstimates} onChange={(v) => update({ fertilityEstimates: v })} label="Fertility estimates" disabled={off} />}
        />
        <p className="rounded-xl bg-secondary-100 px-4 py-3 text-xs leading-relaxed text-ink-muted dark:bg-neutral-800">
          These are estimates. They are not guaranteed and must not be used to prevent or plan pregnancy.
        </p>
      </Card>

      <Card>
        <Row
          icon={Moon}
          title="Quiet hours"
          desc="No reminders are sent during this window."
          control={<Toggle checked={prefs.quietEnabled} onChange={(v) => update({ quietEnabled: v })} label="Quiet hours" disabled={off} />}
        />
        {prefs.quietEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-12">
            <label className="text-xs text-ink-muted">
              From
              <input type="time" value={prefs.quietStart} disabled={off} onChange={(e) => e.target.value && update({ quietStart: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="text-xs text-ink-muted">
              Until
              <input type="time" value={prefs.quietEnd} disabled={off} onChange={(e) => e.target.value && update({ quietEnd: e.target.value })} className="input-field mt-1" />
            </label>
          </div>
        )}
      </Card>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-muted">
        <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        Reminders are scheduled on this phone. Changes apply automatically when your cycle data changes.
      </p>
    </div>
  );
}
