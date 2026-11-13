/** Short text for the badge and pill, for example "Period 3 days late". */
export function overdueText(lang: string, days: number): string {
  if (lang === 'hi') return `मासिक धर्म ${days} दिन देर से`;
  if (lang === 'kn') return `ಋತುಸ್ರಾವ ${days} ದಿನ ತಡ`;
  return `Period ${days} ${days === 1 ? 'day' : 'days'} late`;
}

/** Longer hint under the pill. After a week it adds a gentle note and never guesses at causes. */
export function overdueHint(lang: string, days: number, expected: string): string {
  const week = days >= 7;
  if (lang === 'hi') {
    return `अपेक्षित तारीख ${expected} थी। शुरू होने पर नीचे दिए बटन से दर्ज करें।` +
      (week ? ' यदि एक सप्ताह से अधिक देरी हो और आप चिंतित हों, तो डॉक्टर से बात करें।' : '');
  }
  if (lang === 'kn') {
    return `ನಿರೀಕ್ಷಿತ ದಿನಾಂಕ ${expected}. ಶುರುವಾದಾಗ ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ ದಾಖಲಿಸಿ.` +
      (week ? ' ಒಂದು ವಾರಕ್ಕಿಂತ ಹೆಚ್ಚು ತಡವಾಗಿ ನೀವು ಚಿಂತಿತರಾಗಿದ್ದರೆ ವೈದ್ಯರೊಂದಿಗೆ ಮಾತನಾಡಿ.' : '');
  }
  return `Expected on ${expected}. Tap Log period when it starts.` +
    (week ? ' If it is more than a week late and you are worried, a doctor can help.' : '');
}