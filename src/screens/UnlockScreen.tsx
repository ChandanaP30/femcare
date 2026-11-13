import { useState, type ReactNode } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCrypto } from '@/lib/crypto-context';
import { useLanguage } from '@/lib/language-context';
import { sendEmailCode, verifyEmailCode } from '@/lib/email-code';

export function CryptoGate({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { unlocked } = useCrypto();
  if (user && profile?.onboarding_completed && !unlocked) return <UnlockScreen />;
  return <>{children}</>;
}

type Step = 'main' | 'sendCode' | 'enterCode' | 'newPassphrase';

export function UnlockScreen() {
  const { user } = useAuth();
  const { hasSetup, setup, unlock, resetPassphrase } = useCrypto();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('main');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? '';

  function goTo(next: Step) {
    setStep(next);
    setPass('');
    setConfirm('');
    setCode('');
    setError('');
    setInfo('');
  }

  async function submitMain() {
    setError('');
    if (pass.length < 6) {
      setError(t('atLeast6Chars'));
      return;
    }
    setBusy(true);
    try {
      if (hasSetup) {
        const ok = await unlock(pass);
        if (!ok) setError(t('incorrectPassphrase'));
      } else {
        if (pass !== confirm) {
          setError(t('passphrasesDoNotMatch'));
          return;
        }
        await setup(pass);
      }
    } catch {
      setError(t('somethingWentWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setError('');
    setInfo('');
    if (!email) {
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
    setInfo(t('codeSent'));
    setStep('enterCode');
  }

  async function checkCode() {
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
    setCode('');
    setInfo('');
    setStep('newPassphrase');
  }

  async function saveNewPassphrase() {
    setError('');
    if (pass.length < 6) {
      setError(t('atLeast6Chars'));
      return;
    }
    if (pass !== confirm) {
      setError(t('passphrasesDoNotMatch'));
      return;
    }
    setBusy(true);
    try {
      await resetPassphrase(pass);
    } catch {
      setError(t('somethingWentWrong'));
    } finally {
      setBusy(false);
    }
  }

  const isMain = step === 'main';
  const title =
    step === 'newPassphrase' ? t('newPassphraseTitle')
    : isMain ? (hasSetup ? t('unlockTitle') : t('createPassphraseTitle'))
    : t('resetPassphraseTitle');
  const body =
    step === 'newPassphrase' ? t('resetWarning')
    : step === 'enterCode' ? t('enterCode')
    : step === 'sendCode' ? t('resetPassphraseBody', { email })
    : hasSetup ? t('unlockBody') : t('createPassphraseBody');

  const primaryAction =
    step === 'sendCode' ? requestCode
    : step === 'enterCode' ? checkCode
    : step === 'newPassphrase' ? saveNewPassphrase
    : submitMain;
  const primaryLabel = busy ? t('pleaseWait')
    : step === 'sendCode' ? t('sendCode')
    : step === 'enterCode' ? t('verifyCode')
    : step === 'newPassphrase' ? t('setNewPassphrase')
    : hasSetup ? t('unlockButton') : t('createPassphraseButton');
  const primaryDisabled = busy
    || (isMain && !pass)
    || (step === 'sendCode' && !email)
    || (step === 'enterCode' && code.length !== 6)
    || (step === 'newPassphrase' && !pass);

  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col justify-center bg-bg p-6">
      <div className="card p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
          {step === 'sendCode' || step === 'enterCode' ? <Mail size={22} strokeWidth={1.75} /> : <KeyRound size={22} strokeWidth={1.75} />}
        </span>
        <h1 className="mt-4 font-serif text-2xl text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>

        {isMain && (
          <div className="mt-5 space-y-3">
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('passphraseLabel')} autoComplete="off" className="input-field" />
            {!hasSetup && (
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('confirmPassphraseLabel')} autoComplete="off" className="input-field" />
            )}
          </div>
        )}

        {step === 'enterCode' && (
          <div className="mt-5">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="input-field text-center tracking-[0.4em]"
            />
          </div>
        )}

        {step === 'newPassphrase' && (
          <div className="mt-5 space-y-3">
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('passphraseLabel')} autoComplete="off" className="input-field" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('confirmPassphraseLabel')} autoComplete="off" className="input-field" />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-error-600 dark:text-error-300">{error}</p>}
        {info && !error && <p className="mt-3 text-sm text-ink-muted">{info}</p>}

        <button onClick={primaryAction} disabled={primaryDisabled} className="btn-primary mt-5 w-full">
          {primaryLabel}
        </button>

        {isMain && hasSetup && (
          <button type="button" onClick={() => goTo('sendCode')} className="mt-4 w-full text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
            {t('forgotPassphrase')}
          </button>
        )}
        {!isMain && (
          <button type="button" onClick={() => goTo('main')} className="mt-4 w-full text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
            {t('back')}
          </button>
        )}
      </div>
    </div>
  );
}