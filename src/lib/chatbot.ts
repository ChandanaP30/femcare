import type { ChatMessage } from './types';
import { NON_ENGLISH_KEYWORDS, RESPONSES, FALLBACK, SUGGESTED, type ChatLang } from './chatbot-translations';

interface KnowledgeEntry {
  id: string;
  keywords: string[];
  response: string;
}

const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'cramps',
    keywords: ['cramp', 'cramps', 'pain', 'painful period', 'period pain'],
    response:
      "Menstrual cramps are caused by your uterus contracting to shed its lining. The hormone prostaglandin triggers these contractions. Mild to moderate cramps are common, but severe pain that interferes with daily life is not normal and should be discussed with a healthcare professional.\n\nSome things that may help:\n• A warm heating pad on your lower abdomen\n• Gentle movement or stretching\n• Staying hydrated\n• Over-the-counter pain relievers (follow package directions)\n\nIf your cramps are severe, suddenly worse than usual, or don't improve with typical remedies, consider speaking with a qualified healthcare professional.",
  },
  {
    id: 'late',
    keywords: ['late', 'late period', 'missed period', 'no period', 'delayed'],
    response:
      "A period can be late for many reasons, including stress, changes in weight, travel, intense exercise, hormonal changes, or pregnancy. Some variation in cycle length is normal.\n\nIf your period is more than a few days late and you're sexually active, consider taking a pregnancy test. If your periods are frequently irregular or you've missed several in a row, it's a good idea to speak with a healthcare professional to understand the cause.",
  },
  {
    id: 'pms',
    keywords: ['pms', 'premenstrual', 'mood', 'mood swing', 'emotional', 'irritable'],
    response:
      "PMS (Premenstrual Syndrome) refers to physical and emotional symptoms that occur in the days before your period. Common symptoms include mood changes, irritability, bloating, fatigue, and breast tenderness. These are caused by hormonal shifts during the luteal phase.\n\nMost people experience some PMS symptoms, but if they significantly affect your daily life, relationships, or mental wellbeing, consider speaking with a healthcare professional. A more severe form called PMDD exists and is treatable.",
  },
  {
    id: 'ovulation',
    keywords: ['ovulation', 'ovulate', 'fertile', 'fertility'],
    response:
      "Ovulation is when an egg is released from your ovary, typically around the middle of your cycle (about 14 days before your next period). This is your most fertile time.\n\nSigns of ovulation can include:\n• Changes in cervical mucus (becomes clear and stretchy)\n• A slight increase in basal body temperature\n• Mild pelvic pain on one side\n\nThe fertile window includes the days around ovulation. FemCare+ estimates this based on your cycle data, but these are estimates and may not be accurate for irregular cycles.",
  },
  {
    id: 'track',
    keywords: ['track', 'tracking', 'log', 'how to track', 'cycle track'],
    response:
      "To track your cycle effectively with FemCare+:\n\n1. Log your period start date each cycle\n2. Record daily symptoms and mood\n3. Note your pain levels\n4. Keep logging consistently — more data means better estimates\n\nOver time, you'll see patterns in your cycle length, symptoms, and mood. Remember that predictions are estimates and may not be accurate for irregular cycles.",
  },
  {
    id: 'doctor',
    keywords: ['doctor', 'when to see', 'medical help', 'concern', 'worried', 'when should i'],
    response:
      "Consider speaking with a healthcare professional if you experience:\n\n• Severe pain that disrupts daily activities\n• Periods that are consistently very heavy (soaking through pads/tampons quickly)\n• Cycles that are consistently shorter than 21 days or longer than 35 days\n• Missing periods for 3+ months (if not pregnant)\n• Bleeding between periods\n• Symptoms that significantly affect your mental health\n• Any sudden change in your cycle that concerns you\n\nTrust your instincts — if something feels wrong, it's always valid to seek medical advice.",
  },
  {
    id: 'irregular',
    keywords: ['irregular', 'irregular cycle', 'irregular period'],
    response:
      "Irregular cycles are common, especially during puberty, perimenopause, or times of stress. A cycle is generally considered regular if it falls between 21–35 days with some variation.\n\nCauses of irregularity can include stress, weight changes, intense exercise, hormonal conditions, certain medications, and more.\n\nIf your cycles are frequently irregular or you notice a significant change, consider speaking with a healthcare professional. Some symptoms can have many causes, so professional evaluation is important.",
  },
  {
    id: 'heavy',
    keywords: ['heavy', 'heavy period', 'heavy bleeding', 'a lot of blood'],
    response:
      "Heavy menstrual bleeding (menorrhagia) is when bleeding is excessive enough to interfere with daily life. Signs include soaking through a pad or tampon every hour for several hours, passing large clots, or bleeding lasting more than 7 days.\n\nHeavy bleeding can have many causes and can lead to anemia. If you're experiencing heavy bleeding regularly, it's important to speak with a healthcare professional.",
  },
  {
    id: 'hygiene',
    keywords: ['hygiene', 'clean', 'sanitary', 'pad', 'tampon', 'cup'],
    response:
      "Good menstrual hygiene includes:\n\n• Changing pads every 3–4 hours and tampons every 4–6 hours\n• Washing your hands before and after changing products\n• Using mild soap and water for external cleaning only\n• Avoiding scented products in the genital area\n• Properly disposing of used products\n\nIf you experience itching, unusual odor, or discomfort, consider speaking with a healthcare professional.",
  },
  {
    id: 'nutrition',
    keywords: ['nutrition', 'food', 'diet', 'eat', 'iron', 'vitamin'],
    response:
      "Eating a balanced diet can help support your body during your cycle:\n\n• Iron-rich foods (leafy greens, beans, lean meat) to replenish iron lost during your period\n• Calcium and vitamin D for overall hormonal health\n• Magnesium-rich foods (nuts, seeds, dark chocolate) may help with cramps\n• Staying hydrated can reduce bloating\n• Limiting caffeine and salt may help with PMS symptoms\n\nIf you're considering supplements, speak with a healthcare professional first.",
  },
  {
    id: 'exercise',
    keywords: ['exercise', 'workout', 'physical activity', 'movement'],
    response:
      "Gentle exercise can help relieve period symptoms for many people:\n\n• Light walking or stretching can reduce cramps\n• Yoga may help with stress and mild pain\n• Swimming is fine during your period\n\nListen to your body — it's okay to rest if you need to. If you experience severe pain during exercise, consider speaking with a healthcare professional.",
  },
  {
    id: 'stress',
    keywords: ['stress', 'anxiety', 'mental health', 'wellbeing', 'well-being'],
    response:
      "Stress can affect your menstrual cycle by influencing hormone levels. Managing stress may help both your cycle and overall wellbeing:\n\n• Deep breathing or meditation\n• Adequate sleep (7–9 hours)\n• Gentle physical activity\n• Talking to someone you trust\n\nIf you're feeling persistently anxious, low, or overwhelmed, consider reaching out to a mental health professional. Your mental health matters just as much as your physical health.",
  },
  {
    id: 'bloating',
    keywords: ['bloat', 'bloating', 'water retention'],
    response:
      "Bloating before and during your period is common and is caused by hormonal changes. Some things that may help:\n\n• Reducing salt intake\n• Staying hydrated\n• Gentle movement\n• Limiting caffeine and carbonated drinks\n\nIf bloating is severe or persistent beyond your period, consider speaking with a healthcare professional.",
  },
  {
    id: 'headache',
    keywords: ['headache', 'migraine'],
    response:
      "Hormonal headaches and migraines can occur due to estrogen drops before your period. If you experience these regularly:\n\n• Track when they occur in relation to your cycle\n• Stay hydrated\n• Consider over-the-counter pain relief (follow package directions)\n• Rest in a quiet, dark space\n\nIf headaches are severe, frequent, or different from your usual pattern, speak with a healthcare professional.",
  },
  {
    id: 'acne',
    keywords: ['acne', 'skin', 'breakout'],
    response:
      "Hormonal acne is common before and during your period due to increased sebum production. Tips include:\n\n• A consistent, gentle skincare routine\n• Avoiding picking at breakouts\n• Using non-comedogenic products\n\nIf acne is severe, painful, or scarring, a dermatologist can help with targeted treatments.",
  },
];


// Match whole words/phrases only, so 'late' does not fire inside 'translate' or 'relate'.
function containsKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)', 'i').test(text);
}

// Detect which script the user typed in. Hindi uses Devanagari, Kannada has its own script.
// Text in Latin letters returns null (English, or romanised text).
export function detectScript(text: string): ChatLang | null {
  const hi = (text.match(/[\u0900-\u097F]/g) || []).length;
  const kn = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
  if (hi === 0 && kn === 0) return null;
  return kn > hi ? 'kn' : 'hi';
}

// Answers in the language the user wrote in; for Latin-script text it uses the app language.
// English keywords are always checked, so mixed text such as "my period late ho gaya" still works.
export function generateResponse(userMessage: string, _history: ChatMessage[], appLang: ChatLang = 'en'): string {
  const lower = userMessage.toLowerCase();
  const replyLang: ChatLang = detectScript(userMessage) ?? appLang;

  let bestMatch: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (containsKeyword(lower, keyword)) score += keyword.length;
    }
    // Hindi and Kannada attach suffixes to words, so match these as substrings.
    for (const lang of ['hi', 'kn'] as const) {
      for (const keyword of NON_ENGLISH_KEYWORDS[lang][entry.id] ?? []) {
        if (userMessage.includes(keyword)) score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore > 0) {
    if (replyLang === 'en') return bestMatch.response;
    return RESPONSES[replyLang][bestMatch.id] ?? bestMatch.response;
  }

  return FALLBACK[replyLang];
}

export function getSuggestedQuestions(lang: ChatLang): string[] {
  return SUGGESTED[lang] ?? SUGGESTED.en;
}

export const SUGGESTED_QUESTIONS = SUGGESTED.en;
