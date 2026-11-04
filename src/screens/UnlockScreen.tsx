import { useLanguage } from '@/lib/language-context';
import { useState, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCrypto } from '@/lib/crypto-context';

export function CryptoGate({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { unlocked } = useCrypto();
  if (user && profile?.onboarding_completed && !unlocked) return <UnlockScreen />;
  return <>{children}</>;
}

export function UnlockScreen() {
  const { hasSetup, setup, unlock } = useCrypto();
  const { t } = useLanguage();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (pass.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (hasSetup) {
        const ok = await unlock(pass);
        if (!ok) setError('Incorrect passphrase.');
      } else {
        if (pass !== confirm) {
          setError('Passphrases do not match.');
          return;
        }
        await setup(pass);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col justify-center bg-bg p-6">
      <div className="card p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
          <KeyRound size={22} strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 font-serif text-2xl text-ink">
          {hasSetup ? t('unlockTitle') : 'Create a passphrase'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {hasSetup
            ? t('unlockBody')
            : 'This encrypts your notes, contacts, and saved chats. If you forget it, that data cannot be recovered.'}
        </p>
        <div className="mt-5 space-y-3">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Passphrase"
            autoComplete="off"
            className="input-field"
          />
          {!hasSetup && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm passphrase"
              autoComplete="off"
              className="input-field"
            />
          )}
        </div>
        {error && <p className="mt-3 text-sm text-error-600 dark:text-error-300">{error}</p>}
        <button onClick={submit} disabled={busy || !pass} className="btn-primary mt-5 w-full">
          {busy ? 'Please wait...' : hasSetup ? 'Unlock' : 'Create passphrase'}
        </button>
      </div>
    </div>
  );
}
