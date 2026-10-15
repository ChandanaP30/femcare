import { useSettings } from '@/lib/settings-context';
import { useLanguage } from '@/lib/language-context';
import { LANGUAGE_OPTIONS } from '@/lib/i18n';
import type { Theme, Language } from '@/lib/types';
import { Sun, Moon, Monitor, Lock, Trash2, ChevronRight, Globe, Check } from 'lucide-react';

export function SettingsScreen({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { settings, updateSettings, theme, setTheme } = useSettings();
  const { lang, setLang, t } = useLanguage();

  const themes: { key: Theme; label: string; icon: typeof Sun }[] = [
    { key: 'light', label: t('light'), icon: Sun },
    { key: 'dark', label: t('dark'), icon: Moon },
    { key: 'system', label: t('system'), icon: Monitor },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('settings')}</h1>
      </div>

      {/* Language */}
      <div>
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Globe size={16} className="text-primary-500" />
          {t('language')}
        </h3>
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = lang === opt.code;
              return (
                <button
                  key={opt.code}
                  onClick={() => setLang(opt.code as Language)}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-xl transition-all ${
                    active
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <span className="text-lg font-semibold">{opt.nativeLabel}</span>
                  <span className="text-xs font-medium opacity-80">{opt.label}</span>
                  {active && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="section-title mb-3">{t('notifications')}</h3>
        <div className="card divide-y divide-neutral-200 dark:divide-neutral-700">
          <ToggleRow
            label={t('upcomingPeriodReminders')}
            description={t('getNotifiedBefore')}
            checked={settings?.period_reminders ?? true}
            onChange={(v) => updateSettings({ period_reminders: v })}
          />
          <ToggleRow
            label={t('dailyLoggingReminders')}
            description={t('remindersToLog')}
            checked={settings?.daily_logging_reminders ?? true}
            onChange={(v) => updateSettings({ daily_logging_reminders: v })}
          />
          <ToggleRow
            label={t('medicationReminders')}
            description={t('remindersForMedication')}
            checked={settings?.medication_reminders ?? false}
            onChange={(v) => updateSettings({ medication_reminders: v })}
          />
          <ToggleRow
            label={t('hydrationReminders')}
            description={t('gentleRemindersHydration')}
            checked={settings?.hydration_reminders ?? false}
            onChange={(v) => updateSettings({ hydration_reminders: v })}
          />
          <ToggleRow
            label={t('cycleLoggingReminders')}
            description={t('remindersKeepCycle')}
            checked={settings?.cycle_logging_reminders ?? true}
            onChange={(v) => updateSettings({ cycle_logging_reminders: v })}
          />
        </div>
      </div>

      {/* Appearance */}
      <div>
        <h3 className="section-title mb-3">{t('appearance')}</h3>
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-2">
            {themes.map((th) => {
              const Icon = th.icon;
              const active = theme === th.key;
              return (
                <button
                  key={th.key}
                  onClick={() => setTheme(th.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                    active
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-sm font-medium">{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Account */}
      <div>
        <h3 className="section-title mb-3">{t('account')}</h3>
        <div className="space-y-1">
          <button
            onClick={() => onNavigate('privacy')}
            className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all"
          >
            <Lock size={20} className="text-neutral-500 dark:text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex-1">{t('changePassword')}</span>
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all"
          >
            <Trash2 size={20} className="text-error-500" />
            <span className="text-sm font-medium text-error-600 dark:text-error-400 flex-1">{t('deleteAccountOrData')}</span>
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
        {t('notificationsConsent')}
      </p>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
