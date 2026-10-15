import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { supabase } from './supabase';
import { translate, type TranslationKey } from './i18n';
import type { Language } from './types';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('femcare_lang');
      setLangState((saved as Language) || 'en');
      return;
    }

    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.language) {
        setLangState(data.language as Language);
        localStorage.setItem('femcare_lang', data.language);
      } else {
        const saved = localStorage.getItem('femcare_lang') as Language | null;
        setLangState(saved || 'en');
      }
    }
    load();
  }, [user]);

  const setLang = async (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('femcare_lang', newLang);
    if (user) {
      await supabase
        .from('user_settings')
        .update({ language: newLang, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(key, lang, params);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
