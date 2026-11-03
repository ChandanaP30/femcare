import { useLanguage } from '@/lib/language-context';
import type { Language } from '@/lib/types';

// Each name is shown in its own language, so a new user can find theirs without reading English.
const OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

export function LanguagePicker() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Language">
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          onClick={() => setLang(o.code)}
          aria-pressed={lang === o.code}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            lang === o.code
              ? 'bg-primary-500 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}