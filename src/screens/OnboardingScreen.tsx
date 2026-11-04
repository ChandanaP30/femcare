import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useLanguage } from '@/lib/language-context';
import { CalendarHeart, Brain, Siren, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

const slides = [
  { icon: CalendarHeart, title: 'onbSlide1Title', body: 'onbSlide1Body' },
  { icon: Brain, title: 'onbSlide2Title', body: 'onbSlide2Body' },
  { icon: Siren, title: 'onbSlide3Title', body: 'onbSlide3Body' },
  { icon: ShieldCheck, title: 'onbSlide4Title', body: 'onbSlide4Body' },
] as const;

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const isLast = step === slides.length - 1;
  const slide = slides[step];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-neutral-50 dark:bg-neutral-900 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 pt-12 pb-2">
          <Logo size="sm" />
          <button onClick={onComplete} className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">
            {t('onbSkip')}
          </button>
        </header>

        <div className="px-6 pt-2"><LanguagePicker /></div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
          <div key={step} className="animate-slide-up flex flex-col items-center text-center gap-8">
            <div className="flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 text-primary-600 dark:text-primary-300" style={{ width: 120, height: 120 }}>
              <Icon size={56} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
                {t(slide.title)}
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {t(slide.body)}
              </p>
            </div>
          </div>
        </div>

        <footer className="px-6 pb-8 pt-4 max-w-md mx-auto w-full">
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-primary-500' : 'w-2 bg-neutral-300 dark:bg-neutral-700'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft size={18} /> {t('onbBack')}
              </button>
            )}
            <button
              onClick={() => (isLast ? onComplete() : setStep(step + 1))}
              className="flex-1 flex items-center justify-center gap-2 btn-primary"
            >
              {isLast ? t('onbGetStarted') : t('onbNext')}
              <ArrowRight size={18} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}