import { useSyncExternalStore } from 'react';
import { Check, Loader2, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import { getOfflineStatus, subscribeOfflineStatus } from '@/lib/offline';
import { useLanguage } from '@/lib/language-context';

/** Always-visible connection and sync state: online and saved, syncing, offline, or a sync problem. */
export function OfflineStatusDot() {
  const s = useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus, getOfflineStatus);
  const { t } = useLanguage();

  let label = 'Online';
  let tone = 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300';
  let Icon = Check;
  let spin = false;

  if (!s.online) {
    label = t('offlineMode');
    if (s.pending > 0) label += ' ' + t('syncPending', { count: s.pending });
    tone = 'bg-warning-100 text-warning-600 dark:bg-warning-600/30 dark:text-warning-200';
    Icon = WifiOff;
  } else if (s.syncing) {
    label = t('syncing');
    tone = 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300';
    Icon = Loader2;
    spin = true;
  } else if (s.pending > 0) {
    label = t('syncPending', { count: s.pending });
    tone = 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300';
    Icon = RefreshCw;
  } else if (s.dropped > 0) {
    label = t('syncIssue', { count: s.dropped });
    tone = 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-200';
    Icon = AlertTriangle;
  }

  return (
    <span role="status" aria-label={label} title={label} className={`flex h-7 w-7 items-center justify-center rounded-full ${tone}`}>
      <Icon size={14} strokeWidth={2} className={spin ? 'animate-spin' : ''} />
    </span>
  );
}