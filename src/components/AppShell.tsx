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
    <div className="min-h-screen bg-secondary-200 dark:bg-black flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-bg shadow-2xl flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-bg-card/90 backdrop-blur-md border-b border-primary-100/70 dark:border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {showBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-ink transition-colors hover:bg-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/70 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <ChevronLeft size={20} strokeWidth={2} />
              </button>
            )}
            <Logo size="sm" />
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-xl text-ink-muted hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
            aria-label={t('menu')}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        <OfflineBanner />

        {/* Slide-down menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-bg-card border-b border-primary-100/70 dark:border-white/10 shadow-soft-lg max-h-[75vh] overflow-y-auto rounded-b-3xl">
              <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] space-y-1">
                <p className="px-4 pb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('more')}</p>
                {EXTRA_PAGE_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => { onNavigate(key); setMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-ink hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {extraPageLabels[key]}
                    <ChevronRight size={16} className="text-ink-muted" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-bg-card/95 backdrop-blur-md border-t border-primary-100/70 dark:border-white/10 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-around rounded-t-3xl shadow-soft">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavChange(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors ${
                  active
                    ? 'bg-primary-100 text-ink dark:bg-primary-900/50 dark:text-primary-200'
                    : 'text-ink-muted hover:text-ink'
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