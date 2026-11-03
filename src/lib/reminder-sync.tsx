import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { loadReminderPrefs, syncReminders, REMINDERS_CHANGED } from '@/lib/reminders';

/** Keeps scheduled reminders in step with preferences, cycle data, sign-in, and app resume. Renders nothing. */
export function ReminderSync() {
  const { user, profile } = useAuth();
  const { periods, loading } = useCycleData(user?.id);

  // Stable key: re-renders with unchanged data do not reschedule.
  const cycleKey = JSON.stringify([
    periods.map((p) => [p.start_date, p.end_date]),
    profile?.cycle_length,
    profile?.period_duration,
    profile?.last_period_date,
  ]);

  useEffect(() => {
    if (!user || !profile || !profile.onboarding_completed || loading) return;
    let cancelled = false;
    const run = () =>
      loadReminderPrefs(user.id)
        .then((prefs) => (cancelled ? null : syncReminders({ prefs, periods, profile })))
        .catch(() => {});

    run();
    const onChange = () => { run(); };
    window.addEventListener(REMINDERS_CHANGED, onChange);
    const listener = App.addListener('appStateChange', (state) => {
      if (state.isActive) onChange();
    });

    return () => {
      cancelled = true;
      window.removeEventListener(REMINDERS_CHANGED, onChange);
      listener.then((h) => h.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cycleKey, loading, profile?.onboarding_completed]);

  return null;
}