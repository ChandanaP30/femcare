import { translate, type TranslationKey } from './i18n';
import type { Language } from './types';

// Maps each stored English symptom or mood value to its translation key.
// The database keeps the English value; only the displayed label changes.
const KEY_FOR: Record<string, TranslationKey> = {
  'Cramps': 'cramps', 'Headache': 'headache', 'Back pain': 'backPain', 'Bloating': 'bloating',
  'Acne': 'acne', 'Fatigue': 'fatigue', 'Nausea': 'nausea', 'Breast tenderness': 'breastTenderness',
  'Dizziness': 'dizziness', 'Irritability': 'irritability', 'Anxiety': 'anxiety', 'Sadness': 'sadness',
  'Mood swings': 'moodSwings', 'Stress': 'stress', 'Low energy': 'lowEnergy',
  good: 'good', neutral: 'neutral', low: 'low', difficult: 'difficult', irritable: 'irritable', happy: 'happy',
  'Joint pain': 'symJointPain', 'Leg pain': 'symLegPain', 'Food cravings': 'symFoodCravings', 'Constipation': 'symConstipation',
  'Diarrhea': 'symDiarrhea', 'Insomnia': 'symInsomnia', 'Spotting': 'symSpotting', 'Frequent urination': 'symFrequentUrination',
  'Chills': 'symChills', 'Crying spells': 'symCryingSpells', 'Anger': 'symAnger', 'Low concentration': 'symLowConcentration',
  'Low motivation': 'symLowMotivation', 'Overwhelmed': 'symOverwhelmed', 'Calm': 'symCalm',
};

export function translateSymptom(value: string, lang: Language): string {
  const key = KEY_FOR[value] ?? KEY_FOR[value.toLowerCase()];
  return key ? translate(key, lang) : value;
}
export function translateMood(key: string, lang: Language): string {
  return translateSymptom(key, lang);
}
