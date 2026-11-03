import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { Logo } from '@/components/Logo';
import { ArrowRight, Check } from 'lucide-react';
import { PHYSICAL_SYMPTOMS } from '@/lib/symptoms';

export function ProfileSetupScreen({ onComplete }: { onComplete: () => void }) {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [cycleRegularity, setCycleRegularity] = useState('regular');
  const [typicalSymptoms, setTypicalSymptoms] = useState<string[]>([]);
  const [notifyPeriod, setNotifyPeriod] = useState(true);
  const [notifyDaily, setNotifyDaily] = useState(true);

  function toggleSymptom(symptom: string) {
    setTypicalSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  }

  async function handleComplete() {
    setLoading(true);
    setError('');

    const { error: updateError } = await updateProfile({
      date_of_birth: dateOfBirth || null,
      cycle_length: cycleLength,
      period_duration: periodDuration,
      last_period_date: lastPeriodDate || null,
      cycle_regularity: cycleRegularity,
      typical_symptoms: typicalSymptoms,
      onboarding_completed: true,
      preferences: { notifyPeriod, notifyDaily },
    });

    setLoading(false);

    if (updateError) {
      setError(updateError);
    } else {
      onComplete();
    }
  }

  const steps = [t('basics'), t('cycle'), t('symptomsStep'), t('preferences')];
  const isLast = step === steps.length - 1;

  const regularityOptions: { value: string; label: string }[] = [
    { value: 'regular', label: t('regular') },
    { value: 'irregular', label: t('irregular') },
    
  ];

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-neutral-50 dark:bg-neutral-900 shadow-2xl flex flex-col">
      <header className="px-6 pt-6 pb-2">
        <Logo size="sm" />
      </header>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-4">
        <div className="flex gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
              <p className={`text-xs mt-1.5 font-medium ${i === step ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div key={step} className="animate-slide-up flex-1">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('letsGetToKnowYou')}</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('thisHelpsPersonalize')}</p>
              </div>
              <div>
                <label className="label-text">{t('yourName')}</label>
                <input type="text" value={user?.email || ''} disabled className="input-field opacity-60" />
              </div>
              <div>
                <label className="label-text">{t('yourDob')}</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="input-field" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('yourCycleDetails')}</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('enterWhatYouKnow')}</p>
              </div>
              <div>
                <label className="label-text">{t('avgCycleLength')}: <span className="text-primary-600 dark:text-primary-400 font-semibold">{cycleLength} {t('days')}</span></label>
                <input type="range" min={21} max={45} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>21 {t('days')}</span><span>45 {t('days')}</span>
                </div>
              </div>
              <div>
                <label className="label-text">{t('avgPeriodDurationLabel')}: <span className="text-primary-600 dark:text-primary-400 font-semibold">{periodDuration} {t('days')}</span></label>
                <input type="range" min={2} max={10} value={periodDuration} onChange={(e) => setPeriodDuration(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>2 {t('days')}</span><span>10 {t('days')}</span>
                </div>
              </div>
              <div>
                <label className="label-text">{t('lastPeriodStartDate')} <span className="text-neutral-400 font-normal">({t('optional')})</span></label>
                <input type="date" value={lastPeriodDate} onChange={(e) => setLastPeriodDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label-text">{t('cycleRegularity')} <span className="text-neutral-400 font-normal">({t('optional')})</span></label>
                <div className="flex gap-2">
                  {regularityOptions.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setCycleRegularity(r.value)}
                      className={`chip flex-1 justify-center ${cycleRegularity === r.value ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('typicalSymptoms')}</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('selectCommonSymptoms')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PHYSICAL_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    className={`chip ${typicalSymptoms.includes(s) ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                  >
                    {typicalSymptoms.includes(s) && <Check size={14} />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('notificationPrefs')}</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('chooseReminders')}</p>
              </div>
              <div className="space-y-3">
                <ToggleRow label={t('upcomingPeriodRemindersLabel')} checked={notifyPeriod} onChange={setNotifyPeriod} />
                <ToggleRow label={t('dailySymptomRemindersLabel')} checked={notifyDaily} onChange={setNotifyDaily} />
              </div>
              <div className="card-soft p-4 mt-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('canChangeLaterSettings')}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-error-600 dark:text-error-400 text-sm mt-4">{error}</p>}

        <div className="flex items-center gap-3 mt-6 pb-8">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn-ghost">
              {t('back')}
            </button>
          )}
          {!isLast ? (
            <button onClick={() => setStep(step + 1)} className="flex-1 btn-primary flex items-center justify-center gap-2">
              {t('next')} <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleComplete} disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2">
              {loading ? t('saving_') : t('completeSetup')} <Check size={18} />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between card p-4">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-800 ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
