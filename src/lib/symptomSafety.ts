import { dayNum } from './symptomPatterns';

export interface SafetyLog {
  log_date: string;
  symptoms?: string[] | null;
  pain_level?: number | null;
  notes?: string | null;
}

export type SafetyFlag = 'self_harm_language' | 'severe_pain' | 'heavy_bleeding';

export interface SafetyNotice {
  flag: SafetyFlag;
  urgent: boolean;
  title: string;
  body: string;
}

const SELF_HARM = [
  'suicid', 'kill myself', 'end my life', 'end it all', 'self-harm', 'self harm', 'selfharm',
  'hurt myself', 'harm myself', 'want to die', 'wanna die', "don't want to live", 'cut myself',
  'ಆತ್ಮಹತ್ಯೆ', 'ಸಾಯಬೇಕು', 'आत्महत्या', 'मरना चाहती', 'मर जाना चाहती',
];

const HEAVY_BLEEDING = ['soaking', 'soaked through', 'large clots', 'clots', 'flooding', 'very heavy bleeding', 'heavy bleeding', 'hemorrhage', 'haemorrhage'];

export const SEVERE_PAIN_LEVEL = 8;

const NOTICES: Record<SafetyFlag, Omit<SafetyNotice, 'flag'>> = {
  self_harm_language: {
    urgent: true,
    title: 'You are not alone',
    body:
      'If you are having thoughts of harming yourself or ending your life, please reach out now. In India you can call Tele-MANAS on 14416 (free, 24x7, many languages). If you are in immediate danger, call 112 or go to the nearest emergency department. Talking to someone you trust can also help.',
  },
  severe_pain: {
    urgent: false,
    title: 'Severe pain deserves attention',
    body:
      'You logged severe pain recently. Pain that is intense, getting worse or stopping your daily life is not something to push through. Please speak to a doctor soon. If it is sudden and very severe, or comes with heavy bleeding, fainting or fever, get urgent medical help.',
  },
  heavy_bleeding: {
    urgent: false,
    title: 'Very heavy bleeding should be checked',
    body:
      'Very heavy bleeding, such as soaking through a pad or tampon every hour or two or passing large clots, should be checked by a doctor. If you feel dizzy or faint, get urgent medical help.',
  },
};

function textOf(l: SafetyLog): string {
  return [...(l.symptoms ?? []), l.notes ?? ''].join(' \n ').toLowerCase();
}

/**
 * Looks only at one user's own recent logs. Any returned notice should replace a
 * "your period may be near" message. Keyword matching cannot catch every wording.
 */
export function detectSafety(
  logs: SafetyLog[],
  today: string,
  opts: { painDays?: number; textDays?: number } = {},
): SafetyNotice[] {
  const painDays = opts.painDays ?? 3;
  const textDays = opts.textDays ?? 7;
  const t = dayNum(today);
  const flags = new Set<SafetyFlag>();

  for (const l of logs) {
    if (!l || typeof l.log_date !== 'string') continue;
    const age = t - dayNum(l.log_date);
    if (age < 0) continue;
    if (age < painDays && typeof l.pain_level === 'number' && l.pain_level >= SEVERE_PAIN_LEVEL) flags.add('severe_pain');
    if (age < textDays) {
      const txt = textOf(l);
      if (SELF_HARM.some((w) => txt.includes(w))) flags.add('self_harm_language');
      if (HEAVY_BLEEDING.some((w) => txt.includes(w))) flags.add('heavy_bleeding');
    }
  }

  const order: SafetyFlag[] = ['self_harm_language', 'severe_pain', 'heavy_bleeding'];
  return order.filter((f) => flags.has(f)).map((f) => ({ flag: f, ...NOTICES[f] }));
}
