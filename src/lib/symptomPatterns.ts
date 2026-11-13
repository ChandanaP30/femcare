/**
 * Per-user symptom pattern learning.
 *
 * Pure functions. They only see the arrays passed in (one user's own period starts and
 * daily logs), keep no module-level state, and never touch the cycle prediction models
 * (EWMA / hierarchical). The caller passes in the existing predicted "days until next
 * period" as a read-only number.
 */

export interface PeriodRow {
  start_date: string;
  end_date?: string | null;
  duration?: number | null;
}

export interface LogRow {
  log_date: string;
  symptoms: string[] | null;
}

export interface PatternConfig {
  /** Look this many days before each period start. */
  windowDays: number;
  /** Cycles that must have at least one log in the window before anything is learned. */
  minCycles: number;
  /** A symptom must appear in at least this share of those cycles. */
  minCycleShare: number;
  /** Window rate must be at least this multiple of the user's rate on other days. */
  minLift: number;
  minBaselineDays: number;
  maxCycles: number;
  defaultPeriodDays: number;
  /** Recent days compared with the learned pattern. */
  recentDays: number;
  minMatchedSymptoms: number;
  /** Extra days allowed beyond the longest learned lead time. */
  timingSlackDays: number;
  /** An alert needs the existing estimate to put the next period this many days away or fewer. */
  nearDays: number;
  strongMinCycles: number;
  strongMinShare: number;
}

/** Tunable design thresholds. They are not clinical claims. */
export const PATTERN_CONFIG: PatternConfig = {
  windowDays: 5,
  minCycles: 3,
  minCycleShare: 0.6,
  minLift: 1.5,
  minBaselineDays: 5,
  maxCycles: 12,
  defaultPeriodDays: 5,
  recentDays: 3,
  minMatchedSymptoms: 2,
  timingSlackDays: 2,
  nearDays: 3,
  strongMinCycles: 3,
  strongMinShare: 0.75,
};

export interface LearnedSymptom {
  symptom: string;
  cyclesSeen: number;
  cyclesObserved: number;
  /** Median of how many days before the period it first appeared in each cycle. */
  typicalLeadDays: number;
  minLeadDays: number;
  maxLeadDays: number;
  windowRate: number;
  baselineRate: number | null;
  /** Start dates of the periods whose pre-period window contained this symptom. */
  seenInCycles: string[];
}

export interface LearnedCombo {
  symptoms: string[];
  cyclesSeen: number;
  cyclesObserved: number;
}

export interface LearnedPatterns {
  usableCycles: number;
  totalCycles: number;
  enoughHistory: boolean;
  symptoms: LearnedSymptom[];
  combos: LearnedCombo[];
}

export type EvalReason =
  | 'insufficient_history'
  | 'no_pattern'
  | 'no_recent_match'
  | 'single_symptom'
  | 'no_prediction'
  | 'period_overdue'
  | 'period_not_near'
  | 'eligible';

export interface CurrentEvaluation {
  eligible: boolean;
  reason: EvalReason;
  level: 'none' | 'possible' | 'strong';
  matched: LearnedSymptom[];
  combos: LearnedCombo[];
  daysUntilPeriod: number | null;
  usableCycles: number;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function dayNum(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function dayStr(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

const isDate = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

interface Cycle {
  start: number;
  bleedEnd: number;
  startStr: string;
}

function prepareCycles(periods: PeriodRow[], cfg: PatternConfig): Cycle[] {
  const seen = new Set<number>();
  const list: Cycle[] = [];
  for (const p of periods) {
    if (!p || !isDate(p.start_date)) continue;
    const start = dayNum(p.start_date);
    if (seen.has(start)) continue;
    seen.add(start);
    let end = start + Math.max(1, p.duration ?? cfg.defaultPeriodDays) - 1;
    if (isDate(p.end_date)) {
      const e = dayNum(p.end_date);
      if (e >= start) end = e;
    }
    list.push({ start, bleedEnd: end, startStr: dayStr(start) });
  }
  list.sort((a, b) => a.start - b.start);
  return list.slice(-cfg.maxCycles);
}

function indexLogs(logs: LogRow[]) {
  const byDay = new Map<number, Set<string>>();
  const display = new Map<string, string>();
  for (const l of logs) {
    if (!l || !isDate(l.log_date)) continue;
    const n = dayNum(l.log_date);
    let set = byDay.get(n);
    if (!set) {
      set = new Set<string>();
      byDay.set(n, set);
    }
    for (const raw of l.symptoms ?? []) {
      if (typeof raw !== 'string') continue;
      const key = norm(raw);
      if (!key) continue;
      set.add(key);
      if (!display.has(key)) display.set(key, raw.trim());
    }
  }
  return { byDay, display };
}

/** Learns which symptoms this one user repeatedly logs shortly before their own periods. */
export function learnPatterns(periods: PeriodRow[], logs: LogRow[], cfg: PatternConfig = PATTERN_CONFIG): LearnedPatterns {
  const cycles = prepareCycles(periods, cfg);
  const { byDay, display } = indexLogs(logs);

  const windowDaySet = new Set<number>();
  const bleedDaySet = new Set<number>();
  const perCycle: Map<string, number>[] = [];
  const cycleStarts: string[] = [];
  let windowLogDays = 0;
  const windowSymDays = new Map<string, number>();

  cycles.forEach((c, i) => {
    for (let d = c.start; d <= c.bleedEnd; d++) bleedDaySet.add(d);
    const prevEnd = i > 0 ? cycles[i - 1].bleedEnd : -Infinity;
    const found = new Map<string, number>();
    let logged = 0;
    for (let off = 1; off <= cfg.windowDays; off++) {
      const day = c.start - off;
      if (day <= prevEnd) break;
      windowDaySet.add(day);
      const syms = byDay.get(day);
      if (!syms) continue;
      logged++;
      windowLogDays++;
      syms.forEach((s) => {
        windowSymDays.set(s, (windowSymDays.get(s) ?? 0) + 1);
        found.set(s, off); // offsets ascend, so the last write is the earliest appearance
      });
    }
    if (logged > 0) {
      perCycle.push(found);
      cycleStarts.push(c.startStr);
    }
  });

  const lastStart = cycles.length ? cycles[cycles.length - 1].start : -Infinity;
  let baseDays = 0;
  const baseSym = new Map<string, number>();
  byDay.forEach((syms, day) => {
    if (day > lastStart || windowDaySet.has(day) || bleedDaySet.has(day)) return;
    baseDays++;
    syms.forEach((s) => baseSym.set(s, (baseSym.get(s) ?? 0) + 1));
  });

  const usable = perCycle.length;
  const enough = usable >= cfg.minCycles;
  const symptoms: LearnedSymptom[] = [];

  if (enough) {
    const all = new Set<string>();
    perCycle.forEach((m) => m.forEach((_, s) => all.add(s)));
    all.forEach((s) => {
      const offsets: number[] = [];
      perCycle.forEach((m) => {
        const o = m.get(s);
        if (o !== undefined) offsets.push(o);
      });
      const seen = offsets.length;
      if (seen < 2 || seen / usable < cfg.minCycleShare) return;

      const windowRate = (windowSymDays.get(s) ?? 0) / windowLogDays;
      const baselineRate = baseDays >= cfg.minBaselineDays ? (baseSym.get(s) ?? 0) / baseDays : null;
      if (baselineRate !== null && !(windowRate > baselineRate && windowRate >= Math.min(1, baselineRate * cfg.minLift))) return;

      offsets.sort((a, b) => a - b);
      symptoms.push({
        symptom: display.get(s) ?? s,
        cyclesSeen: seen,
        cyclesObserved: usable,
        typicalLeadDays: median(offsets),
        minLeadDays: offsets[0],
        maxLeadDays: offsets[offsets.length - 1],
        windowRate,
        baselineRate,
        seenInCycles: cycleStarts.filter((_, i) => perCycle[i].has(s)),
      });
    });
    symptoms.sort((a, b) => b.cyclesSeen - a.cyclesSeen || a.symptom.localeCompare(b.symptom));
  }

  const combos: LearnedCombo[] = [];
  if (enough && symptoms.length >= 2) {
    const top = symptoms.slice(0, 6);
    const keys = top.map((s) => norm(s.symptom));
    const need = Math.max(2, Math.ceil(cfg.minCycleShare * usable));
    const subsets: number[][] = [];
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        subsets.push([i, j]);
        for (let k = j + 1; k < top.length; k++) subsets.push([i, j, k]);
      }
    }
    for (const idx of subsets) {
      const count = perCycle.filter((m) => idx.every((i) => m.has(keys[i]))).length;
      if (count >= need) combos.push({ symptoms: idx.map((i) => top[i].symptom), cyclesSeen: count, cyclesObserved: usable });
    }
    combos.sort((a, b) => b.symptoms.length - a.symptoms.length || b.cyclesSeen - a.cyclesSeen);
    combos.splice(5);
  }

  return { usableCycles: usable, totalCycles: cycles.length, enoughHistory: enough, symptoms, combos };
}

/**
 * Compares recent logs with the learned pattern. `daysUntilPeriod` is the existing
 * prediction's days-until-next-period, passed in read-only.
 */
export function evaluateCurrent(
  patterns: LearnedPatterns,
  logs: LogRow[],
  today: string,
  daysUntilPeriod: number | null,
  cfg: PatternConfig = PATTERN_CONFIG,
): CurrentEvaluation {
  const make = (reason: EvalReason, matched: LearnedSymptom[] = []): CurrentEvaluation => ({
    eligible: false,
    reason,
    level: 'none',
    matched,
    combos: [],
    daysUntilPeriod,
    usableCycles: patterns.usableCycles,
  });

  if (!patterns.enoughHistory) return make('insufficient_history');
  if (patterns.symptoms.length === 0) return make('no_pattern');

  const t = dayNum(today);
  const { byDay } = indexLogs(logs);
  const recent = new Set<string>();
  for (let d = t - cfg.recentDays + 1; d <= t; d++) byDay.get(d)?.forEach((s) => recent.add(s));

  const matched = patterns.symptoms.filter((s) => recent.has(norm(s.symptom)));
  if (matched.length === 0) return make('no_recent_match');
  if (matched.length < cfg.minMatchedSymptoms) return make('single_symptom', matched);
  if (daysUntilPeriod === null || !Number.isFinite(daysUntilPeriod)) return make('no_prediction', matched);
  if (daysUntilPeriod < 0) return make('period_overdue', matched);

  // Symptoms alone never trigger an alert: the existing estimate must also say the period is near.
  const maxLead = Math.max(...matched.map((m) => m.maxLeadDays));
  const limit = Math.min(maxLead + cfg.timingSlackDays, cfg.nearDays);
  if (daysUntilPeriod > limit) return make('period_not_near', matched);

  const names = new Set(matched.map((m) => norm(m.symptom)));
  const combos = patterns.combos.filter((c) => c.symptoms.every((s) => names.has(norm(s))));
  const strong = combos.some((c) => c.cyclesSeen >= cfg.strongMinCycles && c.cyclesSeen / c.cyclesObserved >= cfg.strongMinShare);

  return {
    eligible: true,
    reason: 'eligible',
    level: strong ? 'strong' : 'possible',
    matched,
    combos,
    daysUntilPeriod,
    usableCycles: patterns.usableCycles,
  };
}

export interface PriorAlert {
  created_at: string;
  matched: string[];
}

/**
 * Repeat prevention. `prior` must be this user's earlier alerts for the same cycle.
 * One alert per cycle by default; with maxPerCycle 2 a second alert needs 2+ days
 * since the first and at least one newly matched symptom.
 */
export function canAlert(prior: PriorAlert[], matchedNow: string[], maxPerCycle: 1 | 2, nowIso: string): boolean {
  if (prior.length === 0) return true;
  if (prior.length >= maxPerCycle) return false;
  const last = Math.max(...prior.map((p) => new Date(p.created_at).getTime()));
  if (new Date(nowIso).getTime() - last < 2 * DAY_MS) return false;
  const before = new Set(prior.flatMap((p) => p.matched.map(norm)));
  return matchedNow.some((s) => !before.has(norm(s)));
}

export interface AlertText {
  title: string;
  /** Shown inside the app. */
  body: string;
  /** Shown in the notification tray: deliberately free of health details. */
  notificationBody: string;
  /** What the user's own logs showed before. */
  observed: string[];
  /** What the existing cycle estimate says. Separate from the observed pattern. */
  predicted: string;
  prep: string[];
  caution: string;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildAlertText(ev: CurrentEvaluation, opts: { prepReminders: boolean }): AlertText {
  const names = ev.matched.map((m) => m.symptom.toLowerCase());
  const observed = ev.matched.map((m) => {
    const lead = m.typicalLeadDays;
    return `${m.symptom}: logged before ${m.cyclesSeen} of your ${m.cyclesObserved} observed periods, usually from about ${plural(lead, 'day')} before.`;
  });
  const d = ev.daysUntilPeriod;
  const when = d === null ? '' : d <= 0 ? 'around today' : d === 1 ? 'tomorrow' : `in about ${d} days`;
  const predicted = d === null
    ? 'No cycle estimate is available yet.'
    : `Your cycle estimate currently puts your next period ${when}. It is an estimate and your symptoms do not confirm it.`;
  const prep = opts.prepReminders
    ? [
        'Keep sanitary pads or your usual period-care products ready.',
        'Keep comfortable clothing ready.',
        'Carry period essentials if you are travelling.',
      ]
    : [];
  const body =
    `Your recent symptoms (${joinList(names)}) are similar to patterns you've experienced before your periods. Your period may be approaching.` +
    (opts.prepReminders ? ' Consider keeping pads and other essentials ready.' : '');
  return {
    title: 'A pattern from your past cycles',
    body,
    notificationBody: 'A gentle heads-up from FemCare+. Open the app to see a pattern from your past cycles.',
    observed,
    predicted,
    prep,
    caution:
      'Symptoms do not prove that your period is coming. If you have very heavy bleeding, severe pain, fainting or fever, do not wait: please see a doctor.',
  };
}
