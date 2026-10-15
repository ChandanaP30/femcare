import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import {
  User as UserIcon, Bell, Shield, Globe, Lock, Trash2, LogOut,
  ChevronRight, Calendar, Settings as SettingsIcon, FileText, Heart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PageId } from '@/components/AppShell';

export default function Profile({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const items: { icon: typeof UserIcon; label: string; action: () => void; color?: string }[] = [
    { icon: UserIcon, label: t('profile.editProfile'), action: () => onNavigate('settings') },
    { icon: Calendar, label: t('profile.updateCycle'), action: () => onNavigate('settings') },
    { icon: Lock, label: t('profile.privacyLock'), action: () => onNavigate('privacy') },
    { icon: Shield, label: t('profile.privacyData'), action: () => onNavigate('privacy') },
    { icon: Bell, label: t('profile.notifications'), action: () => onNavigate('notifications') },
    { icon: Globe, label: t('profile.language'), action: () => onNavigate('settings') },
    { icon: FileText, label: 'Health Report', action: () => onNavigate('report') },
    { icon: SettingsIcon, label: t('settings.title'), action: () => onNavigate('settings') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">{t('profile.title')}</h1>

      {/* Profile card */}
      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-secondary dark:bg-primary-800 flex items-center justify-center text-primary text-2xl font-bold">
          {profile?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink dark:text-gray-100">{profile?.name || 'User'}</p>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark truncate">{profile?.email || user?.email}</p>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
            Language: {profile?.language?.toUpperCase() || 'EN'} · Cycle: {profile?.cycle_length || 28} days
          </p>
        </div>
      </div>

      {/* Menu items */}
      <div className="card p-0 overflow-hidden">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <Icon size={18} className="text-primary flex-shrink-0" />
              <span className="flex-1 text-left text-sm text-ink dark:text-gray-200">{item.label}</span>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          );
        })}
      </div>

      {/* Danger zone */}
      <div className="card p-0 overflow-hidden">
        <button onClick={() => onNavigate('privacy')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors border-b border-gray-100 dark:border-gray-800">
          <Trash2 size={18} className="text-error flex-shrink-0" />
          <span className="flex-1 text-left text-sm text-error">{t('profile.deleteHealthData')}</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button onClick={() => onNavigate('privacy')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors border-b border-gray-100 dark:border-gray-800">
          <UserIcon size={18} className="text-error flex-shrink-0" />
          <span className="flex-1 text-left text-sm text-error">{t('profile.deleteAccount')}</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <LogOut size={18} className="text-ink-muted flex-shrink-0" />
          <span className="flex-1 text-left text-sm text-ink dark:text-gray-200">{t('auth.logout')}</span>
        </button>
      </div>
    </div>
  );
}
