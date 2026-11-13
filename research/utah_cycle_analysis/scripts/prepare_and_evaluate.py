#!/usr/bin/env python3
"""Clean the Utah CrM menstrual cycle dataset and evaluate next-cycle length models.
Usage: python prepare_and_evaluate.py --data CrMcyclelength_share.csv --out results
Licence: source data CC BY-NC. Derived outputs inherit that restriction.
"""
import argparse, json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

ALPHA = 0.35
PLAUSIBLE = (15, 60)
TEST_FRACTION = 0.20
SEED = 42
BOOT = 500
REQUIRED = ["new_id", "age", "cycle_number", "cycle_start_date",
            "cycle_end_date", "cycle_length", "conception_cycle"]
FEATURES = ["lag1", "lag2", "lag3", "hist_mean", "hist_sd", "n_hist",
            "age", "cycle_number", "gap_before"]
BUCKETS = [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6+", 6, 10**6)]
HGB = dict(max_iter=200, learning_rate=0.05, max_depth=3, min_samples_leaf=40, random_state=SEED)


def clean(raw, report):
    df = raw.copy()
    report.append(f"Rows: {len(df)}; participants: {df['new_id'].nunique()}")
    counts = df.groupby("new_id").size()
    report.append(f"Cycles per participant: min {counts.min()}, median {counts.median():.0f}, max {counts.max()}")
    df["start"] = pd.to_datetime(df["cycle_start_date"], format="%m/%d/%y", errors="coerce")
    df["end"] = pd.to_datetime(df["cycle_end_date"], format="%m/%d/%y", errors="coerce")
    report.append(f"Unparseable start dates: {int(df['start'].isna().sum())}; end dates: {int(df['end'].isna().sum())}")
    report.append(f"Date range: {df['start'].min().date()} to {df['start'].max().date()}")
    report.append(f"Duplicate (new_id, start) rows: {int(df.duplicated(['new_id', 'start']).sum())} (flagged, not removed)")

    df = df.sort_values(["new_id", "start", "cycle_number"]).reset_index(drop=True)
    step = df.groupby("new_id")["cycle_number"].diff()
    report.append(f"cycle_number steps other than +1 within participant: {int(((step != 1) & step.notna()).sum())}")
    dur = (df["end"] - df["start"]).dt.days + 1
    report.append(f"Rows with end before start: {int((dur < 1).sum())}; recorded duration (days): "
                  + str({k: round(v, 1) for k, v in dur.describe().to_dict().items()}))

    conc = df["conception_cycle"].astype(str).str.strip().str.lower()
    report.append("conception_cycle values: " + str(conc.value_counts(dropna=False).to_dict()))
    df["is_conception"] = conc.eq("yes")
    blank = df["cycle_length"].isna()
    report.append(f"Blank cycle_length: {int(blank.sum())}; conception=yes: {int((blank & df['is_conception']).sum())}; other: {int((blank & ~df['is_conception']).sum())}")

    last_rows = df.groupby("new_id").tail(1)
    report.append(f"Conception rows that are the final record of their participant: {int(last_rows['is_conception'].sum())} of {int(df['is_conception'].sum())}")
    report.append(f"Missing age: {int(df['age'].isna().sum())}")

    df["cn_next"] = df.groupby("new_id")["cycle_number"].shift(-1)
    df["gap_after"] = (df["cn_next"] - df["cycle_number"]) > 1
    df["next_start"] = df.groupby("new_id")["start"].shift(-1)
    df["derived_interval"] = (df["next_start"] - df["start"]).dt.days
    report.append(f"Rows followed by a cycle_number gap (cycles missing from file): {int(df['gap_after'].sum())}")
    g = df.loc[df["gap_after"], "derived_interval"]
    report.append(f"Start-to-next-start across gaps: min {g.min()}, median {g.median()}, max {g.max()} days (not single cycle lengths)")

    ok = df["derived_interval"].notna() & df["cycle_length"].notna() & ~df["gap_after"]
    d = df.loc[ok, "derived_interval"] - df.loc[ok, "cycle_length"]
    report.append(f"Gap-free rows comparing provided cycle_length with start-to-next-start: {int(ok.sum())}; identical {int((d == 0).sum())}; "
                  f"differ {int((d != 0).sum())}" + (f" {d[d != 0].value_counts().to_dict()}" if (d != 0).any() else ""))

    df["cycle_len"] = df["cycle_length"].where(~df["is_conception"])
    out = df["cycle_len"].notna() & ~df["cycle_len"].between(*PLAUSIBLE)
    report.append(f"Cycle lengths used for modelling: {int(df['cycle_len'].notna().sum())}; outside {PLAUSIBLE}: {int(out.sum())} (flagged, not removed)")
    report.append("Cycle length summary: " + str({k: round(v, 1) for k, v in df["cycle_len"].describe().to_dict().items()}))
    return df


def build_examples(df):
    recs = []
    for pid, g in df.groupby("new_id", sort=False):
        starts = g["start"].to_numpy()
        cn = g["cycle_number"].to_numpy()
        gap = g["gap_after"].to_numpy()
        L = g["cycle_len"].to_numpy(dtype=float)
        age_vals = g["age"].dropna()
        age0 = float(age_vals.iloc[0]) if len(age_vals) else np.nan
        for k in range(1, len(g)):
            target = L[k]
            if np.isnan(target):
                continue
            prev = L[:k]
            valid_mask = ~np.isnan(prev)
            valid = prev[valid_mask]
            if valid.size == 0:
                continue
            ewma = valid[0]
            for x in valid[1:]:
                ewma = ALPHA * x + (1 - ALPHA) * ewma
            # gap_before: a missing cycle occurs anywhere from the first history cycle up to the target
            gap_before = int(gap[:k].any())
            recs.append({
                "new_id": pid, "target_index": k, "target": target,
                "lag1": valid[-1],
                "lag2": valid[-2] if valid.size >= 2 else np.nan,
                "lag3": valid[-3] if valid.size >= 3 else np.nan,
                "hist_mean": valid.mean(),
                "hist_sd": valid.std(ddof=0) if valid.size >= 2 else np.nan,
                "n_hist": int(valid.size), "age": age0, "cycle_number": cn[k],
                "gap_before": gap_before, "ewma": ewma,
                "unusual_target": int(not (PLAUSIBLE[0] <= target <= PLAUSIBLE[1])),
                "unusual_history": int(any(not (PLAUSIBLE[0] <= x <= PLAUSIBLE[1]) for x in valid)),
            })
    return pd.DataFrame(recs)


def metrics(y, p):
    err = np.asarray(p, dtype=float) - np.asarray(y, dtype=float)
    return {"n": int(len(y)), "MAE": round(float(np.mean(np.abs(err))), 3),
            "RMSE": round(float(np.sqrt(np.mean(err ** 2))), 3)}


def bootstrap_ci(frame, col, rng):
    groups = [gg for _, gg in frame.groupby("new_id")]
    maes = []
    for _ in range(BOOT):
        idx = rng.integers(0, len(groups), len(groups))
        s = pd.concat([groups[i] for i in idx])
        maes.append(np.mean(np.abs(s[col] - s["target"])))
    return [round(float(np.percentile(maes, 2.5)), 3), round(float(np.percentile(maes, 97.5)), 3)]


def fit_hgb(train):
    m = HistGradientBoostingRegressor(**HGB)
    m.fit(train[FEATURES], train["target"])
    return m


def evaluate(train, test, rng):
    model = fit_hgb(train)
    test = test.copy()
    test["pred_last"] = test["lag1"]
    test["pred_ewma"] = test["ewma"]
    test["pred_gbr"] = model.predict(test[FEATURES])
    out = {}
    for name, col in [("last_cycle", "pred_last"), ("ewma", "pred_ewma"), ("gradient_boosting", "pred_gbr")]:
        m = metrics(test["target"], test[col])
        m["MAE_95CI_participant_bootstrap"] = bootstrap_ci(test, col, rng)
        out[name] = m
    return out, test


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="results")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    raw = pd.read_csv(args.data, encoding="utf-8-sig")
    missing = [c for c in REQUIRED if c not in raw.columns]
    if missing:
        raise SystemExit(f"Missing columns: {missing}")

    report = []
    df = clean(raw, report)
    ex = build_examples(df)
    report.append(f"Prediction examples: {len(ex)} from {ex['new_id'].nunique()} participants")
    report.append(f"Examples with unusual target: {int(ex['unusual_target'].sum())}; unusual history: {int(ex['unusual_history'].sum())}; "
                  f"target preceded by a gap: {int(ex['gap_before'].sum())}")
    ex.to_csv(out / "prepared_examples.csv", index=False)

    ids = np.array(sorted(ex["new_id"].unique())); rng.shuffle(ids)
    n_test = max(1, int(round(len(ids) * TEST_FRACTION)))
    test_ids = set(ids[:n_test])
    tr = ex[~ex["new_id"].isin(test_ids)]
    te = ex[ex["new_id"].isin(test_ids)]

    results = {}
    res, te_pred = evaluate(tr, te, rng)
    results["participant_split"] = {**res, "train_participants": int(tr["new_id"].nunique()),
                                    "test_participants": int(te["new_id"].nunique())}

    last_idx = ex.sort_values("target_index").groupby("new_id").tail(1).index
    res_c, _ = evaluate(ex.drop(index=last_idx), ex.loc[last_idx], rng)
    results["chronological_split"] = {**res_c, "test_participants": int(len(last_idx))}

    variants = {"all": te,
                "exclude_unusual": te[(te["unusual_target"] == 0) & (te["unusual_history"] == 0)],
                "exclude_gap_before": te[te["gap_before"] == 0]}
    results["sensitivity"] = {name: evaluate(tr, frame, rng)[0] for name, frame in variants.items() if len(frame)}

    rows = []
    for label, lo, hi in BUCKETS:
        sub = te_pred[(te_pred["n_hist"] >= lo) & (te_pred["n_hist"] <= hi)]
        for name, col in [("last_cycle", "pred_last"), ("ewma", "pred_ewma"), ("gradient_boosting", "pred_gbr")]:
            rows.append({"history": label, "method": name, **(metrics(sub["target"], sub[col]) if len(sub) else {"n": 0})})
    pd.DataFrame(rows).to_csv(out / "evaluation_by_history.csv", index=False)

    final = fit_hgb(ex)
    joblib.dump({"model": final, "features": FEATURES, "licence": "CC BY-NC (source data)",
                 "warning": "Research prototype. Not clinically validated."}, out / "model.joblib")
    (out / "cleaning_report.md").write_text("# Cleaning report\n\n" + "\n".join(f"- {r}" for r in report) + "\n", encoding="utf-8")
    (out / "evaluation.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
