import knRegular from '@fontsource/noto-sans-kannada/files/noto-sans-kannada-kannada-400-normal.woff2?url';
import knBold from '@fontsource/noto-sans-kannada/files/noto-sans-kannada-kannada-700-normal.woff2?url';
import dvRegular from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff2?url';
import dvBold from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2?url';

const SOURCES = [
  { family: 'FemNotoKannada', weight: 400, url: knRegular },
  { family: 'FemNotoKannada', weight: 700, url: knBold },
  { family: 'FemNotoDevanagari', weight: 400, url: dvRegular },
  { family: 'FemNotoDevanagari', weight: 700, url: dvBold },
];

let cssCache: string | null = null;
let loadPromise: Promise<void> | null = null;

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load report font: ' + url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:font/woff2;base64,' + btoa(binary);
}

// @font-face rules for the report document (used by the HTML and by the PDF iframe).
export async function reportFontCss(): Promise<string> {
  if (cssCache !== null) return cssCache;
  const rules: string[] = [];
  for (const s of SOURCES) {
    const data = await toDataUri(s.url);
    rules.push(`@font-face{font-family:'${s.family}';font-style:normal;font-weight:${s.weight};src:url('${data}') format('woff2');}`);
  }
  cssCache = rules.join('\n');
  return cssCache;
}

// Loads the same fonts into the app document, so the PDF header and footer can be drawn with them.
export function loadPdfFonts(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      for (const s of SOURCES) {
        const face = new FontFace(s.family, `url(${await toDataUri(s.url)}) format('woff2')`, { weight: String(s.weight) });
        await face.load();
        document.fonts.add(face);
      }
    })().catch(() => { loadPromise = null; });
  }
  return loadPromise;
}