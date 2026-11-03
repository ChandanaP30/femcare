import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { Shield, Trash2, AlertTriangle, Lock, X } from 'lucide-react';

export function PrivacyScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function deleteHealthRecords() {
    if (!user) return;
    if (!confirm(t('deleteRecordsConfirm'))) return;
    setDeleting(true);
    setDeleteError('');

    const [periodsErr, logsErr] = await Promise.all([
      supabase.from('periods').delete().eq('user_id', user.id),
      supabase.from('daily_logs').delete().eq('user_id', user.id),
    ]);

    if (periodsErr.error || logsErr.error) {
      setDeleteError(t('somethingWentWrong'));
    } else {
      setDeleting(false);
      alert(t('recordsDeleted'));
    }
    setDeleting(false);
  }

  async function deleteAccount() {
    if (!user) return;
    setDeleting(true);
    setDeleteError('');

    await Promise.all([
      supabase.from('periods').delete().eq('user_id', user.id),
      supabase.from('daily_logs').delete().eq('user_id', user.id),
      supabase.from('chat_messages').delete().eq('user_id', user.id),
      supabase.from('emergency_contacts').delete().eq('user_id', user.id),
      supabase.from('user_settings').delete().eq('user_id', user.id),
      supabase.from('profiles').delete().eq('id', user.id),
    ]);

    await signOut();
    onSignedOut();
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
        <h3 className="section-title mb-3 text-error-600 dark:text-error-400">{t('dangerZone')}</h3>
        <div className="space-y-2">
          <button
            onClick={deleteHealthRecords}
            disabled={deleting}
            className="card p-4 flex items-center gap-3 w-full text-left hover:shadow-md transition-all"
          >
            <Trash2 size={20} className="text-warning-500 shrink-0 dark:text-warning-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('deleteHealthRecords')}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t('deleteHealthRecordsDesc')}</p>
            </div>
          </button>

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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative card p-6 max-w-sm w-full animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-error-500 dark:text-error-300" />
                <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('deleteAccountConfirmTitle')}</h3>
              </div>
              <button onClick={() => setConfirmDelete(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t('deleteAccountConfirmText')}
            </p>
            {deleteError && <p className="text-sm text-error-600 dark:text-error-400 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={deleteAccount} disabled={deleting} className="btn-danger flex-1">
                {deleting ? t('deleting') : t('deleteEverything')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
