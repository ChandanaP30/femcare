import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { sendEmailCode, verifyEmailCode } from '@/lib/email-code';

// Sign in with a 6-digit code sent by email, instead of a link.
export function EmailCodeSignIn({ onAuthSuccess, onBack }: { onAuthSuccess: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    setError('');
    if (!validEmail) {
      setError(t('codeSendFailed'));
      return;
    }
    setBusy(true);
    const { error: err } = await sendEmailCode(email);
    setBusy(false);
    if (err) {
      setError(t('codeSendFailed'));
      return;
    }
    setSent(true);
  }

  async function verify() {
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t('invalidCode'));
      return;
    }
    setBusy(true);
    const { error: err } = await verifyEmailCode(email, code);
    setBusy(false);
    if (err) {
      setError(t('invalidCode'));
      return;
    }
    onAuthSuccess();
  }

  return (
    <div className="card space-y-4 p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
        <Mail size={22} strokeWidth={1.75} />
      </span>
      <h2 className="font-serif text-xl text-ink">{t('signInWithCode')}</h2>
      <p className="text-sm leading-relaxed text-ink-muted">{t('codeSignInBody')}</p>
      {!sent ? (
        <>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} autoComplete="email" className="input-field" />
          <button type="button" onClick={send} disabled={busy || !validEmail} className="btn-primary w-full">
            {busy ? t('pleaseWait') : t('sendCode')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t('codeSent')}</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="input-field text-center tracking-[0.4em]"
          />
          <button type="button" onClick={verify} disabled={busy || code.length !== 6} className="btn-primary w-full">
            {busy ? t('pleaseWait') : t('verifyCode')}
          </button>
        </>
      )}
      {error && <p className="text-sm text-error-600 dark:text-error-300">{error}</p>}
      <button type="button" onClick={onBack} className="w-full text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        {t('back')}
      </button>
    </div>
  );
}