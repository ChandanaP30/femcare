import { useState } from 'react';
import { Activity, Brain, MapPin, Shield } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

const slides = [
  { icon: Activity, titleKey: 'onb.1.title', descKey: 'onb.1.desc', color: 'text-primary' },
  { icon: Brain, titleKey: 'onb.2.title', descKey: 'onb.2.desc', color: 'text-accent' },
  { icon: MapPin, titleKey: 'onb.3.title', descKey: 'onb.3.desc', color: 'text-success' },
  { icon: Shield, titleKey: 'onb.4.title', descKey: 'onb.4.desc', color: 'text-warning' },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useTheme();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;

  return (
    <div className="min-h-screen bg-bg dark:bg-bg-dark flex flex-col">
      <div className="flex justify-end p-4">
        {!isLast && (
          <button onClick={onDone} className="text-sm text-ink-muted dark:text-ink-muted-dark hover:text-primary">
            {t('common.skip')}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        <div className={`w-24 h-24 rounded-2xl bg-secondary dark:bg-primary-800 flex items-center justify-center ${slide.color}`}>
          <Icon size={48} strokeWidth={1.5} />
        </div>
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-ink dark:text-gray-100 mb-3">{t(slide.titleKey)}</h1>
          <p className="text-ink-muted dark:text-ink-muted-dark">{t(slide.descKey)}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-8">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-primary' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
          />
        ))}
      </div>

      <div className="p-6 pb-10">
        <button
          onClick={() => (isLast ? onDone() : setIndex(index + 1))}
          className="btn-primary w-full"
        >
          {isLast ? t('common.getStarted') : t('common.next')}
        </button>
      </div>
    </div>
  );
}
