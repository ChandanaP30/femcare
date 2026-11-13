export type SymptomCategory = 'physical' | 'emotional';
export type SymptomPhase = 'late_luteal' | 'menstrual';

export interface SymptomKnowledge {
  /** Name as stored in daily logs (English). */
  key: string;
  label: string;
  category: SymptomCategory;
  /** Phases in which it is commonly reported. Many people do not experience it. */
  phases: SymptomPhase[];
  /** False when the app has no symptom chip for it yet. */
  inApp: boolean;
  description: string;
  references: string[];
}

export const KNOWLEDGE_SOURCE = 'FemCare+ clinical symptom summary supplied by the project team';
export const KNOWLEDGE_NOTE =
  'Not everyone experiences these symptoms. They are commonly reported, not signs that a period is starting.';

const k = (
  key: string,
  label: string,
  category: SymptomCategory,
  phases: SymptomPhase[],
  inApp: boolean,
  description: string,
): SymptomKnowledge => ({ key, label, category, phases, inApp, description, references: [KNOWLEDGE_SOURCE] });

const LL: SymptomPhase[] = ['late_luteal'];
const MN: SymptomPhase[] = ['menstrual'];

export const SYMPTOM_KNOWLEDGE: SymptomKnowledge[] = [
  // Late luteal phase (1-2 days before menstruation)
  k('Breast tenderness', 'Breast tenderness and swelling', 'physical', LL, true, 'Some people notice tender or swollen breasts in the day or two before a period.'),
  k('Bloating', 'Abdominal bloating', 'physical', LL, true, 'A feeling of fullness or swelling in the lower belly is commonly reported just before a period.'),
  k('Acne', 'Acne and breakouts', 'physical', LL, true, 'Some people get breakouts in the days before a period.'),
  k('Fatigue', 'Fatigue and low stamina', 'physical', ['late_luteal', 'menstrual'], true, 'Feeling more tired than usual is commonly reported before and during a period.'),
  k('Insomnia', 'Sleep disturbances', 'physical', LL, true, 'Some people sleep less well in the days before a period.'),
  k('Food cravings', 'Food cravings', 'physical', LL, true, 'Cravings for particular foods are commonly reported before a period.'),
  k('Increased appetite', 'Increased appetite', 'physical', LL, false, 'Some people feel hungrier than usual before a period.'),
  k('Irritability', 'Irritability', 'emotional', LL, true, 'Feeling more easily annoyed is commonly reported before a period.'),
  k('Mood swings', 'Mood swings', 'emotional', LL, true, 'Quick changes in mood are commonly reported before a period.'),
  k('Anxiety', 'Anxiety', 'emotional', LL, true, 'Some people feel more anxious in the days before a period.'),
  k('Tension', 'Tension', 'emotional', LL, false, 'Feeling tense or on edge is commonly reported before a period.'),
  k('Sadness', 'Sadness', 'emotional', LL, true, 'Some people feel low or sad before a period. If this is severe or lasts, please talk to a doctor.'),
  k('Crying spells', 'Crying spells', 'emotional', LL, true, 'Crying more easily is commonly reported before a period.'),
  // Menstrual phase (during bleeding)
  k('Cramps', 'Abdominal cramps', 'physical', MN, true, 'Cramping in the lower belly is commonly reported during a period.'),
  k('Back pain', 'Lower back pain', 'physical', MN, true, 'Lower back pain is commonly reported during a period.'),
  k('Thigh pain', 'Thigh pain', 'physical', MN, false, 'Pain that spreads to the thighs is commonly reported during a period.'),
  k('Diarrhea', 'Diarrhoea and digestive changes', 'physical', MN, true, 'Looser stools or other digestive changes are commonly reported during a period.'),
  k('Nausea', 'Nausea', 'physical', MN, true, 'Some people feel sick to the stomach during a period.'),
  k('Headache', 'Headaches and migraines', 'physical', MN, true, 'Headaches, including migraines, are commonly reported during a period.'),
  k('Low energy', 'Low stamina', 'physical', MN, true, 'Low energy is commonly reported during a period.'),
];

const norm = (s: string) => s.trim().toLowerCase();

export function findSymptomKnowledge(name: string): SymptomKnowledge | undefined {
  const n = norm(name);
  return SYMPTOM_KNOWLEDGE.find((e) => norm(e.key) === n);
}

export function symptomsForPhase(phase: SymptomPhase): SymptomKnowledge[] {
  return SYMPTOM_KNOWLEDGE.filter((e) => e.phases.includes(phase));
}
