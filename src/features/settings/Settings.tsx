import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { LANGUAGES, type CycleRegularity } from '@/lib/types';
import { Toggle, Badge } from '@/components/ui';

export default function Settings() {
  const { user, profile, settings, refreshProfile } = useAuth();
  const { theme, setTheme, language, setLanguage, t } = useTheme();
  const [cycleLength, setCycleLength] = useState(profile?.cycle_length || 28);
  const [periodDuration, setPeriodDuration] = useState(profile?.period_duration || 5);
  const [regularity, setRegularity] = useState<CycleRegularity>((profile?.cycle_regularity as CycleRegularity) || 'regular');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (profile) {
      setCycleLength(profile.cycle_length);
      setPeriodDuration(profile.period_duration);
      setRegularity((profile.cycle_regularity as CycleRegularity) || 'regular');
    }
  }, [profile]);

  const handleSaveCycle = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      cycle_length: cycleLength,
      period_duration: periodDuration,
      cycle_regularity: regularity,
    }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    if (user && settings) {
      supabase.from('user_settings').update({ theme: newTheme }).eq('user_id', user.id);
    }
  };

  const handleLanguageChange = (lang: 'en' | 'hi' | 'kn') => {
    setLanguage(lang);
    if (user) {
      supabase.from('profiles').update({ language: lang }).eq('id', user.id);
      if (settings) {
        supabase.from('user_settings').update({ language: lang }).eq('user_id', user.id);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">{t('settings.title')}</h1>

      {/* Account */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('settings.account')}</p>
        <div className="card space-y-3">
          <div>
            <label className="label">{t('auth.name')}</label>
            <p className="text-sm text-ink dark:text-gray-100">{profile?.name || 'N/A'}</p>
          </div>
          <div>
            <label className="label">{t('auth.email')}</label>
            <p className="text-sm text-ink dark:text-gray-100">{profile?.email || user?.email || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Health */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('settings.health')}</p>
        <div className="card space-y-4">
          <div>
            <label className="label">Cycle length: {cycleLength} days</label>
            <input type="range" min={15} max={45} value={cycleLength} onChange={e => setCycleLength(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <label className="label">Period duration: {periodDuration} days</label>
            <input type="range" min={1} max={10} value={periodDuration} onChange={e => setPeriodDuration(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <label className="label">Cycle regularity</label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 'regular', label: 'Regular' },
                { val: 'somewhat_irregular', label: 'Somewhat irregular' },
                { val: 'very_irregular', label: 'Very irregular' },
                { val: 'not_sure', label: 'Not sure' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setRegularity(opt.val as CycleRegularity)}
                  className={`chip ${regularity === opt.val ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSaveCycle} className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving...' : t('common.save')}
          </button>
          {savedMsg && <Badge color="success">Saved</Badge>}
        </div>
      </div>

      {/* Appearance */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('settings.appearance')}</p>
        <div className="card">
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map(th => (
              <button
                key={th}
                onClick={() => handleThemeChange(th)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${theme === th ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
              >
                {th === 'light' ? t('settings.light') : th === 'dark' ? t('settings.dark') : t('settings.system')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Language */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('settings.language')}</p>
        <div className="card">
          <div className="flex gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code as 'en' | 'hi' | 'kn')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${language === l.code ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('settings.privacy')}</p>
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink dark:text-gray-200">Privacy Lock</span>
            <Toggle checked={settings?.privacy_lock_enabled || false} onChange={() => {}} label="Privacy Lock" />
          </div>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Configure PIN and biometric unlock in Privacy & Data settings.</p>
        </div>
      </div>
    </div>
  );
}
