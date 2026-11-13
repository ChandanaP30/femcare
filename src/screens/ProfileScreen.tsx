import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Period } from '@/lib/types';
import { formatDate } from '@/lib/cycle';
import { ChevronRight, Lock, Bell, Palette, Shield, LogOut, Trash2, Info, Globe, CalendarDays, Timer, Droplet, Activity, Pencil, Sparkles, FileText, Camera } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { NavKey } from '@/components/nav-items';
import { Avatar } from '@/components/Avatar';
import { AvatarPicker } from '@/components/AvatarPicker';
import { pt } from '@/lib/picker-text';
import { readAvatar, type StoredAvatar } from '@/lib/avatar';

interface ProfileScreenProps {
  onNavigate: (page: string) => void;
  onNavChange: (nav: NavKey) => void;
  onSignOut: () => void;
}

const TONE_PRIMARY = 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300';
const TONE_ACCENT = 'bg-accent-300 text-ink-onlight dark:bg-accent-600/30 dark:text-accent-300';
const TONE_SUCCESS = 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300';
const TONE_NEUTRAL = 'bg-secondary-200 text-ink dark:bg-white/10';

export function ProfileScreen({ onNavigate, onSignOut }: ProfileScreenProps) {
  const { profile, user, updateProfile } = useAuth();
  const { t, lang } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [cycleLength, setCycleLength] = useState(profile?.cycle_length || 28);
  const [periodDuration, setPeriodDuration] = useState(profile?.period_duration || 5);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  // The avatar lives in profile.preferences.avatar. Other saved preferences are kept as they are.
  async function saveAvatar(next: StoredAvatar | null) {
    const current = { ...((profile?.preferences ?? {}) as Record<string, unknown>) };
    delete current.avatar;
    const preferences = next ? { ...current, avatar: next } : current;
    const { error } = await updateProfile({ preferences });
    if (error) throw new Error(error);
  }

  const avatar = readAvatar(profile?.preferences);
  const initial = (profile?.name || user?.email || '?').charAt(0).toUpperCase();

  const cycleStats = [
    { icon: CalendarDays, label: t('averageCycleLength'), value: `${profile?.cycle_length || 28} ${t('days')}`, tone: TONE_PRIMARY },
    { icon: Timer, label: t('periodDuration'), value: `${profile?.period_duration || 5} ${t('days')}`, tone: TONE_ACCENT },
    { icon: Droplet, label: t('lastPeriodDate'), value: profile?.last_period_date ? formatDate(profile.last_period_date) : '\u2014', tone: 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-300' },
    { icon: Activity, label: t('regularity'), value: profile?.cycle_regularity || 'regular', tone: TONE_SUCCESS, capitalize: true },
  ];

  const accountItems: SettingsItem[] = [
    { icon: Lock, label: t('changePassword'), action: () => onNavigate('settings'), tone: TONE_PRIMARY },
    { icon: Bell, label: t('notifications'), action: () => onNavigate('notifications'), tone: TONE_ACCENT },
    { icon: Palette, label: t('appearance'), action: () => onNavigate('settings'), tone: TONE_SUCCESS },
    { icon: Globe, label: t('language'), action: () => onNavigate('settings'), tone: TONE_NEUTRAL },
  ];

  const privacyItems: SettingsItem[] = [
    { icon: FileText, label: 'Health report', action: () => onNavigate('report'), tone: TONE_PRIMARY },
    { icon: Shield, label: t('privacyData'), action: () => onNavigate('privacy'), tone: TONE_SUCCESS },
    { icon: Info, label: t('aboutFemcare'), action: () => onNavigate('about'), tone: TONE_NEUTRAL },
  ];

  const accountActions: SettingsItem[] = [
    { icon: LogOut, label: t('signOut'), action: onSignOut },
    { icon: Trash2, label: t('deleteAccountOrData'), action: () => onNavigate('privacy'), danger: true },
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Profile hero */}
      <section className="hero-surface relative overflow-hidden rounded-2xl border border-white/60 px-4 py-3 shadow-soft dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg leading-tight text-ink">{profile?.name || 'User'}</h1>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
              >
                <Pencil size={12} strokeWidth={2} />
                {t('edit')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={pt(lang, 'changePicture')}
            className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Avatar avatar={avatar} fallback={initial} size={56} className="ring-2 ring-white/50 dark:ring-white/15" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white shadow-soft ring-2 ring-white/70 transition-transform group-hover:scale-105 dark:ring-[rgb(var(--card))]">
              <Camera size={10} strokeWidth={2} />
            </span>
          </button>
        </div>

        {editing && (
          <div className="mt-3 space-y-4 border-t border-white/70 pt-3 dark:border-white/10">
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
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="section-title">{t('cycle')}</h3>
          {periods.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Sparkles size={12} strokeWidth={1.75} />
              {periods.length} {t('period')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {cycleStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card flex items-center gap-2.5 !rounded-2xl !p-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.tone}`}>
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] leading-tight text-ink-muted">{s.label}</p>
                  <p className={`truncate text-sm font-semibold leading-snug text-ink ${s.capitalize ? 'capitalize' : ''}`}>{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Settings */}
      <section>
        <h3 className="section-title mb-2 px-1">{t('settings')}</h3>
        <div className="space-y-2.5">
          <SettingsGroup items={accountItems} />
          <SettingsGroup items={privacyItems} />
          <SettingsGroup items={accountActions} />
        </div>
      </section>

      {pickerOpen && (
        <AvatarPicker
          current={avatar}
          fallback={initial}
          onClose={() => setPickerOpen(false)}
          onSave={saveAvatar}
        />
      )}
    </div>
  );
}

interface SettingsItem {
  icon: typeof Lock;
  label: string;
  action: () => void;
  danger?: boolean;
  tone?: string;
}

function SettingsGroup({ items }: { items: SettingsItem[] }) {
  return (
    <div className="card divide-y divide-primary-100 overflow-hidden !rounded-2xl !p-0 dark:divide-white/10">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.action}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-primary-50 focus:bg-primary-50 focus:outline-none dark:hover:bg-white/5 dark:focus:bg-white/5"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                item.danger
                  ? 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-300'
                  : item.tone ?? TONE_NEUTRAL
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <span className={`flex-1 text-sm font-medium ${item.danger ? 'text-error-600 dark:text-error-300' : 'text-ink'}`}>{item.label}</span>
            <ChevronRight size={16} className="shrink-0 text-ink-muted" />
          </button>
        );
      })}
    </div>
  );
}