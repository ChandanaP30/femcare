import { rt, type ReportKey, type ReportLang } from './report-i18n';
import type { ReportData } from './report-data';

const LOCALE: Record<ReportLang, string> = { en: 'en-US', hi: 'hi-IN', kn: 'kn-IN' };

export interface ReportBuildOptions {
  lang: ReportLang;
  name: string;
  generated: Date;
  includeNotes: boolean;
  fontCss: string;
  logoDataUri?: string;
  range?: { from: string; to: string };
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const dateOf = (iso: string, lang: ReportLang): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric' });
};

const CSS = `
:root{--plum:#4A3550;--rose:#C98A9B;--lav:#B8A1D9;--cream:#FFFAF7;--white:#FFFFFF;--sage:#DCE8DC;--muted:#7D6E82;--line:#EFE6EC}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--plum);font-family:Inter,'FemNotoKannada','FemNotoDevanagari',Arial,sans-serif;font-size:13px;line-height:1.55}
.page{max-width:760px;margin:0 auto;padding:28px 22px 40px}
.cover{display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:22px}
.logo{width:64px;height:64px;border-radius:16px;flex:none;box-shadow:0 2px 10px -4px rgba(74,53,80,.25)}
.kicker{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--rose);font-weight:600;margin:0 0 6px}
h1{font-family:Georgia,'FemNotoKannada','FemNotoDevanagari',serif;font-weight:400;font-size:28px;margin:0 0 8px;color:var(--plum)}
.meta{font-size:12px;color:var(--muted)}
.meta b{color:var(--plum);font-weight:600}
.card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid;box-shadow:0 2px 10px -6px rgba(74,53,80,.18)}
h2{font-size:15px;margin:0 0 10px;color:var(--plum);break-after:avoid;page-break-after:avoid}
.legend{font-size:11px;color:var(--muted);margin:-4px 0 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat{background:var(--white);border:1px solid var(--line);border-radius:14px;padding:12px 14px;break-inside:avoid}
.stat .lab{font-size:11px;color:var(--muted)}
.stat .val{font-family:Georgia,'FemNotoKannada','FemNotoDevanagari',serif;font-size:18px;margin:3px 0 2px}
.stat .sub{font-size:11px;color:var(--muted)}
.badge{display:inline-block;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:600}
.badge.ok{background:var(--sage);color:#3E5B45}
.badge.review{background:#F4DCE5;color:#7A3B52}
.badge.insufficient{background:#EFE9F5;color:var(--plum)}
.tl{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid #E6D6DE}
.tl li{position:relative;padding:8px 0 8px 10px;break-inside:avoid}
.tl li::before{content:'';position:absolute;left:-19px;top:14px;width:9px;height:9px;border-radius:50%;background:var(--rose);box-shadow:0 0 0 3px var(--cream)}
.tl .dates{font-weight:600}
.tl .muted{color:var(--muted);font-size:12px}
.bar{height:7px;background:#F1E9EF;border-radius:6px;overflow:hidden;margin-top:5px}
.bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--rose),var(--lav));border-radius:6px}
.row{display:grid;grid-template-columns:1.4fr 2fr .9fr;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #F5EEF3;break-inside:avoid}
.row:last-child{border-bottom:0}
.row .v{text-align:right;color:var(--muted);font-size:12px;white-space:nowrap}
.pain{display:flex;align-items:flex-end;gap:6px;height:90px;padding:6px 0 0;break-inside:avoid}
.pain div{flex:1;text-align:center;font-size:10px;color:var(--muted)}
.pain .col{background:linear-gradient(180deg,var(--lav),var(--rose));border-radius:6px 6px 2px 2px;min-height:4px;margin:0 auto;width:70%}
table{width:100%;border-collapse:collapse;font-size:12px;break-inside:avoid}
th,td{border-top:1px solid #F5EEF3;padding:6px 6px;text-align:left}
th{color:var(--muted);font-weight:600;font-size:11px}
td.n,th.n{text-align:center}
ul.facts{margin:0;padding-left:18px}
ul.facts li{margin:6px 0}
.note{border-top:1px solid #F5EEF3;padding:7px 0;break-inside:avoid}
.muted{color:var(--muted)}
.disclaimer{background:#FBF1F5;border:1px solid #EFD7E1;border-radius:14px;padding:12px 16px;font-size:12px;break-inside:avoid}
.disclaimer b{display:block;margin-bottom:4px}
.empty{color:var(--muted);font-size:12px;margin:0}
@media print{body{background:var(--cream)}.page{padding:0}}
`;

export function buildReportHtml(d: ReportData, o: ReportBuildOptions): string {
  const L = o.lang;
  const t = (k: ReportKey, p?: Record<string, string | number>): string => esc(rt(L, k, p));
  const dayWord = (n: number): string => t(n === 1 ? 'unitDay' : 'unitDays');
  const na = t('notEnoughData');

  const cycleVal = d.cycleStats.avg === null ? na : `${d.cycleStats.avg} ${dayWord(Math.round(d.cycleStats.avg))}`;
  const periodVal = d.durationStats.avg === null ? na : `${d.durationStats.avg} ${dayWord(Math.round(d.durationStats.avg))}`;
  const rangeVal = d.cycleStats.min === null || d.cycleStats.max === null ? na : `${d.cycleStats.min}–${d.cycleStats.max} ${t('unitDays')}`;
  const lastVal = d.lastPeriod ? dateOf(d.lastPeriod.start, L) : t('noPeriodsYet');
  const lastSub = d.lastPeriod
    ? (d.lastPeriod.daysAgo === 0 ? t('lastPeriodToday') : t('lastPeriodDaysAgo', { n: d.lastPeriod.daysAgo }))
    : '';
  const cardsHtml = `<div class="grid">
    <div class="stat"><div class="lab">${t('cardAvgCycle')}</div><div class="val">${esc(cycleVal)}</div><div class="sub">${d.cycleStats.n ? t('basedOnCycles', { n: d.cycleStats.n }) : na}</div></div>
    <div class="stat"><div class="lab">${t('cardAvgPeriod')}</div><div class="val">${esc(periodVal)}</div><div class="sub">${d.durationStats.n ? t('basedOnCycles', { n: d.durationStats.n }) : na}</div></div>
    <div class="stat"><div class="lab">${t('cardCycleRange')}</div><div class="val">${esc(rangeVal)}</div><div class="sub">${d.cycleStats.n ? t('basedOnCycles', { n: d.cycleStats.n }) : na}</div></div>
    <div class="stat"><div class="lab">${t('cardLastPeriod')}</div><div class="val">${esc(lastVal)}</div><div class="sub">${esc(lastSub)}</div></div>
  </div>`;

  const qualityWord = d.quality.status === 'ok' ? t('qualityLooksComplete') : t('qualityNeedsReview');
  const qualityHtml = `<section class="card"><h2>${t('sectionQuality')}</h2>
    <span class="badge ${d.quality.status}">${qualityWord}</span>
    <p style="margin:8px 0 0">${t(d.quality.key, d.quality.params)}</p>
    <p class="legend" style="margin-top:6px">${t('recordedLabel')} · ${t('basedOnLogs', { n: d.logsLogged })}</p></section>`;

  const timelineItems = d.timeline.length
    ? d.timeline.map((p) => {
        const endTxt = p.end ? dateOf(p.end, L) : t('timelineNoEnd');
        const pctW = p.duration ? Math.min(100, Math.max(10, (p.duration / 10) * 100)) : 10;
        const durTxt = p.duration ? t('timelineDays', { n: p.duration }) : '';
        return `<li><div class="dates">${esc(dateOf(p.start, L))} <span class="muted">→ ${esc(endTxt)}</span></div>
          <div class="muted" style="font-size:12px">${durTxt}</div>
          <div class="bar"><span style="width:${pctW}%"></span></div></li>`;
      }).join('')
    : `<li><p class="empty">${t('noPeriodsYet')}</p></li>`;
  const timelineHtml = `<section class="card"><h2>${t('sectionTimeline')}</h2><ul class="tl">${timelineItems}</ul></section>`;

  const barRows = (items: { label: string; count: number }[], empty: string): string => {
    if (!items.length) return `<p class="empty">${esc(empty)}</p>`;
    const max = Math.max(...items.map((i) => i.count), 1);
    return items.map((i) => `<div class="row"><div>${esc(i.label)}</div>
      <div><div class="bar"><span style="width:${Math.round((i.count / max) * 100)}%"></span></div></div>
      <div class="v">${t('logsCount', { n: i.count })}</div></div>`).join('');
  };
  const painCols = d.pain.recent.map((v) => `<div><div class="col" style="height:${Math.max(4, v * 8)}px"></div>${v}</div>`).join('');
  const painHtml = d.pain.n
    ? `<div style="margin-bottom:6px"><b>${t('painAverage')}:</b> ${d.pain.avg}/10 · ${t('basedOnLogs', { n: d.pain.n })}</div>
       <div class="pain">${painCols}</div><p class="legend">${t('painChartLegend')} · ${t('painRecent')}</p>`
    : `<p class="empty">${t('noPain')}</p>`;
  const symHtml = `<section class="card"><h2>${t('symptomsTitle')}</h2><p class="legend">${t('symptomsChartLegend')}</p>${barRows(d.symptoms, rt(L, 'noSymptoms'))}</section>`;
  const moodHtml = `<section class="card"><h2>${t('moodTitle')}</h2><p class="legend">${t('moodChartLegend')}</p>${barRows(d.moods, rt(L, 'noMoods'))}</section>`;
  const painCard = `<section class="card"><h2>${t('painTitle')}</h2>${painHtml}</section>`;

  let trendBody: string;
  if (d.trend.enough) {
    const head = `<tr><th>${t('sectionTrend')}</th>${d.trend.columns.map((c) => `<th class="n">${esc(c)}</th>`).join('')}</tr>`;
    const rows = d.trend.rows.map((r) => `<tr><td>${t('trendCycle', { n: r.cycle })}</td>${r.counts.map((c) => `<td class="n">${c}</td>`).join('')}</tr>`).join('');
    trendBody = `<table>${head}${rows}</table>`;
  } else {
    trendBody = `<p class="empty">${t('trendNotEnough')}</p>`;
  }
  const trendHtml = `<section class="card"><h2>${t('sectionTrend')}</h2>${trendBody}</section>`;

  // Consultation summary: recorded facts only, each with its basis. Every entry is already escaped by t().
  const consultLines: string[] = [];
  if (o.range) consultLines.push(t('consultRange', { from: dateOf(o.range.from, L), to: dateOf(o.range.to, L) }));
  consultLines.push(t('consultBasis', { cycles: d.cycleStats.n, logs: d.logsLogged, periods: d.periodsLogged }));
  consultLines.push(d.cycleStats.avg === null
    ? t('consultNone')
    : t('consultCycle', { avg: d.cycleStats.avg, min: d.cycleStats.min ?? '', max: d.cycleStats.max ?? '', n: d.cycleStats.n }));
  consultLines.push(d.durationStats.avg === null
    ? t('consultNone')
    : t('consultDuration', { avg: d.durationStats.avg, n: d.durationStats.n }));
  consultLines.push(d.timeline.length
    ? t('consultRecent', { dates: d.timeline.slice(-3).map((p) => dateOf(p.start, L)).join(', ') })
    : t('consultNone'));
  consultLines.push(t('consultSymptoms', { list: d.symptoms.length ? d.symptoms.map((s) => `${s.label} (${s.count})`).join(', ') : rt(L, 'noSymptoms') }));
  consultLines.push(t('consultMood', { list: d.moods.length ? d.moods.map((m) => `${m.label} (${m.count})`).join(', ') : rt(L, 'noMoods') }));
  consultLines.push(d.pain.n
    ? t('consultPain', { avg: d.pain.avg ?? '', n: d.pain.n, high: d.pain.high })
    : t('consultNone'));
  const consultHtml = `<section class="card"><h2>${t('sectionConsultation')}</h2>
    <p class="legend">${t('consultPurpose')}</p>
    <ul class="facts">${consultLines.map((x) => `<li>${x}</li>`).join('')}</ul></section>`;

  const notesHtml = o.includeNotes && d.notes.length
    ? `<section class="card"><h2>${t('sectionNotes')}</h2>${d.notes.map((n) => `<div class="note"><span class="muted">${esc(dateOf(n.date, L))}:</span> ${esc(n.text)}</div>`).join('')}</section>`
    : '';

  const logoHtml = o.logoDataUri ? `<img class="logo" src="${o.logoDataUri}" alt="FemCare+">` : '';

  return `<!DOCTYPE html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t('reportTitle')}</title><style>${o.fontCss}\n${CSS}</style></head><body><div class="page">
<header class="cover">
  ${logoHtml}
  <div>
    <p class="kicker">${t('brandKicker')}</p>
    <h1>${t('reportTitle')}</h1>
    <div class="meta">${t('preparedFor')}: <b>${esc(o.name)}</b><br>${t('generated')}: ${esc(o.generated.toLocaleDateString(LOCALE[L], { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
  </div>
</header>
<h2>${t('sectionSummary')}</h2>
<p class="legend">${t('recordedLabel')}</p>
${cardsHtml}
${qualityHtml}
${timelineHtml}
${symHtml}
${moodHtml}
${painCard}
${trendHtml}
${consultHtml}
${notesHtml}
<section class="disclaimer"><b>${t('disclaimerTitle')}</b>${t('disclaimer')}</section>
<p class="legend" style="text-align:center;margin-top:18px">${t('footerApp')}</p>
</div></body></html>`;
}