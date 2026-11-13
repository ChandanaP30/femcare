import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { BackupRestore } from '@/components/BackupRestore';
import { isDeleteConfirmed, type DeleteError } from '@/lib/auth-security';
import { Shield, Trash2, AlertTriangle, Lock, X, LogOut } from 'lucide-react';

export function PrivacyScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { signOutEverywhere, deleteAccount, deleteHealthData } = useAuth();
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [working, setWorking] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [recordsError, setRecordsError] = useState('');
  const [everywhereError, setEverywhereError] = useState('');
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');

  const confirmWord = t('deleteConfirmWord');
  const canDelete = password.length > 0 && isDeleteConfirmed(typed, confirmWord) && !deleting;

  function deleteMessage(error: DeleteError, fallback: 'deleteFailed' | 'deleteRecordsFailed'): string {
    switch (error) {
      case 'wrong_password': return t('deleteWrongPassword');
      case 'offline': return t('deleteNeedsOnline');
      case 'expired': return t('authSessionExpired');
      default: return t(fallback);
    }
  }

  async function deleteHealthRecords() {
    if (working) return;
    if (!confirm(t('deleteRecordsConfirm'))) return;
    setWorking(true);
    setRecordsError('');
    const { error } = await deleteHealthData();
    setWorking(false);
    if (error) {
      setRecordsError(deleteMessage(error, 'deleteRecordsFailed'));
      return;
    }
    alert(t('recordsDeleted'));
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setConfirmDelete(false);
    setPassword('');
    setTyped('');
    setDeleteError('');
  }

  async function handleDeleteAccount() {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await deleteAccount(password);
    setPassword('');
    if (error) {
      setDeleting(false);
      setDeleteError(deleteMessage(error, 'deleteFailed'));
      return;
    }
    // The account and its data are gone and this device is cleared. Reset the screen position.
    onSignedOut();
  }

  async function handleSignOutEverywhere() {
    setWorking(true);
    setEverywhereError('');
    const { error } = await signOutEverywhere();
    setWorking(false);
    if (error) {
      setEverywhereError(t('signOutEverywhereFailed'));
      return;
    }
    setConfirmEverywhere(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('privacyData')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('privacySubtitleMain')}</p>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{t('howDataUsedTitle')}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('howDataUsedDesc')}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>{t('dataUse1')}</p>
          <p>{t('dataUse2')}</p>
          <p>{t('dataUse3')}</p>
          <p>{t('dataUse4')}</p>
          <p>{t('dataUse5')}</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{t('dataSecurityTitle')}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t('dataSecurityDesc')}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="section-title mb-3">{t('accountSecurityTitle')}</h3>
        <button
          onClick={() => { setEverywhereError(''); setConfirmEverywhere(true); }}
          className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all"
        >
          <LogOut size={20} className="text-primary-600 shrink-0 dark:text-primary-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('signOutEverywhereTitle')}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{t('signOutEverywhereDesc')}</p>
          </div>
        </button>
      </div>

      <BackupRestore />

      <div>
        <h3 className="section-title mb-3 text-error-600 dark:text-error-400">{t('dangerZone')}</h3>
        <div className="space-y-2">
          <button
            onClick={deleteHealthRecords}
            disabled={working}
            className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all"
          >
            <Trash2 size={20} className="text-warning-500 shrink-0 dark:text-warning-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('deleteHealthRecords')}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t('deleteHealthRecordsDesc')}</p>
            </div>
          </button>
          {recordsError && <p role="alert" className="px-1 text-sm text-error-600 dark:text-error-400">{recordsError}</p>}

          <button
            onClick={() => setConfirmDelete(true)}
            className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all border-error-200 dark:border-error-800"
          >
            <AlertTriangle size={20} className="text-error-500 shrink-0 dark:text-error-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-error-600 dark:text-error-400">{t('deleteAccountTitle')}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t('deleteAccountDesc')}</p>
            </div>
          </button>
        </div>
      </div>

      {confirmEverywhere && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => !working && setConfirmEverywhere(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative card p-6 max-w-sm w-full animate-slide-up" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('signOutEverywhereConfirm')}</h3>
            <p className="mt-2 mb-4 text-sm text-neutral-600 dark:text-neutral-400">{t('signOutEverywhereDesc')}</p>
            {everywhereError && <p role="alert" className="text-sm text-error-600 dark:text-error-400 mb-3">{everywhereError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setConfirmEverywhere(false)} disabled={working} className="btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={handleSignOutEverywhere} disabled={working} className="btn-primary flex-1">{t('signOutEverywhereButton')}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={closeDeleteDialog}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative card p-6 max-w-sm w-full animate-slide-up" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-error-500 dark:text-error-300" />
                <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('deleteAccountConfirmTitle')}</h3>
              </div>
              <button onClick={closeDeleteDialog} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t('deleteAccountConfirmText')}
            </p>

            <label htmlFor="delete-password" className="label-text">{t('deletePasswordLabel')}</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field mb-3"
            />
            <label htmlFor="delete-word" className="label-text">{t('deleteTypeLabel', { word: confirmWord })}</label>
            <input
              id="delete-word"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input-field mb-4"
            />

            {deleteError && <p role="alert" className="text-sm text-error-600 dark:text-error-400 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={closeDeleteDialog} disabled={deleting} className="btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={handleDeleteAccount} disabled={!canDelete} className="btn-danger flex-1">
                {deleting ? t('deleting') : t('deleteEverything')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
