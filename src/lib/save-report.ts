import { Capacitor } from '@capacitor/core';
import type { jsPDF as JsPDFType } from 'jspdf';
import { loadPdfFonts } from './report-fonts';

const PAGE_W = 794;   // A4 width in CSS pixels at 96 dpi
const PAGE_H = 1123;  // A4 height in CSS pixels at 96 dpi
const MM_PER_PX = 297 / PAGE_H;
const TOP_MM = 14;    // space for the header
const CONTENT_MM = 269; // 297 minus header and footer space
const CONTENT_PX = Math.floor(CONTENT_MM / MM_PER_PX);
const BG = '#FFFAF7';
const PRINT_SCRIPT = '<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>';
const TEXT_FONT = "'FemNotoDevanagari','FemNotoKannada',Arial,sans-serif";

export interface PdfChrome {
  title: string;
  page: (n: number, total: number) => string;
}

const DEFAULT_CHROME: PdfChrome = {
  title: 'FemCare+ Health report',
  page: (n, total) => `Page ${n} of ${total}`,
};

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Unit { t: number; b: number }

// Blocks that must not be cut in half by a page break.
function collectUnits(body: HTMLElement): Unit[] {
  const top0 = body.getBoundingClientRect().top;
  const blockTags = 'p, li, h1, h2, h3, h4, td, th, .stat, .row, .note, .tl li, .card';
  const units: Unit[] = [];
  body.querySelectorAll('*').forEach((el) => {
    if (el.children.length > 0 && !el.matches(blockTags)) return;
    const r = el.getBoundingClientRect();
    if (r.height < 1) return;
    units.push({ t: r.top - top0, b: r.bottom - top0 });
  });
  return units;
}

// The lowest point within the page where no block is split. Falls back to a plain cut.
function chooseCut(units: Unit[], start: number, limit: number): number {
  const minCut = start + (limit - start) * 0.55;
  let best = -1;
  for (const u of units) {
    if (u.b <= minCut || u.b > limit || u.b <= best) continue;
    const split = units.some((o) => o.t < u.b - 0.5 && o.b > u.b + 0.5);
    if (!split) best = u.b;
  }
  return best > 0 ? best : limit;
}

// Draws one line of text to a PNG, so Kannada, Hindi and Latin all use the loaded fonts.
function textPng(text: string, px: number, color: string): { url: string; wMm: number; hMm: number } {
  const SCALE = 4;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas not available');
  measure.font = `${px * SCALE}px ${TEXT_FONT}`;
  const w = Math.ceil(measure.measureText(text).width) + 8;
  const h = Math.ceil(px * SCALE * 1.5);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.font = `${px * SCALE}px ${TEXT_FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 4, h / 2);
  const pxToMm = 25.4 / 96;
  return { url: c.toDataURL('image/png'), wMm: (w / SCALE) * pxToMm, hMm: (h / SCALE) * pxToMm };
}

function drawChrome(pdf: JsPDFType, pageNo: number, total: number, chrome: PdfChrome): void {
  const title = textPng(chrome.title, 11, '#4A3550');
  pdf.addImage(title.url, 'PNG', 14, 6, title.wMm, title.hMm);
  const label = textPng(chrome.page(pageNo, total), 10, '#7D6E82');
  pdf.addImage(label.url, 'PNG', 196 - label.wMm, 286, label.wMm, label.hMm);
  pdf.setDrawColor(230, 214, 224);
  pdf.setLineWidth(0.2);
  pdf.line(14, 12.5, 196, 12.5);
}

async function buildPdfBase64(html: string, chrome: PdfChrome): Promise<string> {
  try {
    await loadPdfFonts();
  } catch {
    // Fonts are optional for the header; the content still renders with the report's own fonts.
  }
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;border:0;`;
  document.body.appendChild(frame);

  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Report document not available');

    const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts) await fonts.ready;

    const body = doc.body;
    const fullH = Math.ceil(body.scrollHeight);
    frame.style.height = `${fullH}px`;
    await new Promise((r) => setTimeout(r, 60));

    const scale = Math.max(0.75, Math.min(2, 15000 / fullH));
    const canvas = await html2canvas(body, {
      scale,
      backgroundColor: BG,
      width: PAGE_W,
      height: fullH,
      windowWidth: PAGE_W,
      windowHeight: fullH,
      logging: false,
    });

    // Decide every page first, so the total page count is known for the footer.
    const units = collectUnits(body);
    const slices: { start: number; end: number }[] = [];
    let start = 0;
    while (start < fullH - 1) {
      const limit = start + CONTENT_PX;
      let end = limit >= fullH ? fullH : chooseCut(units, start, limit);
      if (end <= start) end = Math.min(limit, fullH);
      slices.push({ start, end });
      start = end;
    }

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    slices.forEach((sl, i) => {
      const sliceH = sl.end - sl.start;
      const pc = document.createElement('canvas');
      pc.width = canvas.width;
      pc.height = Math.max(1, Math.round(sliceH * scale));
      const ctx = pc.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, pc.width, pc.height);
      ctx.drawImage(canvas, 0, Math.round(sl.start * scale), canvas.width, pc.height, 0, 0, pc.width, pc.height);

      if (i > 0) pdf.addPage();
      pdf.setFillColor(255, 250, 247);
      pdf.rect(0, 0, 210, 297, 'F');
      pdf.addImage(pc.toDataURL('image/jpeg', 0.92), 'JPEG', 0, TOP_MM, 210, sliceH * MM_PER_PX);
      drawChrome(pdf, i + 1, slices.length, chrome);
    });

    const uri = pdf.output('datauristring');
    return uri.slice(uri.indexOf('base64,') + 7);
  } finally {
    frame.remove();
  }
}

/**
 * Saves or opens the health report.
 * In the Android app a PDF is created on the phone and the share sheet opens.
 * In a browser it downloads the HTML file or opens the print view, as before.
 * Returns false if it could not be done.
 */
export async function exportReport(html: string, mode: 'download' | 'print', chrome: PdfChrome = DEFAULT_CHROME): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const b64 = await buildPdfBase64(html, chrome);
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const filename = `FemCare-Health-Report-${stamp()}.pdf`;
      const written = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
      await Share.share({ title: filename, dialogTitle: filename, url: written.uri });
      return true;
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      if (/cancel/i.test(msg)) return true;
      return false;
    }
  }

  try {
    if (mode === 'print') {
      const url = URL.createObjectURL(new Blob([html.replace('</body>', PRINT_SCRIPT + '</body>')], { type: 'text/html' }));
      const win = window.open(url, '_blank');
      if (win) return true;
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `FemCare-Health-Report-${stamp()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}