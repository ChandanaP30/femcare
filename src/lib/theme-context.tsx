import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LanguageCode } from './i18n';
import { translate } from './i18n';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  t: (key: string) => string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('femcare_theme') as Theme) || 'system';
  });
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    return (localStorage.getItem('femcare_lang') as LanguageCode) || 'en';
  });

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };
    applyTheme();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem('femcare_theme', t);
    setThemeState(t);
  };

  const setLanguage = (l: LanguageCode) => {
    localStorage.setItem('femcare_lang', l);
    setLanguageState(l);
  };

  const t = (key: string) => translate(language, key);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
