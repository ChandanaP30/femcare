#!/usr/bin/env python3
"""Grouped, repeated 5-fold cross-validation comparing next-cycle length methods.

Methods (identical folds, identical inputs):
  last_cycle        : previous cycle length
  app_ewma          : the app's method - EWMA (alpha 0.35), trend correction capped at +/-2 days,
                      clamp 21-45 days, fallback 28 days (mirrors buildPredictionModel)
  ridge             : Ridge regression on the same features (learned, linear)
  gradient_boosting : HistGradientBoostingRegressor on the same features (learned, non-linear)

Leakage control: folds split PARTICIPANTS, so no person appears in both training and test
data within a fold. Features use only cycles before the target. Models are fitted inside each
training fold only.

Reuses clean(), build_examples(), FEATURES, HGB, ALPHA, PLAUSIBLE from prepare_and_evaluate.py.
Usage: python cv_compare.py --data ../CrMcyclelength_share.csv --out cv_results
"""
import argparse, json, sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_and_evaluate import clean, build_examples, FEATURES, HGB, ALPHA  # reused, not copied

SEEDS = [11, 22, 33]
N_FOLDS = 5
BOOT = 2000
BOOT_SEED = 2024
MEANINGFUL_DAYS = 0.25          # practical threshold: differences below this are not meaningful
APP_CLAMP = (21, 45)
APP_TREND_CAP = 2.0
APP_FALLBACK = 28
METHODS = ["last_cycle", "app_ewma", "ridge", "gradient_boosting"]


def history_lookup(df):
    """Valid cycle-length history before each target, keyed by (new_id, target_index).
    Mirrors build_examples: a target is the cycle at index k, history is cycles 0..k-1 with
    gaps (NaN cycle_len) removed. Used only by the app-method baseline."""
    out = {}
    for pid, g in df.groupby("new_id", sort=False):
        L = g["cycle_len"].to_numpy(dtype=float)
        for k in range(1, len(g)):
            if np.isnan(L[k]):
                continue
            prev = L[:k]
            valid = prev[~np.isnan(prev)]
            if valid.size:
                out[(pid, k)] = valid.tolist()
    return out


def ewma(vals, alpha=ALPHA):
    e = vals[0]
    for x in vals[1:]:
        e = alpha * x + (1 - alpha) * e
    return e


def slope(vals):
    n = len(vals)
    if n < 2:
        return 0.0
    xm = (n - 1) / 2
    ym = sum(vals) / n
    den = sum((i - xm) ** 2 for i in range(n))
    return sum((i - xm) * (v - ym) for i, v in enumerate(vals)) / den


def app_predict(hist):
    if len(hist) >= 2:
        p = ewma(hist) + max(-APP_TREND_CAP, min(APP_TREND_CAP, 0.3 * slope(hist)))
    elif len(hist) == 1:
        p = hist[0]
    else:
        p = APP_FALLBACK
    return float(min(APP_CLAMP[1], max(APP_CLAMP[0], round(p))))


def make_folds(ids, seed):
    rng = np.random.default_rng(seed)
    perm = rng.permutation(ids)
    return [set(perm[i::N_FOLDS]) for i in range(N_FOLDS)]


def ridge_model():
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=1.0))


def fit_predict_all(tr, te, hist_map):
    """Fit learned models on the training fold only; score every method on the test fold."""
    X_tr, y_tr = tr[FEATURES], tr["target"].to_numpy()
    X_te = te[FEATURES]
    ridge = ridge_model().fit(X_tr, y_tr)
    gbr = HistGradientBoostingRegressor(**HGB).fit(X_tr, y_tr)
    app = np.array([app_predict(hist_map[(p, k)]) for p, k in zip(te["new_id"], te["target_index"])])
    return {
        "last_cycle": te["lag1"].to_numpy(dtype=float),
        "app_ewma": app,
        "ridge": ridge.predict(X_te),
        "gradient_boosting": gbr.predict(X_te),
    }


def participant_bootstrap(values, groups, rng, boot=BOOT):
    """Mean of per-example values, resampling participants (not examples), with percentile CI."""
    uniq, inv = np.unique(groups, return_inverse=True)
    sums = np.bincount(inv, weights=values, minlength=len(uniq))
    cnts = np.bincount(inv, minlength=len(uniq)).astype(float)
    point = sums.sum() / cnts.sum()
    draws = np.empty(boot)
    for b in range(boot):
        idx = rng.integers(0, len(uniq), len(uniq))
        draws[b] = sums[idx].sum() / cnts[idx].sum()
    return float(point), float(np.percentile(draws, 2.5)), float(np.percentile(draws, 97.5))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="cv_results")
    ap.add_argument("--prepared", default=None, help="prepared_examples.csv from prepare_and_evaluate.py, for the count check")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(args.data, encoding="utf-8-sig")
    report = []
    df = clean(raw, report)
    ex = build_examples(df).reset_index(drop=True)
    hist_map = history_lookup(df)

    # Consistency checks: the history used by the app method must match the feature table
    n_check = np.array([len(hist_map[(p, k)]) for p, k in zip(ex["new_id"], ex["target_index"])])
    assert (n_check == ex["n_hist"].to_numpy()).all(), "history length does not match n_hist"
    prepared = Path(args.prepared) if args.prepared else None
    if prepared is not None:
        ref = pd.read_csv(prepared)
        assert len(ref) == len(ex), f"example count differs from prepare run: {len(ref)} vs {len(ex)}"

    ids = np.array(sorted(ex["new_id"].unique()))
    fold_rows = []
    per_seed_mae = {m: [] for m in METHODS}
    per_seed_rmse = {m: [] for m in METHODS}
    abs_err_sum = {m: np.zeros(len(ex)) for m in METHODS}   # summed over seeds, per example

    for seed in SEEDS:
        folds = make_folds(ids, seed)
        oof = {m: np.full(len(ex), np.nan) for m in METHODS}
        for k, test_ids in enumerate(folds):
            te_mask = ex["new_id"].isin(test_ids).to_numpy()
            tr, te = ex[~te_mask], ex[te_mask]
            preds = fit_predict_all(tr, te, hist_map)
            for m in METHODS:
                oof[m][te_mask] = preds[m]
                err = preds[m] - te["target"].to_numpy()
                fold_rows.append({"seed": seed, "fold": k, "method": m, "n_test": len(te),
                                  "MAE": float(np.mean(np.abs(err))),
                                  "RMSE": float(np.sqrt(np.mean(err ** 2)))})
        y = ex["target"].to_numpy()
        for m in METHODS:
            assert not np.isnan(oof[m]).any(), "every example must be predicted once per seed"
            e = oof[m] - y
            per_seed_mae[m].append(float(np.mean(np.abs(e))))
            per_seed_rmse[m].append(float(np.sqrt(np.mean(e ** 2))))
            abs_err_sum[m] += np.abs(e)

    folds_df = pd.DataFrame(fold_rows)
    folds_df.to_csv(out / "cv_fold_results.csv", index=False)

    # Per-example mean absolute error across seeds, used for bootstrap and paired comparisons
    mean_abs = {m: abs_err_sum[m] / len(SEEDS) for m in METHODS}
    groups = ex["new_id"].to_numpy()
    rng = np.random.default_rng(BOOT_SEED)

    summary = []
    for m in METHODS:
        pt, lo, hi = participant_bootstrap(mean_abs[m], groups, rng)
        fm = folds_df[folds_df["method"] == m]
        summary.append({
            "method": m,
            "MAE_mean_over_seeds": round(float(np.mean(per_seed_mae[m])), 3),
            "MAE_sd_over_seeds": round(float(np.std(per_seed_mae[m], ddof=1)), 3),
            "RMSE_mean_over_seeds": round(float(np.mean(per_seed_rmse[m])), 3),
            "RMSE_sd_over_seeds": round(float(np.std(per_seed_rmse[m], ddof=1)), 3),
            "MAE_fold_mean": round(float(fm["MAE"].mean()), 3),
            "MAE_fold_sd": round(float(fm["MAE"].std(ddof=1)), 3),
            "MAE_bootstrap_point": round(pt, 3),
            "MAE_CI95_low": round(lo, 3),
            "MAE_CI95_high": round(hi, 3),
            "n_examples": len(ex),
        })
    summary_df = pd.DataFrame(summary).sort_values("MAE_mean_over_seeds").reset_index(drop=True)
    summary_df.to_csv(out / "cv_summary.csv", index=False)

    pairs = [("gradient_boosting", "app_ewma"), ("ridge", "app_ewma"), ("gradient_boosting", "ridge"),
             ("app_ewma", "last_cycle"), ("gradient_boosting", "last_cycle"), ("ridge", "last_cycle")]
    paired = []
    for a, b in pairs:
        d = mean_abs[a] - mean_abs[b]          # negative = a is better
        pt, lo, hi = participant_bootstrap(d, groups, rng)
        excludes_zero = (lo > 0) or (hi < 0)
        meaningful = excludes_zero and abs(pt) >= MEANINGFUL_DAYS
        paired.append({
            "method_A": a, "method_B": b,
            "MAE_diff_A_minus_B": round(pt, 3),
            "CI95_low": round(lo, 3), "CI95_high": round(hi, 3),
            "CI_excludes_zero": excludes_zero,
            "meets_practical_threshold": abs(pt) >= MEANINGFUL_DAYS,
            "meaningful": meaningful,
            "better": a if pt < 0 else b,
        })
    paired_df = pd.DataFrame(paired)
    paired_df.to_csv(out / "cv_paired_differences.csv", index=False)

    hist_rows = []
    buckets = [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6+", 6, 10 ** 6)]
    for label, lo_n, hi_n in buckets:
        sel = ((ex["n_hist"] >= lo_n) & (ex["n_hist"] <= hi_n)).to_numpy()
        for m in METHODS:
            if sel.sum():
                hist_rows.append({"history_cycles": label, "method": m, "n": int(sel.sum()),
                                  "MAE": round(float(mean_abs[m][sel].mean()), 3)})
    pd.DataFrame(hist_rows).to_csv(out / "cv_by_history.csv", index=False)

    best = summary_df.iloc[0]["method"]
    app_row = paired_df[(paired_df.method_A == best) & (paired_df.method_B == "app_ewma")]
    lines = [
        "# Cross-validation summary", "",
        f"Examples: {len(ex)} from {len(ids)} participants. Folds: {N_FOLDS} grouped by participant, seeds {SEEDS}.",
        f"Bootstrap: {BOOT} resamples of participants. Practical threshold: {MEANINGFUL_DAYS} days.", "",
        "## Methods (MAE in days, mean over seeds; CI = participant bootstrap)", "",
        summary_df[["method", "MAE_mean_over_seeds", "MAE_sd_over_seeds", "RMSE_mean_over_seeds",
                    "MAE_CI95_low", "MAE_CI95_high"]].to_markdown(index=False), "",
        "## Paired differences (A minus B; negative means A is better)", "",
        paired_df[["method_A", "method_B", "MAE_diff_A_minus_B", "CI95_low", "CI95_high", "meaningful"]].to_markdown(index=False), "",
        f"Best by mean MAE: **{best}**.",
    ]
    if len(app_row):
        r = app_row.iloc[0]
        lines.append(f"Versus the app method: difference {r.MAE_diff_A_minus_B} days, "
                     f"CI [{r.CI95_low}, {r.CI95_high}], meaningful: {bool(r.meaningful)}.")
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("\n".join(report[:3]))
    print(summary_df.to_string(index=False))
    print(paired_df.to_string(index=False))
    print(f"\nWritten to {out.resolve()}")


if __name__ == "__main__":
    main()
