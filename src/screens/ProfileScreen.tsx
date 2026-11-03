import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Period } from '@/lib/types';
import { formatDate } from '@/lib/cycle';
import { ChevronRight, Lock, Bell, Palette, Shield, LogOut, Trash2, Info, Globe, CalendarDays, Timer, Droplet, Activity, Pencil, Sparkles, FileText } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { NavKey } from '@/components/nav-items';
import { HeaderArt } from '@/components/PageHeader';

interface ProfileScreenProps {
  onNavigate: (page: string) => void;
  onNavChange: (nav: NavKey) => void;
  onSignOut: () => void;
}

export function ProfileScreen({ onNavigate, onSignOut }: ProfileScreenProps) {
  const { profile, user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [cycleLength, setCycleLength] = useState(profile?.cycle_length || 28);
  const [periodDuration, setPeriodDuration] = useState(profile?.period_duration || 5);
  const [saving, setSaving] = useState(false);

  const loadPeriods = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false });
    setPeriods((data as Period[]) || []);
  }, [user]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setCycleLength(profile.cycle_length);
      setPeriodDuration(profile.period_duration);
    }
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    await updateProfile({ name, cycle_length: cycleLength, period_duration: periodDuration });
    setSaving(false);
    setEditing(false);
  }

  const initial = (profile?.name || user?.email || '?').charAt(0).toUpperCase();

  const cycleStats = [
    { icon: CalendarDays, label: t('averageCycleLength'), value: `${profile?.cycle_length || 28} ${t('days')}`, tone: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' },
    { icon: Timer, label: t('periodDuration'), value: `${profile?.period_duration || 5} ${t('days')}`, tone: 'bg-accent-300 text-ink-onlight dark:bg-accent-600/30 dark:text-accent-300' },
    { icon: Droplet, label: t('lastPeriodDate'), value: profile?.last_period_date ? formatDate(profile.last_period_date) : '\u2014', tone: 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-300' },
    { icon: Activity, label: t('regularity'), value: profile?.cycle_regularity || 'regular', tone: 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300', capitalize: true },
  ];

  const accountItems = [
    { icon: Lock, label: t('changePassword'), action: () => onNavigate('settings') },
    { icon: Bell, label: t('notifications'), action: () => onNavigate('notifications') },
    { icon: Palette, label: t('appearance'), action: () => onNavigate('settings') },
    { icon: Globe, label: t('language'), action: () => onNavigate('settings') },
  ];

  const privacyItems = [
    { icon: FileText, label: 'Health report', action: () => onNavigate('report') },
    { icon: Shield, label: t('privacyData'), action: () => onNavigate('privacy') },
    { icon: Info, label: t('aboutFemcare'), action: () => onNavigate('about') },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* Profile hero */}
      <section className="hero-surface relative overflow-hidden rounded-3xl border border-white/60 p-5 shadow-soft dark:border-white/10">
        <HeaderArt art="bloom" className="pointer-events-none absolute -right-3 -top-2 h-24 w-24 opacity-90" />
        <div className="relative flex items-center gap-4 pr-14">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-200 font-serif text-2xl text-ink-onlight ring-4 ring-white/70 dark:bg-primary-900/60 dark:text-primary-100 dark:ring-white/10">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-xl text-ink">{profile?.name || 'User'}</h1>
            <p className="truncate text-sm text-ink-muted">{user?.email}</p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
          >
            <Pencil size={14} strokeWidth={2} />
            {t('edit')}
          </button>
        )}

        {editing && (
          <div className="relative mt-5 space-y-5 border-t border-white/70 pt-5 dark:border-white/10">
            <div>
              <label htmlFor="profile-name" className="label-text">{t('yourName')}</label>
              <input id="profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label htmlFor="cycle-length" className="label-text">
                {t('averageCycleLength')}: <span className="font-semibold text-primary-700 dark:text-primary-300">{cycleLength} {t('days')}</span>
              </label>
              <input id="cycle-length" type="range" min={21} max={45} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} className="w-full accent-primary-500" />
            </div>
            <div>
              <label htmlFor="period-duration" className="label-text">
                {t('periodDuration')}: <span className="font-semibold text-primary-700 dark:text-primary-300">{periodDuration} {t('days')}</span>
              </label>
              <input id="period-duration" type="range" min={2} max={10} value={periodDuration} onChange={(e) => setPeriodDuration(Number(e.target.value))} className="w-full accent-primary-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        )}
      </section>

      {/* Cycle summary */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">{t('cycle')}</h3>
          {periods.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles size={13} strokeWidth={1.75} />
              {periods.length} {t('period')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cycleStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card flex flex-col gap-3 p-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${s.tone}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">{s.label}</p>
                  <p className={`mt-0.5 truncate text-sm font-semibold text-ink ${s.capitalize ? 'capitalize' : ''}`}>{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Settings */}
      <section>
        <h3 className="section-title mb-3">{t('settings')}</h3>
        <SettingsGroup items={accountItems} />
      </section>

      <section>
        <SettingsGroup items={privacyItems} />
      </section>

      <section className="space-y-3">
        <SettingsGroup items={[{ icon: LogOut, label: t('signOut'), action: onSignOut }]} />
        <SettingsGroup items={[{ icon: Trash2, label: t('deleteAccountOrData'), action: () => onNavigate('privacy'), danger: true }]} />
      </section>
    </div>
  );
}

interface SettingsItem {
  icon: typeof Lock;
  label: string;
  action: () => void;
  danger?: boolean;
}

function SettingsGroup({ items }: { items: SettingsItem[] }) {
  return (
    <div className="card divide-y divide-primary-100 overflow-hidden p-0 dark:divide-white/10">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.action}
            className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-primary-50 focus:bg-primary-50 focus:outline-none dark:hover:bg-white/5 dark:focus:bg-white/5"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                item.danger
                  ? 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-300'
                  : 'bg-secondary-200 text-ink dark:bg-white/10'
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
            </span>
            <span className={`flex-1 text-sm font-medium ${item.danger ? 'text-error-600 dark:text-error-300' : 'text-ink'}`}>{item.label}</span>
            <ChevronRight size={18} className="shrink-0 text-ink-muted" />
          </button>
        );
      })}
    </div>
  );
}