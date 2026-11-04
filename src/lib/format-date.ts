import { getLangCode } from './lang-store';

// Formats a date in the user's chosen language, for example "Wed, 4 Nov 2026" in English
// or "ಬುಧ, ನವೆಂ 4, 2026" in Kannada. Pass a Date or a YYYY-MM-DD string.
export function formatLocalDate(value: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value.length === 10 ? value + 'T00:00:00' : value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLangCode(), options);
}