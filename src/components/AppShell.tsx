import { useState, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { NAV_ITEMS, type NavKey } from '@/components/nav-items';
import { useLanguage } from '@/lib/language-context';
import { Menu, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { OfflineBanner } from './OfflineBanner';

interface AppShellProps {
  currentNav: NavKey;
  onNavChange: (nav: NavKey) => void;
  children: ReactNode;
  onNavigate: (page: string) => void;
  showBack?: boolean;
  onBack?: () => void;
}

const EXTRA_PAGE_KEYS = [
  'symptoms', 'log-period', 'history', 'chat', 'locator', 'education', 'leave-guide', 'settings', 'privacy', 'about',
] as const;

export function AppShell({ currentNav, onNavChange, children, onNavigate, showBack = false, onBack }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();

  const navLabels: Record<NavKey, string> = {
    home: t('home'),
    calendar: t('calendar'),
    insights: t('insights'),
    sos: t('sos'),
    profile: t('profile'),
  };

  const extraPageLabels: Record<string, string> = {
    symptoms: t('logSymptoms'),
    'log-period': t('logPeriod'),
    history: t('periodHistory'),
    chat: t('askAI'),
    locator: t('findPads'),
    education: t('healthEducation'),
    'leave-guide': t('leaveGuide'),
    settings: t('settings'),
    privacy: t('privacyData'),
    about: t('aboutFemcare'),
  };

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      {/* Phone frame */}
      <div className="relative w-full max-w-[430px] min-h-screen bg-neutral-50 dark:bg-neutral-900 shadow-2xl flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {showBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-ink transition-colors hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <ChevronLeft size={20} strokeWidth={2} />
              </button>
            )}
            <Logo size="sm" />
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            aria-label={t('menu')}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        <OfflineBanner />

        {/* Slide-down menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 animate-fade-in" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-soft-lg max-h-[75vh] overflow-y-auto animate-slide-up rounded-b-3xl">
              <div className="p-4 space-y-1">
                <p className="px-4 pb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t('more')}</p>
                {EXTRA_PAGE_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => { onNavigate(key); setMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {extraPageLabels[key]}
                    <ChevronRight size={16} className="text-neutral-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-bg-card/95 backdrop-blur-md border-t border-primary-100 px-2 pt-2 pb-3 flex items-center justify-around rounded-t-3xl shadow-soft">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavChange(item.key)}
                className={`flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all ${
                  active ? 'text-ink bg-primary-100' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon size={22} fill={active ? 'currentColor' : 'none'} />
                <span className="text-[10px] font-medium">{navLabels[item.key]}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
