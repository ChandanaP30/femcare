// Text used only by the profile picture picker. A language with no entry falls back to English.
const EN = {
  title: 'Profile picture',
  changePicture: 'Change profile picture',
  tabPhoto: 'Photo',
  tabAvatar: 'Avatar',
  gallery: 'Gallery',
  takePhoto: 'Take a photo',
  processing: 'Processing photo...',
  photoHint: 'Your photo is cropped to a square and saved with your profile.',
  shuffle: 'Surprise me',
  skinTone: 'Skin tone',
  hairstyle: 'Hairstyle',
  hairColor: 'Hair colour',
  outfit: 'Outfit',
  outfitColor: 'Outfit colour',
  background: 'Background',
  remove: 'Remove',
  hair_short: 'Short',
  hair_bob: 'Bob',
  hair_long: 'Long',
  hair_curly: 'Curly',
  hair_bun: 'Bun',
  hair_ponytail: 'Ponytail',
  outfit_tee: 'T-shirt',
  outfit_hoodie: 'Hoodie',
  outfit_sweater: 'Sweater',
  outfit_dress: 'Dress',
  outfit_kurta: 'Kurta',
  errPickFirst: 'Choose or take a photo first.',
  errSave: "Couldn't save. Check your connection and try again.",
  errRemove: "Couldn't remove it. Check your connection and try again.",
  errNotImage: 'Please choose an image file.',
  errTooLarge: 'That image is too large. Pick one under 20 MB.',
  errRead: 'Could not read that image. Try a JPG or PNG.',
  errProcess: 'Could not process that image.',
};

export type PickerKey = keyof typeof EN;
type Dict = Record<PickerKey, string>;

const KN: Dict = {
  title: 'ಪ್ರೊಫೈಲ್ ಚಿತ್ರ',
  changePicture: 'ಪ್ರೊಫೈಲ್ ಚಿತ್ರ ಬದಲಿಸಿ',
  tabPhoto: 'ಫೋಟೋ',
  tabAvatar: 'ಅವತಾರ್',
  gallery: 'ಗ್ಯಾಲರಿ',
  takePhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
  processing: 'ಫೋಟೋ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...',
  photoHint: 'ನಿಮ್ಮ ಫೋಟೋವನ್ನು ಚೌಕಾಕಾರಕ್ಕೆ ಕತ್ತರಿಸಿ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನೊಂದಿಗೆ ಉಳಿಸಲಾಗುತ್ತದೆ.',
  shuffle: 'ಯಾದೃಚ್ಛಿಕ',
  skinTone: 'ಚರ್ಮದ ಬಣ್ಣ',
  hairstyle: 'ಕೇಶ ವಿನ್ಯಾಸ',
  hairColor: 'ಕೂದಲಿನ ಬಣ್ಣ',
  outfit: 'ಉಡುಪು',
  outfitColor: 'ಉಡುಪಿನ ಬಣ್ಣ',
  background: 'ಹಿನ್ನೆಲೆ',
  remove: 'ತೆಗೆದುಹಾಕಿ',
  hair_short: 'ಚಿಕ್ಕದು',
  hair_bob: 'ಬಾಬ್',
  hair_long: 'ಉದ್ದ',
  hair_curly: 'ಗುಂಗುರು',
  hair_bun: 'ಬನ್',
  hair_ponytail: 'ಪೋನಿಟೇಲ್',
  outfit_tee: 'ಟಿ-ಶರ್ಟ್',
  outfit_hoodie: 'ಹೂಡಿ',
  outfit_sweater: 'ಸ್ವೆಟರ್',
  outfit_dress: 'ಡ್ರೆಸ್',
  outfit_kurta: 'ಕುರ್ತಾ',
  errPickFirst: 'ಮೊದಲು ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ತೆಗೆಯಿರಿ.',
  errSave: 'ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  errRemove: 'ತೆಗೆದುಹಾಕಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  errNotImage: 'ದಯವಿಟ್ಟು ಚಿತ್ರ ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ.',
  errTooLarge: 'ಆ ಚಿತ್ರ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ. 20 MB ಗಿಂತ ಚಿಕ್ಕದನ್ನು ಆರಿಸಿ.',
  errRead: 'ಆ ಚಿತ್ರವನ್ನು ಓದಲಾಗಲಿಲ್ಲ. JPG ಅಥವಾ PNG ಪ್ರಯತ್ನಿಸಿ.',
  errProcess: 'ಆ ಚಿತ್ರವನ್ನು ಸಂಸ್ಕರಿಸಲಾಗಲಿಲ್ಲ.',
};

const HI: Dict = {
  title: 'प्रोफ़ाइल फ़ोटो',
  changePicture: 'प्रोफ़ाइल फ़ोटो बदलें',
  tabPhoto: 'फ़ोटो',
  tabAvatar: 'अवतार',
  gallery: 'गैलरी',
  takePhoto: 'फ़ोटो खींचें',
  processing: 'फ़ोटो तैयार हो रही है...',
  photoHint: 'आपकी फ़ोटो को चौकोर काटकर आपकी प्रोफ़ाइल के साथ सेव किया जाता है।',
  shuffle: 'रैंडम',
  skinTone: 'त्वचा का रंग',
  hairstyle: 'हेयरस्टाइल',
  hairColor: 'बालों का रंग',
  outfit: 'पोशाक',
  outfitColor: 'पोशाक का रंग',
  background: 'पृष्ठभूमि',
  remove: 'हटाएं',
  hair_short: 'छोटे',
  hair_bob: 'बॉब',
  hair_long: 'लंबे',
  hair_curly: 'घुंघराले',
  hair_bun: 'जूड़ा',
  hair_ponytail: 'पोनीटेल',
  outfit_tee: 'टी-शर्ट',
  outfit_hoodie: 'हुडी',
  outfit_sweater: 'स्वेटर',
  outfit_dress: 'ड्रेस',
  outfit_kurta: 'कुर्ता',
  errPickFirst: 'पहले फ़ोटो चुनें या खींचें।',
  errSave: 'सेव नहीं हो सका। अपना कनेक्शन जांचें और फिर कोशिश करें।',
  errRemove: 'हटाया नहीं जा सका। अपना कनेक्शन जांचें और फिर कोशिश करें।',
  errNotImage: 'कृपया कोई इमेज फ़ाइल चुनें।',
  errTooLarge: 'वह इमेज बहुत बड़ी है। 20 MB से छोटी चुनें।',
  errRead: 'वह इमेज पढ़ी नहीं जा सकी। JPG या PNG आज़माएं।',
  errProcess: 'वह इमेज प्रोसेस नहीं हो सकी।',
};

const DICTS: Record<string, Record<string, string>> = { kn: KN, hi: HI };
const EN_MAP: Record<string, string> = EN;

function code(lang: string): string {
  return String(lang || 'en').toLowerCase().slice(0, 2);
}

export function pt(lang: string, key: PickerKey): string {
  const d = DICTS[code(lang)];
  return (d && d[key]) || EN[key];
}

/** Same as pt, but for keys built at run time (hair_*, outfit_*). Falls back to the given text. */
export function ptDyn(lang: string, key: string, fallback: string): string {
  const d = DICTS[code(lang)];
  return (d && d[key]) || EN_MAP[key] || fallback;
}