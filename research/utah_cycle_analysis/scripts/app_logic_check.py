#!/usr/bin/env python3
"""Evaluate the FemCare+ app's prediction logic on the Utah dataset.
Reproduces buildPredictionModel as implemented in src/lib/cycle.ts:
 - history = intervals between consecutive logged period starts, kept if 15 <= L <= 60
 - EWMA (alpha 0.35, oldest to newest) when >= 2 valid intervals; single value if 1
 - linear-regression slope; correction = clamp(0.3 * slope, -2, +2)
 - result rounded and clamped to 21..45; fallback 28 days when no valid history
Target = provided cycle_length of the next cycle (non-conception rows).
No fitting is done, so there is no training leakage; the same 20% participants
used in the earlier model comparison are reported separately for comparison.
"""
import sys, json
from pathlib import Path
import numpy as np, pandas as pd

ALPHA, PRED_MIN, PRED_MAX = 0.35, 15, 60
CLAMP = (21, 45)
TREND_CAP = 2.0
FALLBACK = 28
SEED, TEST_FRACTION, BOOT = 42, 0.20, 500

def ewma(vals, alpha):
    e = vals[0]
    for x in vals[1:]:
        e = alpha * x + (1 - alpha) * e
    return e

def slope(vals):
    n = len(vals)
    if n < 2: return 0.0
    xm = (n - 1) / 2; ym = sum(vals) / n
    num = sum((i - xm) * (v - ym) for i, v in enumerate(vals))
    den = sum((i - xm) ** 2 for i in range(n))
    return 0.0 if den == 0 else num / den

def app_predict(hist):
    if len(hist) >= 2:
        p = ewma(hist, ALPHA)
        s = slope(hist)
        p += max(-TREND_CAP, min(TREND_CAP, 0.3 * s))
    elif len(hist) == 1:
        p = hist[0]
    else:
        return FALLBACK, True
    return int(round(min(CLAMP[1], max(CLAMP[0], p)))), False

def main(data, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(data, encoding="utf-8-sig")
    raw["start"] = pd.to_datetime(raw["cycle_start_date"], format="%m/%d/%y")
    raw["conc"] = raw["conception_cycle"].astype(str).str.strip().str.lower().eq("yes")
    raw = raw.sort_values(["new_id", "start", "cycle_number"]).reset_index(drop=True)

    recs = []
    for pid, g in raw.groupby("new_id", sort=False):
        starts = g["start"].to_numpy()
        prov = g["cycle_length"].to_numpy(dtype=float)
        conc = g["conc"].to_numpy()
        # app-visible intervals: between consecutive logged starts (app keeps 0 < L < 90)
        app_int = [int((starts[i + 1] - starts[i]) / np.timedelta64(1, "D")) for i in range(len(g) - 1)]
        for k in range(1, len(g)):
            if np.isnan(prov[k]) or conc[k]:
                continue
            # intervals fully known before the target cycle starts: indices 0..k-1 (interval k-1 ends at start_k)
            hist = [x for x in app_int[:k] if 0 < x < 90 and PRED_MIN <= x <= PRED_MAX]
            pred, fallback = app_predict(hist)
            recs.append({"new_id": pid, "k": k, "target": prov[k], "pred_app": pred,
                         "fallback": fallback, "n_hist": len(hist),
                         "last_naive": hist[-1] if hist else FALLBACK})
    ev = pd.DataFrame(recs)
    ev["err"] = ev["pred_app"] - ev["target"]

    rng = np.random.default_rng(SEED)
    ids = np.array(sorted(ev["new_id"].unique())); rng.shuffle(ids)
    test_ids = set(ids[: int(round(len(ids) * TEST_FRACTION))])
    te = ev[ev["new_id"].isin(test_ids)]

    def m(frame, col="err"):
        e = frame[col].to_numpy(dtype=float)
        ci = None
        if frame["new_id"].nunique() > 1:
            groups = [g for _, g in frame.groupby("new_id")]
            maes = []
            for _ in range(BOOT):
                idx = rng.integers(0, len(groups), len(groups))
                s = pd.concat([groups[i] for i in idx])
                maes.append(np.mean(np.abs(s[col])))
            ci = [round(float(np.percentile(maes, 2.5)), 3), round(float(np.percentile(maes, 97.5)), 3)]
        return {"n": int(len(frame)), "MAE": round(float(np.mean(np.abs(e))), 3),
                "RMSE": round(float(np.sqrt(np.mean(e ** 2))), 3), "MAE_95CI": ci}

    res = {"all_examples": m(ev), "test_participants_20pct": m(te),
           "fallback_to_28_days": int(ev["fallback"].sum()),
           "by_history": {}}
    ev["err_naive"] = ev["last_naive"] - ev["target"]
    for label, lo, hi in [("0 (fallback)", 0, 0), ("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6+", 6, 10**6)]:
        sub = ev[(ev["n_hist"] >= lo) & (ev["n_hist"] <= hi)]
        if len(sub):
            res["by_history"][label] = {"app": m(sub), "last_cycle": m(sub, "err_naive")}
    ev.to_csv(out / "app_logic_examples.csv", index=False)
    (out / "app_logic_evaluation.json").write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "app_results")
