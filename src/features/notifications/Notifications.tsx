import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff } from 'lucide-react';
import { Toggle } from '@/components/ui';

interface NotificationPrefs {
  period_reminder: boolean;
  period_expected: boolean;
  daily_symptom: boolean;
  cycle_logging: boolean;
  medication: boolean;
  hydration: boolean;
  appointment: boolean;
}

const defaultPrefs: NotificationPrefs = {
  period_reminder: false,
  period_expected: false,
  daily_symptom: false,
  cycle_logging: false,
  medication: false,
  hydration: false,
  appointment: false,
};

const labels: Record<keyof NotificationPrefs, string> = {
  period_reminder: 'Period reminder',
  period_expected: 'Period expected reminder',
  daily_symptom: 'Daily symptom reminder',
  cycle_logging: 'Cycle logging reminder',
  medication: 'Medication reminder',
  hydration: 'Hydration / self-care reminder',
  appointment: 'Appointment reminder',
};

export default function Notifications() {
  const { user, settings, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (settings?.notifications) {
      setPrefs({ ...defaultPrefs, ...(settings.notifications as any) });
    }
  }, [settings]);

  const handleToggle = async (key: keyof NotificationPrefs) => {
    if (!consent) return;
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    if (user) {
      if (settings) {
        await supabase.from('user_settings').update({ notifications: newPrefs }).eq('user_id', user.id);
      } else {
        await supabase.from('user_settings').insert({ user_id: user.id, notifications: newPrefs });
      }
      await refreshProfile();
    }
  };

  const handleConsent = async (c: boolean) => {
    setConsent(c);
    if (!c) {
      setPrefs(defaultPrefs);
      if (user && settings) {
        await supabase.from('user_settings').update({ notifications: {} }).eq('user_id', user.id);
        await refreshProfile();
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Notifications</h1>

      {/* Consent */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {consent ? <Bell size={20} className="text-primary" /> : <BellOff size={20} className="text-ink-muted" />}
            <div>
              <p className="text-sm font-medium text-ink dark:text-gray-100">Notification consent</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Allow FemCare+ to send you reminders</p>
            </div>
          </div>
          <Toggle checked={consent} onChange={handleConsent} label="Notification consent" />
        </div>
      </div>

      {/* Reminder time */}
      {consent && (
        <div className="card">
          <label className="label">Default reminder time</label>
          <input type="time" className="input" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
        </div>
      )}

      {/* Notification types */}
      {consent && (
        <div className="card p-0 overflow-hidden">
          {(Object.keys(labels) as (keyof NotificationPrefs)[]).map((key, i) => (
            <div key={key} className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-sm text-ink dark:text-gray-200">{labels[key]}</span>
              <Toggle checked={prefs[key]} onChange={() => handleToggle(key)} label={labels[key]} />
            </div>
          ))}
        </div>
      )}

      <div className="card bg-primary-50 dark:bg-primary-900/20">
        <p className="text-sm text-ink dark:text-gray-200">
          Every notification requires your consent. We use local notifications where appropriate and will never spam you. You can change these settings anytime.
        </p>
      </div>
    </div>
  );
}
