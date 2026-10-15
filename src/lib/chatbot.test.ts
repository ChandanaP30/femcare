import { describe, it, expect } from 'vitest';
import { generateResponse, detectScript, getSuggestedQuestions } from './chatbot';
import { NON_ENGLISH_KEYWORDS, RESPONSES, FALLBACK, SUGGESTED } from './chatbot-translations';

const IDS = [
  'cramps', 'late', 'pms', 'ovulation', 'track', 'doctor', 'irregular', 'heavy',
  'hygiene', 'nutrition', 'exercise', 'stress', 'bloating', 'headache', 'acne',
];

describe('multilingual content is complete', () => {
  it('has Hindi and Kannada keywords and answers for every topic', () => {
    for (const lang of ['hi', 'kn'] as const) {
      for (const id of IDS) {
        expect(NON_ENGLISH_KEYWORDS[lang][id]?.length, `${lang} keywords for ${id}`).toBeGreaterThan(0);
        expect(RESPONSES[lang][id]?.length, `${lang} answer for ${id}`).toBeGreaterThan(50);
      }
    }
  });

  it('has a fallback message and the same number of suggestions in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      expect(FALLBACK[lang].length).toBeGreaterThan(50);
      expect(SUGGESTED[lang].length).toBe(SUGGESTED.en.length);
    }
  });

  it('answers in each language contain only that language plus digits and symbols, not the English answer', () => {
    for (const id of IDS) {
      expect(detectScript(RESPONSES.hi[id])).toBe('hi');
      expect(detectScript(RESPONSES.kn[id])).toBe('kn');
    }
  });

  it('keeps the safety advice (see a professional) in every answer that gives remedies', () => {
    for (const id of ['cramps', 'late', 'heavy', 'headache', 'bloating']) {
      expect(RESPONSES.hi[id]).toContain('विशेषज्ञ');
      expect(RESPONSES.kn[id]).toContain('ತಜ್ಞ');
    }
  });
});

describe('script detection', () => {
  it('detects Devanagari, Kannada and Latin text', () => {
    expect(detectScript('मुझे दर्द है')).toBe('hi');
    expect(detectScript('ನನಗೆ ನೋವು ಇದೆ')).toBe('kn');
    expect(detectScript('I have pain')).toBeNull();
  });
});

describe('Hindi questions', () => {
  it('answers a cramps question in Hindi', () => {
    expect(generateResponse('मुझे माहवारी में ऐंठन क्यों होती है?', [])).toBe(RESPONSES.hi.cramps);
  });
  it('answers a late-period question in Hindi', () => {
    expect(generateResponse('मेरी माहवारी देर से क्यों आई?', [])).toBe(RESPONSES.hi.late);
  });
  it('prefers the more specific topic (headache over generic pain)', () => {
    expect(generateResponse('मुझे सिर दर्द होता है', [])).toBe(RESPONSES.hi.headache);
  });
  it('answers PMS, ovulation and doctor questions in Hindi', () => {
    expect(generateResponse('पीएमएस क्या है?', [])).toBe(RESPONSES.hi.pms);
    expect(generateResponse('ओव्यूलेशन के दौरान क्या होता है?', [])).toBe(RESPONSES.hi.ovulation);
    expect(generateResponse('मुझे डॉक्टर से कब बात करनी चाहिए?', [])).toBe(RESPONSES.hi.doctor);
  });
  it('uses the Hindi fallback for unrecognised Hindi text', () => {
    expect(generateResponse('नमस्ते कैसे हैं आप', [])).toBe(FALLBACK.hi);
  });
});

describe('Kannada questions', () => {
  it('answers a cramps question in Kannada', () => {
    expect(generateResponse('ಮುಟ್ಟಿನ ಸಮಯದಲ್ಲಿ ನನಗೆ ಸೆಳೆತ ಏಕೆ ಆಗುತ್ತದೆ?', [])).toBe(RESPONSES.kn.cramps);
  });
  it('answers a late-period question in Kannada', () => {
    expect(generateResponse('ನನ್ನ ಮುಟ್ಟು ಏಕೆ ತಡವಾಗಿದೆ?', [])).toBe(RESPONSES.kn.late);
  });
  it('prefers the more specific topic (headache over generic pain)', () => {
    expect(generateResponse('ನನಗೆ ತಲೆನೋವು ಇದೆ', [])).toBe(RESPONSES.kn.headache);
  });
  it('answers PMS and doctor questions in Kannada', () => {
    expect(generateResponse('ಪಿಎಂಎಸ್ ಎಂದರೇನು?', [])).toBe(RESPONSES.kn.pms);
    expect(generateResponse('ನಾನು ಯಾವಾಗ ವೈದ್ಯರೊಂದಿಗೆ ಮಾತನಾಡಬೇಕು?', [])).toBe(RESPONSES.kn.doctor);
  });
  it('uses the Kannada fallback for unrecognised Kannada text', () => {
    expect(generateResponse('ನಮಸ್ಕಾರ ಹೇಗಿದ್ದೀರಿ', [])).toBe(FALLBACK.kn);
  });
});

describe('app language and mixed text', () => {
  it('answers an English question in the app language when it is Hindi', () => {
    expect(generateResponse('Why do I get cramps?', [], 'hi')).toBe(RESPONSES.hi.cramps);
  });
  it('answers in English when the app language is English', () => {
    expect(generateResponse('Why do I get cramps?', [], 'en')).toContain('uterus contracting');
  });
  it('the language the user types in wins over the app language', () => {
    expect(generateResponse('ಪಿಎಂಎಸ್ ಎಂದರೇನು?', [], 'hi')).toBe(RESPONSES.kn.pms);
  });
  it('handles mixed Hindi-English text', () => {
    expect(generateResponse('मेरा period late है', [])).toBe(RESPONSES.hi.late);
  });
  it('returns suggestions in the chosen language', () => {
    expect(getSuggestedQuestions('hi')[0]).toBe(SUGGESTED.hi[0]);
    expect(getSuggestedQuestions('kn')[0]).toBe(SUGGESTED.kn[0]);
  });
});
