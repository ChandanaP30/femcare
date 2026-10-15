import { useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';

export default function AuthScreen({ mode, onSwitch }: { mode: 'login' | 'signup' | 'forgot'; onSwitch: (m: 'login' | 'signup' | 'forgot') => void }) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          // Session active - profile setup will handle the rest
        } else {
          setInfo('Account created. Please check your email to confirm.');
        }
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setInfo(t('auth.resetLinkSent'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg.includes('Invalid login') ? 'Invalid email or password' : msg);
    } finally {
      setLoading(false);
    }
  };

  const isForgot = mode === 'forgot';

  return (
    <div className="min-h-screen bg-bg dark:bg-bg-dark flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/image.png" alt="FemCare+ logo" className="w-12 h-12 rounded-xl object-cover" />
          <span className="text-xl font-bold text-ink dark:text-gray-100">FemCare+</span>
        </div>

        <div className="card">
          <h1 className="text-xl font-bold text-ink dark:text-gray-100 mb-1">
            {isForgot ? t('auth.resetPassword') : mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-5">
            {isForgot ? 'Enter your email to receive a reset link' : 'Your health, your data, your control'}
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-error-50 dark:bg-error-900/30 text-error text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {info && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-success-50 dark:bg-success-900/30 text-success-600 text-sm">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">{t('auth.name')}</label>
                <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {!isForgot && (
              <div>
                <label className="label">{t('auth.password')}</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <label className="label">{t('auth.confirmPassword')}</label>
                <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? '...' : isForgot ? t('auth.resetPassword') : mode === 'login' ? t('auth.login') : t('auth.signup')}
            </button>
          </form>

          {!isForgot && mode === 'login' && (
            <button onClick={() => onSwitch('forgot')} className="block w-full text-center text-sm text-primary mt-3 hover:underline">
              {t('auth.forgotPassword')}
            </button>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            {mode === 'login' && (
              <button onClick={() => onSwitch('signup')} className="text-sm text-ink-muted dark:text-ink-muted-dark hover:text-primary">
                {t('auth.noAccount')}
              </button>
            )}
            {mode === 'signup' && (
              <button onClick={() => onSwitch('login')} className="text-sm text-ink-muted dark:text-ink-muted-dark hover:text-primary">
                {t('auth.haveAccount')}
              </button>
            )}
            {isForgot && (
              <button onClick={() => onSwitch('login')} className="text-sm text-ink-muted dark:text-ink-muted-dark hover:text-primary">
                {t('common.back')} to {t('auth.login')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
