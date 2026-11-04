import type { Language } from './types';

const LOCALE: Record<Language, string> = { en: 'en-US', hi: 'hi-IN', kn: 'kn-IN' };

export function getLangCode(): string {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('femcare_lang')) as Language | null;
  return LOCALE[saved ?? 'en'] ?? 'en-US';
}