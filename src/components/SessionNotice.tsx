import { AlertTriangle, Shield, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { noticeMessageKey } from '@/lib/auth-security';

/** Explains on the sign-in screen why the person was signed out. */
export function SessionNotice() {
  const { notice, clearNotice } = useAuth();
  const { t } = useLanguage();
  if (!notice) return null;

  const good = notice === 'account_deleted' || notice === 'signed_out_everywhere';
  const Icon = good ? Shield : AlertTriangle;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div
        role="alert"
        className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-primary-200/70 bg-white p-4 shadow-lift dark:border-white/10 dark:bg-[#2A1E33]"
      >
        <span className={`mt-0.5 shrink-0 ${good ? 'text-primary-600 dark:text-primary-300' : 'text-error-600 dark:text-error-300'}`}>
          <Icon size={18} />
        </span>
        <p className="flex-1 text-sm text-ink">{t(noticeMessageKey(notice))}</p>
        <button type="button" onClick={clearNotice} aria-label={t('cancel')} className="shrink-0 text-ink-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
