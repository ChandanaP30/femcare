import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot';

export function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useLanguage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        setError(error);
      } else {
        setResetSent(true);
      }
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('somethingWentWrong'));
      return;
    }

    if (password.length < 6) {
      setError(t('atLeast6Chars'));
      return;
    }

    setLoading(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onAuthSuccess();
    }
  }

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-neutral-50 dark:bg-neutral-900 shadow-2xl flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-8">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        {mode === 'forgot' && resetSent ? (
          <div className="card p-6 text-center animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mb-4">
              <Mail className="text-success-600 dark:text-success-400" size={28} />
            </div>
            <h2 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('checkYourEmail')}</h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
              {t('ifAccountExists', { email })}
            </p>
            <button onClick={() => { setMode('login'); setResetSent(false); }} className="btn-secondary w-full">
              {t('backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 animate-fade-in">
            <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              {mode === 'login' ? t('welcomeBack') : mode === 'signup' ? t('createAccount') : t('resetPassword')}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
              {mode === 'login' ? t('welcomeBackSubtitle') : mode === 'signup' ? t('createAccountSubtitle') : t('resetPasswordSubtitle')}
            </p>

            {error && (
              <div className="flex items-start gap-2 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 rounded-xl p-3 mb-4 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signup' && (
              <div className="mb-4">
                <label className="label-text" htmlFor="name">{t('name')}</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('yourNamePlaceholder')}
                  required
                  className="input-field"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="label-text" htmlFor="email">{t('email')}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field pl-10"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="mb-4">
                <label className="label-text" htmlFor="password">{t('password')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('atLeast6Chars')}
                    required
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="mb-4">
                <label className="label-text" htmlFor="confirmPassword">{t('confirmPassword')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('reenterPassword')}
                    required
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right mb-4">
                <button type="button" onClick={() => setMode('forgot')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                  {t('forgotPassword')}
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('pleaseWait')}
                </span>
              ) : mode === 'login' ? t('signIn') : mode === 'signup' ? t('createAccount') : t('sendResetLink')}
            </button>

            <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {mode === 'login' ? (
                <>{t('dontHaveAccount')} <button type="button" onClick={() => setMode('signup')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">{t('signUp')}</button></>
              ) : mode === 'signup' ? (
                <>{t('alreadyHaveAccount')} <button type="button" onClick={() => setMode('login')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">{t('signIn')}</button></>
              ) : (
                <button type="button" onClick={() => setMode('login')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline inline-flex items-center gap-1">
                  <ArrowLeft size={16} /> {t('backToLogin')}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 pb-6 px-6">
        {t('authDisclaimer')}
      </p>
      </div>
    </div>
  );
}
