import { translate } from './i18n';

// Built-in symptom keys, as used by the Log Period chips.
export const SYMPTOM_KEYS = [
  'cramps', 'headache', 'backPain', 'bloating', 'acne', 'fatigue', 'nausea', 'breastTenderness', 'dizziness',
  'irritability', 'anxiety', 'sadness', 'moodSwings', 'stress', 'lowEnergy',
  'symJointPain', 'symLegPain', 'symFoodCravings', 'symConstipation', 'symDiarrhea', 'symInsomnia', 'symSpotting',
  'symFrequentUrination', 'symChills', 'symCryingSpells', 'symAnger', 'symLowConcentration', 'symLowMotivation',
  'symOverwhelmed', 'symCalm',
];

const LANGS = ['en', 'hi', 'kn'];
const tr = (lang: string, key: string): string =>
  (translate as unknown as (k: string, l: string) => string)(key, lang);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

let lookup: Map<string, string> | null = null;

// Every label of every built-in symptom, in every language, maps back to its key.
function getLookup(): Map<string, string> {
  if (lookup) return lookup;
  const m = new Map<string, string>();
  for (const key of SYMPTOM_KEYS) {
    for (const lang of LANGS) {
      try {
        const label = tr(lang, key);
        if (label) m.set(norm(label), key);
      } catch {
        /* missing translation: skip */
      }
    }
  }
  lookup = m;
  return m;
}

/** The key for a stored symptom text in any language, or null for a custom symptom. */
export function symptomKeyOf(raw: string): string | null {
  return getLookup().get(norm(raw)) ?? null;
}

/** The English name of a built-in symptom key. This is what gets saved. */
export function englishSymptom(key: string): string {
  return tr('en', key);
}

/** Maps any stored text to the fixed saved form. Custom symptoms are kept as typed. */
export function canonicalSymptom(raw: string): string {
  const key = symptomKeyOf(raw);
  return key ? englishSymptom(key) : raw.trim();
}

/** Shows a stored symptom in the current language. Custom symptoms are shown as typed. */
export function displaySymptom(raw: string, lang: string): string {
  const key = symptomKeyOf(raw);
  return key ? tr(lang, key) : raw;
}