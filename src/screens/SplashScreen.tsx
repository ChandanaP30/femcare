import { useEffect, useState } from 'react';
import { Droplet } from 'lucide-react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    const t2 = setTimeout(() => onDone(), 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-neutral-50 via-primary-50 to-accent-50 dark:from-neutral-900 dark:via-primary-900/20 dark:to-neutral-900 shadow-2xl">
        <div className={`transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-primary-400/20 animate-pulse-soft" style={{ width: 80, height: 80 }} />
              <div className="relative flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-xl" style={{ width: 80, height: 80 }}>
                <Droplet size={44} fill="currentColor" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="font-serif text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                FemCare<span className="text-accent-500">+</span>
              </h1>
              <p className="mt-2 text-neutral-500 dark:text-neutral-400 text-base font-medium">
                Understand your cycle. Care for yourself.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
