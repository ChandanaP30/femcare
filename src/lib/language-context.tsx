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

  const PENDING = 'femcare_lang_pending';

  async function saveLangToDb(userId: string, value: Language) {
    const { data: row } = await supabase.from('user_settings').select('id').eq('user_id', userId).maybeSingle();
    if (row) {
      await supabase.from('user_settings').update({ language: value, updated_at: new Date().toISOString() }).eq('user_id', userId);
    } else {
      await supabase.from('user_settings').insert({ user_id: userId, language: value });
    }
  }

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('femcare_lang') as Language | null;
      setLangState(saved || 'en');
      return;
    }
    let active = true;
    (async () => {
      const local = localStorage.getItem('femcare_lang') as Language | null;
      const pending = localStorage.getItem(PENDING) === '1';
      if (pending && local) {
        // A language chosen before signing in is saved to the new account and used from now on.
        localStorage.removeItem(PENDING);
        await saveLangToDb(user.id, local).catch(() => {});
        if (active) setLangState(local);
        return;
      }
      const { data } = await supabase.from('user_settings').select('language').eq('user_id', user.id).maybeSingle();
      const value = (data?.language as Language | undefined) || local || 'en';
      if (active) setLangState(value);
      localStorage.setItem('femcare_lang', value);
    })();
    return () => { active = false; };
  }, [user]);

  const setLang = async (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('femcare_lang', newLang);
    if (user) {
      await saveLangToDb(user.id, newLang);
    } else {
      localStorage.setItem(PENDING, '1');
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
