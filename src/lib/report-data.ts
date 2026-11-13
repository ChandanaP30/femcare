import type { ReportKey } from './report-i18n';

export interface ReportPeriod { start_date: string; end_date: string | null; blood_flow?: string | null }
export interface ReportLog { log_date: string; mood: string | null; symptoms: string[] | null; pain_level: number | null; notes: string | null }
export interface ReportInsight { key: ReportKey; params: Record<string, string | number> }
export type LabelFn = (raw: string) => string;

export interface ReportData {
  periodsLogged: number;
  logsLogged: number;
  cycleStats: { avg: number | null; min: number | null; max: number | null; n: number };
  durationStats: { avg: number | null; n: number };
  lastPeriod: { start: string; daysAgo: number } | null;
  quality: { status: 'ok' | 'review' | 'insufficient'; key: ReportKey; params: Record<string, string | number>; missingEnd: number };
  timeline: { start: string; end: string | null; duration: number | null }[];
  symptoms: { label: string; count: number }[];
  moods: { label: string; count: number }[];
  pain: { avg: number | null; n: number; high: number; recent: number[] };
  trend: { enough: boolean; columns: string[]; rows: { cycle: number; counts: number[] }[] };
  insights: ReportInsight[];
  notes: { date: string; text: string }[];
}

const DAY = 86400000;
const toDate = (s: string): Date => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY);
const round1 = (x: number): number => Math.round(x * 10) / 10;
const avgOf = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pctOf = (count: number, total: number): number => Math.round((count / total) * 100);
const rank = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export function buildReportData(periods: ReportPeriod[], logs: ReportLog[], labelFor: LabelFn, today: Date): ReportData {
  const sortedPeriods = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const sortedLogs = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const starts = sortedPeriods.map((p) => toDate(p.start_date));

  // Cycle lengths between consecutive period starts. Lengths outside 15-60 days are counted as gaps, not cycles.
  const cycleLengths: number[] = [];
  let cycleGaps = 0;
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i - 1], starts[i]);
    if (len >= 15 && len <= 60) cycleLengths.push(len); else cycleGaps++;
  }
  const cycleStats = {
    avg: cycleLengths.length ? round1(avgOf(cycleLengths) as number) : null,
    min: cycleLengths.length ? Math.min(...cycleLengths) : null,
    max: cycleLengths.length ? Math.max(...cycleLengths) : null,
    n: cycleLengths.length,
  };

  const durations: number[] = [];
  for (const p of sortedPeriods) {
    if (!p.end_date) continue;
    const d = diffDays(toDate(p.start_date), toDate(p.end_date)) + 1;
    if (d >= 1 && d <= 10) durations.push(d);
  }
  const durationStats = { avg: durations.length ? round1(avgOf(durations) as number) : null, n: durations.length };

  const lastStart = starts.length ? starts[starts.length - 1] : null;
  const lastPeriod = lastStart ? { start: sortedPeriods[sortedPeriods.length - 1].start_date, daysAgo: diffDays(lastStart, startOfDay(today)) } : null;

  const missingEnd = sortedPeriods.filter((p) => !p.end_date).length;
  let quality: ReportData['quality'];
  if (sortedPeriods.length < 3) quality = { status: 'insufficient', key: 'qualityMinPeriods', params: {}, missingEnd };
  else if (cycleGaps > 0) quality = { status: 'review', key: 'qualityGaps', params: { n: cycleGaps }, missingEnd };
  else if (missingEnd > 0) quality = { status: 'review', key: 'qualityNoEnd', params: { n: missingEnd }, missingEnd };
  else quality = { status: 'ok', key: 'qualityComplete', params: {}, missingEnd };

  const timeline = sortedPeriods.slice(-6).map((p) => ({
    start: p.start_date,
    end: p.end_date,
    duration: p.end_date ? diffDays(toDate(p.start_date), toDate(p.end_date)) + 1 : null,
  }));

  // Symptoms: each log counts once per symptom it lists.
  const symRaw = new Map<string, number>();
  for (const l of sortedLogs) for (const s of new Set(l.symptoms ?? [])) symRaw.set(s, (symRaw.get(s) ?? 0) + 1);
  const rankedSym = rank(symRaw);
  const symptoms = rankedSym.slice(0, 6).map(([raw, count]) => ({ label: labelFor(raw), count }));
  const logsWithSymptoms = sortedLogs.filter((l) => (l.symptoms ?? []).length > 0);

  const moodRaw = new Map<string, number>();
  for (const l of sortedLogs) if (l.mood) moodRaw.set(l.mood, (moodRaw.get(l.mood) ?? 0) + 1);
  const rankedMood = rank(moodRaw);
  const moodTotal = rankedMood.reduce((a, [, c]) => a + c, 0);
  const moods = rankedMood.slice(0, 5).map(([raw, count]) => ({ label: labelFor(raw), count }));

  const painVals = sortedLogs.filter((l) => (l.pain_level ?? 0) > 0).map((l) => l.pain_level as number);
  const pain = {
    avg: painVals.length ? round1(avgOf(painVals) as number) : null,
    n: painVals.length,
    high: painVals.filter((v) => v >= 7).length,
    recent: painVals.slice(-12),
  };

  // Symptoms by cycle: cycle k is the period that started k-th. Only logs after the first period count.
  const topRaw = rankedSym.slice(0, 4).map(([raw]) => raw);
  const perCycle = new Map<number, Map<string, number>>();
  for (const l of logsWithSymptoms) {
    const idx = starts.filter((s) => s.getTime() <= toDate(l.log_date).getTime()).length;
    if (idx === 0) continue;
    let m = perCycle.get(idx);
    if (!m) { m = new Map(); perCycle.set(idx, m); }
    for (const s of new Set(l.symptoms ?? [])) m.set(s, (m.get(s) ?? 0) + 1);
  }
  const cycleKeys = [...perCycle.keys()].sort((a, b) => a - b);
  const enough = cycleKeys.length >= 2 && topRaw.length > 0;
  const trend = {
    enough,
    columns: topRaw.map((r) => labelFor(r)),
    rows: enough
      ? cycleKeys.slice(-8).map((k) => ({ cycle: k, counts: topRaw.map((r) => perCycle.get(k)?.get(r) ?? 0) }))
      : [],
  };

  // Insights: each one needs enough recorded entries. Nothing is generated otherwise.
  const insights: ReportInsight[] = [];
  const top = rankedSym[0];
  if (logsWithSymptoms.length >= 3 && top && top[1] >= 2) {
    insights.push({ key: 'insMost', params: { symptom: labelFor(top[0]), count: top[1], total: sortedLogs.length, pct: pctOf(top[1], sortedLogs.length) } });
  }
  const inPeriod = (iso: string): boolean => sortedPeriods.some((p) => p.end_date !== null && iso >= p.start_date && iso <= p.end_date);
  const periodLogs = sortedLogs.filter((l) => inPeriod(l.log_date));
  const periodRaw = new Map<string, number>();
  for (const l of periodLogs) for (const s of new Set(l.symptoms ?? [])) periodRaw.set(s, (periodRaw.get(s) ?? 0) + 1);
  const pTop = rank(periodRaw)[0];
  if (periodLogs.length >= 3 && pTop && pTop[1] >= 2) {
    insights.push({ key: 'insPeriodMatch', params: { symptom: labelFor(pTop[0]), count: pTop[1], total: periodLogs.length } });
  }
  if (pain.n >= 3) {
    if (pain.high >= 1) insights.push({ key: 'insPainHigh', params: { days: pain.high, total: pain.n, avg: pain.avg as number } });
    else insights.push({ key: 'insPainLow', params: { avg: pain.avg as number, total: pain.n } });
  }
  if (cycleStats.n >= 3) {
    const range = (cycleStats.max as number) - (cycleStats.min as number);
    const p = { n: cycleStats.n, avg: cycleStats.avg as number, min: cycleStats.min as number, max: cycleStats.max as number };
    insights.push({ key: range <= 7 ? 'insCycleSteady' : 'insCycleVaries', params: p });
  }
  if (moodTotal >= 3 && moods[0] && moods[0].count >= 2) {
    insights.push({ key: 'insMoodTop', params: { mood: moods[0].label, count: moods[0].count, total: moodTotal } });
  }
  const notes = sortedLogs.filter((l) => (l.notes ?? '').trim()).map((l) => ({ date: l.log_date, text: (l.notes as string).trim() }));
  if (notes.length >= 1) insights.push({ key: 'insNotes', params: { n: notes.length } });

  return {
    periodsLogged: sortedPeriods.length,
    logsLogged: sortedLogs.length,
    cycleStats,
    durationStats,
    lastPeriod,
    quality,
    timeline,
    symptoms,
    moods,
    pain,
    trend,
    insights,
    notes,
  };
}