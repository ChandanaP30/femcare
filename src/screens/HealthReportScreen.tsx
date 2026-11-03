import { useEffect, useState, type ReactNode } from 'react';
import { Download, ShieldCheck, Activity, CalendarDays, Droplet, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type PeriodRow = { id: string; start_date: string; end_date: string | null; blood_flow: string | null };
type LogRow = { id: string; log_date: string; mood: string | null; symptoms: string[] | null; pain_level: number | null; notes: string | null };

const DAY = 86400000;
const parseLocal = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function summarize(periods: PeriodRow[], logs: LogRow[]) {
  const starts = periods.map((p) => parseLocal(p.start_date)).sort((a, b) => a.getTime() - b.getTime());
  const cycles: number[] = [];
  let longGaps = 0;
  let shortGaps = 0;
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    if (len > 60) longGaps++;
    else if (len < 15) shortGaps++;
    else cycles.push(len);
  }
  const durations = periods
    .filter((p) => p.end_date)
    .map((p) => daysBetween(parseLocal(p.start_date), parseLocal(p.end_date as string)) + 1)
    .filter((d) => d >= 1 && d <= 10);
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const painRows = logs.filter((l) => (l.pain_level ?? 0) > 0);
  const symFreq = new Map<string, number>();
  logs.forEach((l) => (l.symptoms || []).forEach((s) => symFreq.set(s, (symFreq.get(s) || 0) + 1)));
  const moodFreq = new Map<string, number>();
  logs.forEach((l) => { if (l.mood) moodFreq.set(l.mood, (moodFreq.get(l.mood) || 0) + 1); });

  return {
    periodsLogged: periods.length,
    cycleCount: cycles.length,
    avgCycle: avg(cycles),
    minCycle: cycles.length ? Math.min(...cycles) : null,
    maxCycle: cycles.length ? Math.max(...cycles) : null,
    avgPeriod: avg(durations),
    missingEnd: periods.filter((p) => !p.end_date).length,
    longGaps,
    shortGaps,
    daysSinceLast: lastStart ? daysBetween(lastStart, today) : null,
    avgPain: avg(painRows.map((l) => l.pain_level as number)),
    painTrend: painRows.slice(-3).map((l) => l.pain_level as number),
    topSymptoms: [...symFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    topMoods: [...moodFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    recentPeriods: [...periods].slice(-6).reverse(),
    recentNotes: logs.filter((l) => l.notes && l.notes.trim()).slice(-5).reverse(),
  };
}

type Summary = ReturnType<typeof summarize>;

function qualityNote(s: Summary): string {
  if (s.periodsLogged < 3) return 'Log at least 3 periods for a useful summary.';
  const gaps = s.longGaps + s.shortGaps;
  if (gaps > 0) return `${gaps} gap${gaps > 1 ? 's' : ''} look like missed or duplicate logs and were not counted.`;
  if (s.missingEnd > 0) return `${s.missingEnd} period${s.missingEnd > 1 ? 's' : ''} have no end date.`;
  return 'No gaps or missing end dates found.';
}

function buildHtml(s: Summary, name: string, includeNotes: boolean): string {
  const hasIssues = s.periodsLogged < 3 || s.longGaps + s.shortGaps + s.missingEnd > 0;
  const maxSym = Math.max(1, ...s.topSymptoms.map(([, v]) => v));
  const maxMood = Math.max(1, ...s.topMoods.map(([, v]) => v));
  const bar = (v: number, max: number) =>
    `<span class="bar"><span style="width:${Math.round((v / max) * 100)}%"></span></span>`;
  const dots = (level: number) => {
    const n = Math.round(level);
    return `<span class="dots">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  };
  const icon = {
    cycle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
    range: '<svg viewBox="0 0 24 24"><path d="M4 18V6M10 18v-8M16 18v-5M22 18H2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  };
  const stat = (ico: string, label: string, value: string, sub: string) =>
    `<div class="stat"><div class="ico">${ico}</div><p class="sl">${esc(label)}</p><p class="sv">${esc(value)}</p><p class="ss">${esc(sub)}</p></div>`;
  const stats = [
    stat(icon.cycle, 'Average cycle', s.avgCycle ? `${Math.round(s.avgCycle)} days` : 'Not enough data', `${s.cycleCount} cycle${s.cycleCount === 1 ? '' : 's'} counted`),
    stat(icon.drop, 'Average period', s.avgPeriod ? `${Math.round(s.avgPeriod)} days` : '-', 'Typical bleeding length'),
    stat(icon.range, 'Cycle range', s.minCycle && s.maxCycle ? `${s.minCycle} to ${s.maxCycle} days` : '-', 'Shortest to longest'),
    stat(icon.check, 'Last period', s.daysSinceLast === null ? '-' : s.daysSinceLast === 0 ? 'Today' : `${s.daysSinceLast} days ago`, 'Most recent start'),
  ].join('');

  const quality = `<div class="quality ${hasIssues ? 'warn' : 'ok'}"><span class="qdot"></span><div><p class="qt">${hasIssues ? 'Needs review' : 'Looks complete'}</p><p class="qs">${esc(qualityNote(s))}</p></div></div>`;

  const periodItems = s.recentPeriods.map((p) => {
    const start = parseLocal(p.start_date);
    const end = p.end_date ? parseLocal(p.end_date) : null;
    return `<li><span class="when">${esc(fmtDate(start))}</span><span class="span">${end ? esc(fmtDate(end)) : 'No end date'}</span><span class="dur">${end ? `${daysBetween(start, end) + 1} days` : '-'}</span></li>`;
  }).join('') || '<li class="empty">No periods logged yet.</li>';

  const symptomRows = s.topSymptoms.map(([k, v]) => `<div class="metric"><span class="mk">${esc(k)}</span>${bar(v, maxSym)}<span class="mv">${v} logged</span></div>`).join('');
  const moodRows = s.topMoods.map(([k, v]) => `<div class="metric"><span class="mk">Mood: ${esc(k)}</span>${bar(v, maxMood)}<span class="mv">${v} logged</span></div>`).join('');
  const painRow = s.avgPain !== null
    ? `<div class="metric"><span class="mk">Average pain</span>${dots(s.avgPain)}<span class="mv">${s.avgPain.toFixed(1)} / 10</span></div>${s.painTrend.length > 1 ? `<p class="trend">Recent: ${esc(s.painTrend.join(', '))}</p>` : ''}`
    : '';
  const checkIns = symptomRows + moodRows + painRow || '<p class="empty">No check-ins logged yet.</p>';

  const notes = includeNotes && s.recentNotes.length
    ? `<section><h2>Recent notes</h2>${s.recentNotes.map((n) => `<p class="note-line"><span class="muted">${esc(fmtDate(parseLocal(n.log_date)))}</span> ${esc(n.notes || '')}</p>`).join('')}</section>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FemCare+ Health Report</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  :root { --cream:#FFFAF7; --burgundy:#6E2C3F; --rose:#B98C9A; --sage:#DCE8DC; --sage-ink:#4d6b52; --plum:#49384F; --muted:#7d6e82; --faint:#9a8fa0; --line:#efe6df; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--cream); color:var(--plum); font-family: Inter, Arial, sans-serif; font-size:10.5pt; line-height:1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 760px; margin: 0 auto; padding: 28px 20px 36px; }
  .mark { font-size:9pt; letter-spacing:.2em; text-transform:uppercase; color:var(--burgundy); font-weight:600; }
  .kind { font-size:9pt; color:var(--muted); margin-left:10px; }
  h1 { font-family: Fraunces, Georgia, serif; font-weight:500; font-size:26pt; color:var(--burgundy); margin:8px 0 14px; }
  .meta { display:flex; gap:28px; padding-bottom:16px; border-bottom:1px solid var(--line); }
  .meta div { display:flex; flex-direction:column; font-size:9pt; color:var(--muted); }
  .meta strong { color:var(--plum); font-weight:600; font-size:10.5pt; }
  .stats { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin:20px 0 4px; }
  .stat { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 12px; break-inside: avoid; }
  .ico { width:28px; height:28px; border-radius:50%; background:var(--sage); display:flex; align-items:center; justify-content:center; margin-bottom:8px; }
  .ico svg { width:15px; height:15px; fill:none; stroke:var(--sage-ink); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .sl { margin:0; font-size:8.5pt; color:var(--muted); }
  .sv { margin:4px 0 2px; font-family: Fraunces, Georgia, serif; font-size:14pt; color:var(--plum); }
  .ss { margin:0; font-size:8pt; color:var(--faint); }
  section { margin-top:20px; }
  h2 { font-family: Fraunces, Georgia, serif; font-weight:500; font-size:14pt; color:var(--burgundy); margin:0 0 10px; padding-bottom:6px; border-bottom:1px solid var(--line); break-after: avoid; }
  .quality { display:flex; gap:12px; align-items:flex-start; border-radius:14px; padding:12px 14px; background:var(--sage); break-inside: avoid; }
  .quality.warn { background:#f6ece9; }
  .qdot { width:10px; height:10px; border-radius:50%; background:var(--sage-ink); margin-top:5px; flex:none; }
  .quality.warn .qdot { background:var(--burgundy); }
  .qt { margin:0; font-weight:600; font-size:10.5pt; }
  .qs { margin:2px 0 0; font-size:9.5pt; color:#5b4e60; }
  .timeline { list-style:none; margin:0; padding:0 0 0 18px; border-left:2px solid #e4d6cc; }
  .timeline li { position:relative; display:grid; grid-template-columns: 1fr 1fr auto; gap:10px; padding:9px 0; border-bottom:1px solid #f3ece6; break-inside: avoid; }
  .timeline li:last-child { border-bottom:0; }
  .timeline li::before { content:''; position:absolute; left:-23px; top:14px; width:9px; height:9px; border-radius:50%; background:var(--rose); box-shadow:0 0 0 3px var(--cream); }
  .when { font-weight:600; }
  .span { color:var(--muted); }
  .dur { text-align:right; color:var(--burgundy); font-weight:600; }
  .empty { list-style:none; color:var(--muted); padding:8px 0; margin:0; }
  .metric { display:grid; grid-template-columns: 1.3fr 2fr 0.8fr; gap:12px; align-items:center; padding:9px 0; border-bottom:1px solid #f3ece6; break-inside: avoid; }
  .mk { overflow-wrap:anywhere; }
  .mv { text-align:right; color:var(--muted); white-space:nowrap; }
  .bar { display:block; height:6px; background:var(--line); border-radius:6px; overflow:hidden; }
  .bar > span { display:block; height:100%; background:var(--rose); border-radius:6px; }
  .dots { display:inline-flex; gap:3px; }
  .dots i { width:7px; height:7px; border-radius:50%; background:var(--line); display:inline-block; }
  .dots i.on { background:var(--burgundy); }
  .trend { font-size:9pt; color:var(--muted); margin:6px 0 0; }
  .note-line { font-size:10pt; margin:0; padding:8px 0; border-bottom:1px solid #f3ece6; overflow-wrap:anywhere; break-inside: avoid; }
  .muted { color:var(--muted); }
  .foot { margin-top:28px; padding-top:12px; border-top:1px solid #e4d6cc; font-size:8.5pt; color:var(--muted); text-align:center; break-inside: avoid; }
  @media (max-width:560px) {
    .stats { grid-template-columns: 1fr 1fr; }
    .meta { flex-direction:column; gap:8px; }
    .timeline li { grid-template-columns: 1fr auto; }
    .timeline li .span { display:none; }
    .metric { grid-template-columns: 1fr auto; }
    .metric .bar, .metric .dots { grid-column: 1 / -1; order: 3; }
  }
  @media print { .page { padding:0; max-width:none; } }
</style></head><body><div class="page">
  <header>
    <div><span class="mark">FemCare+</span><span class="kind">Health report</span></div>
    <h1>Health summary</h1>
    <div class="meta">
      <div><span>Prepared for</span><strong>${esc(name)}</strong></div>
      <div><span>Generated</span><strong>${esc(fmtDate(new Date()))}</strong></div>
    </div>
  </header>
  <div class="stats">${stats}</div>
  <section><h2>Data quality</h2>${quality}</section>
  <section><h2>Recent periods</h2><ol class="timeline">${periodItems}</ol></section>
  <section><h2>Symptoms, mood and pain</h2>${checkIns}</section>
  ${notes}
  <footer class="foot"><p>This report summarises information recorded in FemCare+. It is not a medical diagnosis. Please share it with your healthcare professional.</p></footer>
</div></body></html>`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1.5 font-serif text-xl text-ink">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-ink dark:bg-primary-900/40">
          <Icon size={17} strokeWidth={1.75} />
        </span>
        <h2 className="section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ListRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-primary-100 py-2.5 text-sm first:border-t-0 dark:border-neutral-700">
      <span className="text-ink">{label}</span>
      <span className="text-ink-muted">{value}</span>
    </div>
  );
}

export function HealthReportScreen() {
  const { user, profile } = useAuth();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase.from('periods').select('id, start_date, end_date, blood_flow').eq('user_id', user.id).order('start_date', { ascending: true }),
      supabase.from('daily_logs').select('id, log_date, mood, symptoms, pain_level, notes').eq('user_id', user.id).order('log_date', { ascending: true }),
    ]).then(([p, l]) => {
      if (!active) return;
      setPeriods((p.data as PeriodRow[]) || []);
      setLogs((l.data as LogRow[]) || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const s = summarize(periods, logs);
  const name = profile?.name || 'Not provided';
  const hasData = periods.length > 0 || logs.length > 0;

  function download() {
    const html = buildHtml(s, name, includeNotes);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FemCare-Health-Report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const html = buildHtml(s, name, includeNotes).replace(
      '</body>',
      '<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script></body>'
    );
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const win = window.open(url, '_blank');
    if (!win) download();
  }

  if (!hasData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Doctor summary</p>
          <h1 className="mt-1.5 font-serif text-2xl text-ink sm:text-3xl">Health report</h1>
        </header>
        <div className="card flex flex-col items-center p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-300 text-ink dark:bg-accent-600/25">
            <Droplet size={20} strokeWidth={1.75} />
          </span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
            Log a few periods and check-ins to create a summary you can share with your doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Doctor summary</p>
        <h1 className="mt-1.5 font-serif text-2xl text-ink sm:text-3xl">Health report</h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Tile label="Average cycle" value={s.avgCycle ? `${Math.round(s.avgCycle)} days` : 'Not enough data'} />
        <Tile label="Average period" value={s.avgPeriod ? `${Math.round(s.avgPeriod)} days` : 'Not enough data'} />
        <Tile label="Cycles counted" value={String(s.cycleCount)} />
        <Tile label="Last period" value={s.daysSinceLast === null ? '-' : s.daysSinceLast === 0 ? 'Today' : `${s.daysSinceLast} days ago`} />
      </section>

      <Section title="Data quality" icon={ShieldCheck}>
        <p className="text-sm leading-relaxed text-ink-muted">{qualityNote(s)}</p>
      </Section>

      <Section title="Recent periods" icon={CalendarDays}>
        {s.recentPeriods.length === 0 ? (
          <p className="text-sm text-ink-muted">No periods logged yet.</p>
        ) : (
          s.recentPeriods.map((p) => {
            const start = parseLocal(p.start_date);
            const end = p.end_date ? parseLocal(p.end_date) : null;
            return (
              <ListRow
                key={p.id}
                label={fmtDate(start)}
                value={end ? `${daysBetween(start, end) + 1} days` : 'No end date'}
              />
            );
          })
        )}
      </Section>

      <Section title="Symptoms and mood" icon={Activity}>
        {s.topSymptoms.length === 0 && s.topMoods.length === 0 ? (
          <p className="text-sm text-ink-muted">No check-ins logged yet.</p>
        ) : (
          <>
            {s.topSymptoms.map(([k, v]) => <ListRow key={k} label={k} value={`${v} logged`} />)}
            {s.topMoods.map(([k, v]) => <ListRow key={k} label={`Mood: ${k}`} value={`${v} logged`} />)}
            {s.avgPain !== null && (
              <ListRow label="Average pain" value={`${s.avgPain.toFixed(1)} / 10`} />
            )}
          </>
        )}
      </Section>

      {includeNotes && s.recentNotes.length > 0 && (
        <Section title="Recent notes" icon={Droplet}>
          {s.recentNotes.map((n) => (
            <p key={n.id} className="border-t border-primary-100 py-2.5 text-sm text-ink first:border-t-0 dark:border-neutral-700">
              <span className="text-ink-muted">{fmtDate(parseLocal(n.log_date))}: </span>
              {n.notes}
            </p>
          ))}
        </Section>
      )}

      <section className="card p-5 space-y-4">
        <button
          type="button"
          onClick={() => setIncludeNotes((v) => !v)}
          aria-pressed={includeNotes}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-bg-card p-3 text-left ring-1 ring-primary-100"
        >
          <span className="flex items-center gap-2.5 text-sm text-ink">
            <Lock size={16} strokeWidth={1.75} />
            Include private notes
          </span>
          <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${includeNotes ? 'bg-primary-500' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
            <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-neutral-800 ${includeNotes ? 'translate-x-5' : ''}`} />
          </span>
        </button>

        <button onClick={download} className="btn-primary flex w-full items-center justify-center gap-2">
          <Download size={18} strokeWidth={1.75} />
          Download report
        </button>
        <button onClick={printReport} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-100 px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-primary-200 dark:bg-primary-900/40">
          Save as PDF (A4)
        </button>
      </section>

      <p className="text-center text-[11px] leading-snug text-ink-muted">
        Not a medical diagnosis. Share this with your healthcare professional.
      </p>
    </div>
  );
}
