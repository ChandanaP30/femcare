// Hierarchical normal-normal cycle-length model (TypeScript port of ml/cycle-model.js).
// Trained on SYNTHETIC data only. Not clinically validated. Not a contraceptive or fertility tool.

export interface ModelParams {
  mu0: number;
  tau: number;
  sigma: number;
}

export interface CyclePrediction {
  meanDays: number;
  sdDays: number;
  interval80: [number, number];
  interval95: [number, number];
  historyLength: number;
}

const Z80 = 1.2815515655446004;
const Z95 = 1.959963984540054;
const MIN_VALID_CYCLE = 15;
const MAX_VALID_CYCLE = 60;
const PLAUSIBLE_RANGE: [number, number] = [21, 45];
const DAY_MS = 86400000;

const round = (v: number, d: number) => {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
};

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

/** Days between consecutive period start dates, keeping only plausible gaps. */
export function cycleLengthsFromStarts(startDates: string[]): number[] {
  const days = startDates
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const lengths: number[] = [];
  for (let i = 1; i < days.length; i++) {
    const L = Math.round((days[i].getTime() - days[i - 1].getTime()) / DAY_MS);
    if (L >= MIN_VALID_CYCLE && L <= MAX_VALID_CYCLE) lengths.push(L);
  }
  return lengths;
}

/** Posterior predictive for the next cycle length given the person's history. */
export function predictCycle(params: ModelParams, history: number[]): CyclePrediction {
  const { mu0, tau, sigma } = params;
  const n = history.length;
  let postMean: number;
  let postVar: number;
  if (n === 0) {
    postMean = mu0;
    postVar = tau * tau;
  } else {
    const xbar = history.reduce((a, b) => a + b, 0) / n;
    postVar = 1 / (1 / (tau * tau) + n / (sigma * sigma));
    postMean = postVar * (mu0 / (tau * tau) + (n * xbar) / (sigma * sigma));
  }
  const predSd = Math.sqrt(postVar + sigma * sigma);
  const m = clamp(postMean, PLAUSIBLE_RANGE);
  return {
    meanDays: round(m, 1),
    sdDays: round(predSd, 2),
    interval80: [round(m - Z80 * predSd, 1), round(m + Z80 * predSd, 1)],
    interval95: [round(m - Z95 * predSd, 1), round(m + Z95 * predSd, 1)],
    historyLength: n,
  };
}

/** Existing rule: repeat the last cycle length, else the profile default. */
export function ruleBaseline(history: number[], profileCycleLength = 28): number {
  return history.length ? history[history.length - 1] : profileCycleLength;
}

/** Add predicted days to the last period start to get calendar dates. */
export function estimateDates(lastStart: Date, pred: CyclePrediction) {
  const add = (d: number) => new Date(lastStart.getTime() + d * DAY_MS);
  return {
    point: add(Math.round(pred.meanDays)),
    range80: [add(Math.floor(pred.interval80[0])), add(Math.ceil(pred.interval80[1]))] as [Date, Date],
    range95: [add(Math.floor(pred.interval95[0])), add(Math.ceil(pred.interval95[1]))] as [Date, Date],
  };
}