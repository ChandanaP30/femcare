import { useState, type FormEvent } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { PHYSICAL_SYMPTOMS, type CycleRegularity } from '@/lib/types';

const helpOptions = [
  'Cycle tracking', 'Understanding symptoms', 'General reproductive health',
  'Pregnancy information', 'Sexual health education', 'Finding healthcare', 'All of these',
];

export default function HealthSetup({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [step, setStep] = useState(0);
  const [lastPeriod, setLastPeriod] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);
  const [regularity, setRegularity] = useState<CycleRegularity>('regular');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [helpWith, setHelpWith] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const toggleHelp = (h: string) => {
    if (h === 'All of these') {
      setHelpWith(helpWith.includes('All of these') ? [] : [...helpOptions.filter(o => o !== 'All of these'), 'All of these']);
    } else {
      setHelpWith((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev.filter(x => x !== 'All of these'), h]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileData = {
        id: user!.id,
        name: user!.user_metadata?.name || '',
        email: user!.email || '',
        cycle_length: cycleLength,
        period_duration: periodDuration,
        last_period_date: lastPeriod || null,
        cycle_regularity: regularity,
        language: 'en',
        preferences: { help_with: helpWith, common_symptoms: selectedSymptoms },
      };

      await supabase.from('profiles').upsert(profileData);
      await supabase.from('user_settings').upsert({
        user_id: user!.id,
        theme: 'system',
        language: 'en',
        notifications: {},
        privacy_lock_enabled: false,
        sexual_health_visible: true,
      });

      // If last period provided, create a period record
      if (lastPeriod) {
        await supabase.from('periods').insert({
          user_id: user!.id,
          start_date: lastPeriod,
        });
      }

      onComplete();
    } catch (err) {
      console.error('Setup error:', err);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    // Step 0: Last period
    {
      title: 'When did your last period start?',
      subtitle: 'This helps calculate your cycle. You can skip and update later.',
      content: (
        <div className="space-y-4">
          <input type="date" className="input" value={lastPeriod} onChange={(e) => setLastPeriod(e.target.value)} max={new Date().toISOString().split('T')[0]} />
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">You can skip this and update later.</p>
        </div>
      ),
    },
    // Step 1: Cycle length
    {
      title: 'How long is your usual cycle?',
      subtitle: 'The number of days from the first day of one period to the first day of the next.',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setCycleLength(Math.max(15, cycleLength - 1))} className="btn-outline px-3 py-2">-</button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-primary">{cycleLength}</span>
              <span className="text-ink-muted dark:text-ink-muted-dark ml-1">days</span>
            </div>
            <button type="button" onClick={() => setCycleLength(Math.min(45, cycleLength + 1))} className="btn-outline px-3 py-2">+</button>
          </div>
          <input type="range" min={15} max={45} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} className="w-full accent-primary" />
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark text-center">Average is 28 days</p>
        </div>
      ),
    },
    // Step 2: Period duration
    {
      title: 'How many days does your period usually last?',
      subtitle: 'The number of days you typically bleed.',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setPeriodDuration(Math.max(1, periodDuration - 1))} className="btn-outline px-3 py-2">-</button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-primary">{periodDuration}</span>
              <span className="text-ink-muted dark:text-ink-muted-dark ml-1">days</span>
            </div>
            <button type="button" onClick={() => setPeriodDuration(Math.min(10, periodDuration + 1))} className="btn-outline px-3 py-2">+</button>
          </div>
          <input type="range" min={1} max={10} value={periodDuration} onChange={(e) => setPeriodDuration(Number(e.target.value))} className="w-full accent-primary" />
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark text-center">Average is 3-5 days</p>
        </div>
      ),
    },
    // Step 3: Regularity
    {
      title: 'Are your cycles usually:',
      subtitle: 'This helps us understand how to interpret your data.',
      content: (
        <div className="space-y-3">
          {[
            { val: 'regular', label: 'Regular', desc: 'Cycle length varies by less than 7 days' },
            { val: 'somewhat_irregular', label: 'Somewhat irregular', desc: 'Cycle length varies by 7-20 days' },
            { val: 'very_irregular', label: 'Very irregular', desc: 'Cycle length varies by more than 20 days' },
            { val: 'not_sure', label: 'Not sure', desc: "I don't know yet" },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => setRegularity(opt.val as CycleRegularity)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${regularity === opt.val ? 'border-primary bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}
            >
              <div className="font-medium text-ink dark:text-gray-100">{opt.label}</div>
              <div className="text-sm text-ink-muted dark:text-ink-muted-dark">{opt.desc}</div>
            </button>
          ))}
        </div>
      ),
    },
    // Step 4: Symptoms
    {
      title: 'Which symptoms do you commonly experience?',
      subtitle: 'Select all that apply. You can change these anytime.',
      content: (
        <div className="flex flex-wrap gap-2">
          {PHYSICAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${selectedSymptoms.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {selectedSymptoms.includes(s) && <Check size={14} />} {s}
            </button>
          ))}
        </div>
      ),
    },
    // Step 5: Help preferences
    {
      title: 'What would you like help with?',
      subtitle: 'We will personalise your experience based on your interests.',
      content: (
        <div className="flex flex-wrap gap-2">
          {helpOptions.map((h) => (
            <button
              key={h}
              onClick={() => toggleHelp(h)}
              className={`chip ${helpWith.includes(h) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {helpWith.includes(h) && <Check size={14} />} {h}
            </button>
          ))}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-bg dark:bg-bg-dark flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-4">
        <h2 className="text-xl font-bold text-ink dark:text-gray-100 mb-1">{current.title}</h2>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-6">{current.subtitle}</p>
        <div className="flex-1">{current.content}</div>
      </div>

      <div className="p-6 flex items-center gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn-outline flex-1">
            {t('common.back')}
          </button>
        )}
        {!isLast ? (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">
            {t('common.next')} <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : t('common.getStarted')}
          </button>
        )}
      </div>
    </div>
  );
}
