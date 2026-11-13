// Text used only by the Insights screen. A language with no entry falls back to English.
const EN = {
  range3m: '3 months',
  range6m: '6 months',
  range1y: '1 year',
  rangeAll: 'All',
  rangeNote: 'Applies to the charts and history below.',
  average: 'Average',
  shortest: 'Shortest',
  longest: 'Longest',
  cycles: 'Cycles',
  avgLabel: 'Average {n}',
  showAll: 'Show all ({n})',
  showLess: 'Show less',
  okay: 'Okay',
  dayOne: 'day',
  dayMany: 'days',
  cycleOne: 'Based on 1 cycle in this range: {n} days.',
  cycleRange: 'Across {n} cycles, your cycle length ranged from {min} to {max} days and averaged {avg}.',
  latestSame: ' Your latest cycle matched your average.',
  latestLonger: ' Your latest cycle was {n} {d} longer than average.',
  latestShorter: ' Your latest cycle was {n} {d} shorter than average.',
  symptomTop: '{name} was the symptom you logged most ({n} times, {p}% of symptom entries).',
  moodTop: 'Your most logged mood was {name} ({n} of {total} entries).',
  painTake: 'Across these {n} entries your pain averaged {avg} out of 10, with a high of {max}.',
};

export type TextKey = keyof typeof EN;
type Dict = Record<TextKey, string>;

const KN: Dict = {
  range3m: '3 ತಿಂಗಳು',
  range6m: '6 ತಿಂಗಳು',
  range1y: '1 ವರ್ಷ',
  rangeAll: 'ಎಲ್ಲಾ',
  rangeNote: 'ಕೆಳಗಿನ ಚಾರ್ಟ್‌ಗಳು ಮತ್ತು ಇತಿಹಾಸಕ್ಕೆ ಅನ್ವಯಿಸುತ್ತದೆ.',
  average: 'ಸರಾಸರಿ',
  shortest: 'ಅತಿ ಕಡಿಮೆ',
  longest: 'ಅತಿ ಹೆಚ್ಚು',
  cycles: 'ಚಕ್ರಗಳು',
  avgLabel: 'ಸರಾಸರಿ {n}',
  showAll: 'ಎಲ್ಲವನ್ನೂ ತೋರಿಸಿ ({n})',
  showLess: 'ಕಡಿಮೆ ತೋರಿಸಿ',
  okay: 'ಪರವಾಗಿಲ್ಲ',
  dayOne: 'ದಿನ',
  dayMany: 'ದಿನಗಳು',
  cycleOne: 'ಈ ಅವಧಿಯ 1 ಚಕ್ರದ ಆಧಾರದ ಮೇಲೆ: {n} ದಿನಗಳು.',
  cycleRange: '{n} ಚಕ್ರಗಳಲ್ಲಿ, ನಿಮ್ಮ ಚಕ್ರದ ಉದ್ದ {min} ರಿಂದ {max} ದಿನಗಳವರೆಗೆ ಇತ್ತು ಮತ್ತು ಸರಾಸರಿ {avg} ದಿನಗಳು.',
  latestSame: ' ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಚಕ್ರ ಸರಾಸರಿಗೆ ಸಮನಾಗಿತ್ತು.',
  latestLonger: ' ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಚಕ್ರ ಸರಾಸರಿಗಿಂತ {n} {d} ಹೆಚ್ಚು ಇತ್ತು.',
  latestShorter: ' ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಚಕ್ರ ಸರಾಸರಿಗಿಂತ {n} {d} ಕಡಿಮೆ ಇತ್ತು.',
  symptomTop: 'ನೀವು ಹೆಚ್ಚು ಬಾರಿ ದಾಖಲಿಸಿದ ಲಕ್ಷಣ {name} ({n} ಬಾರಿ, ಲಕ್ಷಣ ದಾಖಲೆಗಳಲ್ಲಿ {p}%).',
  moodTop: 'ನೀವು ಹೆಚ್ಚು ದಾಖಲಿಸಿದ ಮನಸ್ಥಿತಿ {name} ({total} ದಾಖಲೆಗಳಲ್ಲಿ {n}).',
  painTake: 'ಈ {n} ದಾಖಲೆಗಳಲ್ಲಿ ನಿಮ್ಮ ನೋವು ಸರಾಸರಿ 10ರಲ್ಲಿ {avg} ಇತ್ತು, ಗರಿಷ್ಠ {max}.',
};

const HI: Dict = {
  range3m: '3 महीने',
  range6m: '6 महीने',
  range1y: '1 साल',
  rangeAll: 'सभी',
  rangeNote: 'नीचे दिए गए चार्ट और इतिहास पर लागू होता है।',
  average: 'औसत',
  shortest: 'सबसे छोटा',
  longest: 'सबसे लंबा',
  cycles: 'चक्र',
  avgLabel: 'औसत {n}',
  showAll: 'सभी देखें ({n})',
  showLess: 'कम दिखाएं',
  okay: 'ठीक-ठाक',
  dayOne: 'दिन',
  dayMany: 'दिन',
  cycleOne: 'इस अवधि के 1 चक्र के आधार पर: {n} दिन।',
  cycleRange: '{n} चक्रों में आपके चक्र की लंबाई {min} से {max} दिन रही और औसत {avg} दिन रहा।',
  latestSame: ' आपका हाल का चक्र आपके औसत के बराबर था।',
  latestLonger: ' आपका हाल का चक्र औसत से {n} {d} लंबा था।',
  latestShorter: ' आपका हाल का चक्र औसत से {n} {d} छोटा था।',
  symptomTop: 'आपने सबसे ज़्यादा बार {name} लक्षण दर्ज किया ({n} बार, लक्षण प्रविष्टियों का {p}%)।',
  moodTop: 'आपका सबसे ज़्यादा दर्ज किया गया मूड {name} रहा ({total} में से {n} प्रविष्टियां)।',
  painTake: 'इन {n} प्रविष्टियों में आपका दर्द औसतन 10 में से {avg} रहा, अधिकतम {max}।',
};

const DICTS: Record<string, Dict> = { kn: KN, hi: HI };

export function tr(lang: string, key: TextKey, vars?: Record<string, string | number>): string {
  const code = String(lang || 'en').toLowerCase().slice(0, 2);
  const dict = DICTS[code];
  let s = (dict && dict[key]) || EN[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  }
  return s;
}