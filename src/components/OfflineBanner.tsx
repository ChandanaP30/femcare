import { useSyncExternalStore } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { getOfflineStatus, subscribeOfflineStatus } from '@/lib/offline';
import { useLanguage } from '@/lib/language-context';

// Tells the user when the app is offline, when changes are waiting to sync, and when a change
// could not be saved because it conflicted with data on the server.
export function OfflineBanner() {
  const status = useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus, getOfflineStatus);
  const { t } = useLanguage();

  let message: string | null = null;
  let tone = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800';
  let Icon = WifiOff;

  if (!status.online) {
    message = t('offlineMode');
    if (status.pending > 0) message += ' ' + t('syncPending', { count: status.pending });
  } else if (status.syncing) {
    message = t('syncing');
    Icon = RefreshCw;
  } else if (status.pending > 0) {
    message = t('syncPending', { count: status.pending });
    Icon = RefreshCw;
  } else if (status.dropped > 0) {
    message = t('syncIssue', { count: status.dropped });
    Icon = AlertTriangle;
    tone = 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800';
  }

  if (!message) return null;

  return (
    <div role="status" className={`flex items-start gap-2 px-4 py-2 text-xs border-b ${tone}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
