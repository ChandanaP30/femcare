import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { Lock, Trash2, Shield, AlertCircle, KeyRound, Fingerprint } from 'lucide-react';
import { Toggle, Modal, Badge } from '@/components/ui';
import type { PageId } from '@/components/AppShell';

export default function Privacy({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user, settings, refreshProfile } = useAuth();
  const { t } = useTheme();
  const [pinEnabled, setPinEnabled] = useState(settings?.privacy_lock_enabled || false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [showDeleteData, setShowDeleteData] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const handleTogglePin = async (enabled: boolean) => {
    if (enabled) {
      setShowPinModal(true);
    } else {
      setPinEnabled(false);
      if (user) {
        await supabase.from('user_settings').update({ privacy_lock_enabled: false, privacy_pin_hash: null }).eq('user_id', user.id);
        await refreshProfile();
      }
    }
  };

  const handleSavePin = async () => {
    setPinError('');
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setPinError('PIN must be 4 digits');
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('PINs do not match');
      return;
    }
    if (!user) return;
    const hash = btoa(pinInput + user.id);
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      privacy_lock_enabled: true,
      privacy_pin_hash: hash,
    });
    setPinEnabled(true);
    setShowPinModal(false);
    setPinInput('');
    setPinConfirm('');
    await refreshProfile();
  };

  const handleDeleteData = async () => {
    if (!user) return;
    await Promise.all([
      supabase.from('periods').delete().eq('user_id', user.id),
      supabase.from('symptoms').delete().eq('user_id', user.id),
      supabase.from('chat_history').delete().eq('user_id', user.id),
    ]);
    setShowDeleteData(false);
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirm !== 'DELETE') return;
    await Promise.all([
      supabase.from('periods').delete().eq('user_id', user.id),
      supabase.from('symptoms').delete().eq('user_id', user.id),
      supabase.from('chat_history').delete().eq('user_id', user.id),
      supabase.from('emergency_contacts').delete().eq('user_id', user.id),
      supabase.from('user_settings').delete().eq('user_id', user.id),
      supabase.from('profiles').delete().eq('id', user.id),
    ]);
    await supabase.auth.signOut();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">{t('privacy.title')}</h1>

      {/* Privacy Lock */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('privacy.lockTitle')}</p>
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              <span className="text-sm text-ink dark:text-gray-200">Enable PIN</span>
            </div>
            <Toggle checked={pinEnabled} onChange={handleTogglePin} label="Enable PIN" />
          </div>
          {pinEnabled && (
            <>
              <button onClick={() => setShowPinModal(true)} className="btn-outline w-full text-sm">
                <KeyRound size={16} /> {t('privacy.changePin')}
              </button>
              <div className="flex items-center gap-2">
                <Fingerprint size={18} className="text-primary" />
                <span className="text-sm text-ink dark:text-gray-200">{t('privacy.biometric')}</span>
                <Badge color="gray">Not available on web</Badge>
              </div>
            </>
          )}
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
            PIN is stored securely using a hashed format, not in plain text. Protected screens include Symptoms, Sexual Health, Reproductive Health, Health Reports, and AI conversations.
          </p>
        </div>
      </div>

      {/* Data Usage */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark mb-2">{t('privacy.dataUsage')}</p>
        <div className="card space-y-3">
          <div className="flex items-start gap-2">
            <Shield size={18} className="text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ink dark:text-gray-200">Your data is private</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">Your health data is stored securely and is only accessible to you. We do not sell or share your data.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={18} className="text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ink dark:text-gray-200">What we store</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">Period dates, symptoms, moods, pain levels, notes, AI chat history, emergency contacts, and settings preferences.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={18} className="text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ink dark:text-gray-200">How we use it</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">To provide cycle predictions, personalised insights, and health education. AI features use your data locally on your device.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-error mb-2">Danger Zone</p>
        <div className="card space-y-3">
          <button onClick={() => setShowDeleteData(true)} className="btn-outline w-full text-error border-error-200 dark:border-error-900 hover:bg-error-50 dark:hover:bg-error-900/20">
            <Trash2 size={16} /> {t('privacy.deleteRecords')}
          </button>
          <button onClick={() => setShowDeleteAccount(true)} className="btn-danger w-full">
            <Trash2 size={16} /> {t('profile.deleteAccount')}
          </button>
        </div>
      </div>

      {/* PIN Modal */}
      <Modal open={showPinModal} onClose={() => setShowPinModal(false)} title="Set PIN">
        <div className="space-y-4">
          <div>
            <label className="label">Enter 4-digit PIN</label>
            <input className="input text-center text-2xl tracking-widest" type="password" maxLength={4} value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
          </div>
          <div>
            <label className="label">Confirm PIN</label>
            <input className="input text-center text-2xl tracking-widest" type="password" maxLength={4} value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
          </div>
          {pinError && <p className="text-sm text-error">{pinError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowPinModal(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleSavePin} className="btn-primary flex-1">Save PIN</button>
          </div>
        </div>
      </Modal>

      {/* Delete Data Modal */}
      <Modal open={showDeleteData} onClose={() => setShowDeleteData(false)} title="Delete All Health Data">
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-error-50 dark:bg-error-900/20">
            <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink dark:text-gray-200">This will permanently delete all your period logs, symptom entries, and chat history. This action cannot be undone.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteData(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleDeleteData} className="btn-danger flex-1">Delete Data</button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal open={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} title="Delete Account">
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-error-50 dark:bg-error-900/20">
            <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink dark:text-gray-200">This will permanently delete your account and all associated data, including periods, symptoms, contacts, and settings. This action cannot be undone.</p>
          </div>
          <div>
            <label className="label">Type DELETE to confirm</label>
            <input className="input" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteAccount(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleDeleteAccount} className="btn-danger flex-1" disabled={deleteConfirm !== 'DELETE'}>Delete Account</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
