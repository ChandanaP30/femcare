import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { CalendarHeart, Brain, Siren, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

const slides = [
  {
    icon: CalendarHeart,
    title: 'Track your cycle with confidence',
    description: 'Record your periods, symptoms, and cycle information in one place. Build a clear picture of your menstrual health over time.',
  },
  {
    icon: Brain,
    title: 'Understand your patterns',
    description: 'FemCare+ analyzes your logged information and provides personalized insights about your cycle, symptoms, and mood trends.',
  },
  {
    icon: Siren,
    title: 'Get help when you need it',
    description: 'Find nearby pharmacies and sanitary product stores quickly. Set up emergency contacts and access help when you need it most.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data stays yours',
    description: 'Your health information is private and secure. You control what you share, and you can delete your data at any time.',
  },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === slides.length - 1;
  const slide = slides[step];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-neutral-50 dark:bg-neutral-900 shadow-2xl flex flex-col">
      <header className="flex items-center justify-between px-6 pt-6 pb-2">
        <Logo size="sm" />
        <button onClick={onComplete} className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">
          Skip
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div key={step} className="animate-slide-up flex flex-col items-center text-center gap-8">
          <div className="flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 text-primary-600 dark:text-primary-300" style={{ width: 120, height: 120 }}>
            <Icon size={56} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              {slide.title}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {slide.description}
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
              <ArrowLeft size={18} /> Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onComplete() : setStep(step + 1))}
            className="flex-1 flex items-center justify-center gap-2 btn-primary"
          >
            {isLast ? 'Get Started' : 'Next'}
            <ArrowRight size={18} />
          </button>
        </div>
      </footer>
      </div>
    </div>
  );
}
