# Research paper revision audit (for another AI; do not rewrite the paper from this alone)

Scope: FemCare+ app source (as pasted in the conversation), the Utah analysis folder, and the synthetic
"experimental" model files. Each fact is tagged:
- **[VERIFIED-FILE]** read from a file or a command output in this session
- **[VERIFIED-PASTE]** from text the user pasted from their own project in this conversation; not re-read in this session
- **[UNVERIFIED]** not checked; do not state as fact

Do not claim ML is integrated into the app. Do not claim any ML model outperforms the app's EWMA.

## 1. App architecture and implemented features

- Stack: React 18 + TypeScript + Vite; Tailwind; Capacitor 8 for Android; Supabase (Auth, PostgreSQL with
  Row Level Security, Edge Functions). [VERIFIED-PASTE: package.json, supabase/ listing]
- Data tables from the schema migration: profiles, periods, symptoms, chat_history, emergency_contacts,
  user_settings, prediction_audit (the migration creates them). [VERIFIED-FILE: migration listing]
- Live app tables also include chat_messages, daily_logs, period_day_logs, which are not in the migrations
  reviewed. [VERIFIED-PASTE: policy listing]. The app's code uses daily_logs and chat_history.
- Features: sign-up/sign-in, onboarding, period logging, calendar, symptom/mood/pain check-in, insights,
  health education (8 articles; only "Understanding Your Menstrual Cycle" translated in Hindi and Kannada),
  AI assistant via Supabase Edge Function `chat-assistant` (Groq-hosted model), SOS and emergency contacts,
  OpenStreetMap/Overpass locator, period-leave guide, Android local reminders, health report (HTML download
  and print-to-PDF), passphrase gate (PBKDF2 key, no field-level encryption). [VERIFIED-PASTE: screens and
  notes in conversation]
- Languages: English, Hindi, Kannada, via a translation file with a fallback to English. [VERIFIED-PASTE]
- Tests: 230 passed across 12 test files in the most recent reported run. [VERIFIED-PASTE]
- Type check (tsconfig.app.json): clean after removing the unused `src/features` folder and
  `src/lib/prediction.ts` (backed up to `legacy-backup-20261105-0838`). [VERIFIED-PASTE]
- Build: `vite build` passes. The chunk-size warning (>500 kB) is still present. [VERIFIED-PASTE]

## 2. Current EWMA prediction algorithm (the live method)

Source: `src/lib/cycle.ts`, `buildPredictionModel`. [VERIFIED-PASTE: grep lines and code excerpts]

1. Intervals from consecutive logged period starts: kept if 0 < L < 90 days. (`extractCycleIntervals`)
2. For prediction, cycle lengths kept only if 15 ≤ L ≤ 60. Period durations kept if 1 ≤ D ≤ 10.
3. With ≥2 valid cycles: EWMA with α = 0.35, updated oldest to newest:
   `ewa = alpha*x + (1-alpha)*ewa`, starting from the first value.
4. Trend: least-squares slope over the cycle sequence. Labels shortening (< -0.5), lengthening (> 0.5).
   Correction = `slope * 0.3`, capped to ±2 days. [VERIFIED-PASTE: MAX_TREND_ADJUST = 2 at line 135,
   applied at line 159]
5. Rounded and clamped to 21–45 days. With 1 valid cycle: that cycle. With 0: profile `cycle_length` or 28.
6. Period duration: EWMA α = 0.4 over valid durations, clamped to 2–10; with 0 valid, profile or 5.
7. Regularity: 100 − (SD/7)·100 clamped to 0–100 (≥3 cycles); two cycles use their difference; otherwise 50.
8. Confidence = round(0.6·Q + 0.4·regularity), Q = min(100, 100n/6), with Q = 15 for n = 0 and 35 for n = 1.
   Confidence is data quality, not clinical certainty.
9. Ovulation = last start + max(1, cycle length − 14). Fertile window = ovulation −4 to +1 days.
10. Next period: rolls forward when the expected start has passed without a log (`locateCycle`).

Note: the Utah comparisons use the provided cycle lengths as history for all methods (see §5).
The app's real input is logged start dates, so a separate check (`app_logic_check.py`) uses start-derived
intervals. Keep these two inputs apart when reporting.

## 3. Experimental hierarchical model (not integrated into the calendar or reminders)

- Source: `src/lib/cycleModel.ts` and `src/lib/cycleModelParams.ts`, shown on Home through
  `MLCyclePrediction.tsx` as an "Experimental" card. Restored and confirmed in the browser by the user.
  [VERIFIED-PASTE]
- Model: person mean m_i ~ N(μ0, τ²); cycle x_ij | m_i ~ N(m_i, σ²). Posterior variance
  v = (1/τ² + n/σ²)⁻¹; posterior mean = v(μ0/τ² + n·x̄/σ²); predictive N(post mean, v + σ²). Mean clamped to 21–45.
- Parameters (fitted on synthetic data): μ0 = 29.035, τ = 2.5, σ = 2.5. Source: `ml/model-params.json`.
  [VERIFIED-FILE in sandbox outputs/ml; the user's project folder has no `ml/` folder per their listing]
- Training data: synthetic cohort, 2,000 simulated people, 1,500 for training, 500 held out, seed 42.
  Training log-likelihood −40,376.51. [VERIFIED-FILE: ml/evaluation-report.md, model-params.json]
- Synthetic results (predict the last cycle; ML = hierarchical model):

  | History | Method | MAE | RMSE | 80% cov | 95% cov |
  |---|---|---|---|---|---|
  | Full | Hierarchical | 1.98 | 2.76 | 0.842 | 0.944 |
  | Full | Last cycle | 2.67 | 3.70 | — | — |
  | Full | Fixed 28 | 2.90 | 3.81 | — | — |
  | Two cycles | Hierarchical | 2.02 | 2.73 | 0.862 | 0.960 |
  | Two cycles | Last cycle | 2.46 | 3.40 | — | — |
  | Two cycles | Fixed 28 | 2.72 | 3.44 | — | — |

  [VERIFIED-FILE: ml/evaluation-report.md]. The report states the data are synthetic and the results
  are likely optimistic. This model was NOT compared with the app's EWMA on real data.

- Training code: `ml/train.js` exists in the sandbox outputs folder. [VERIFIED-FILE]. It is not in the
  user's project folder per their earlier listing. [VERIFIED-PASTE]

## 4. Utah dataset and ML pipeline

Dataset: `CrMcyclelength_share.csv` with `Najmabadi_README20230824.txt`. [VERIFIED-FILE]
- 3,324 rows, 581 participants. Columns: new_id, age, cycle_number, cycle_start_date, cycle_end_date,
  cycle_length, conception_cycle. Dates are m/d/yy. File has a UTF-8 byte-order mark (read with utf-8-sig).
- Date range 1990-01-21 to 2012-10-13. No unparseable dates, no duplicates, no end-before-start rows.
- conception_cycle: 3,137 "no", 180 "yes", 7 "missing" (the README does not define "missing").
- 180 conception cycles have blank cycle_length; each is the final record of its participant (180 of 180).
- 186 rows are followed by a cycle_number gap (cycles missing from the file). Start-to-next-start across
  gaps: min 48, median 63, max 259 days. These are not single cycle lengths.
- Gap-free rows: provided cycle_length matches start-to-next-start in 2,556 of 2,557 rows (one differs by 1 day).
- Cycle lengths used for modelling: 3,144; 32 outside 15–60 days (flagged, not removed); max 98.
- Prediction examples: 2,582 from 475 participants. 23 unusual targets; 67 unusual histories; 560 targets
  preceded by a gap.
- Licence: CC BY-NC (README). Derived models and outputs inherit this. Population: Creighton Model users
  (README). Likely more regular cycles than the general public. [VERIFIED-FILE: README]

Pipeline code: `prepare_and_evaluate.py` (clean, build_examples, first evaluation), `cv_compare.py`
(cross-validation). Features: lag1–3, history mean and SD, number of valid prior cycles, age, cycle number,
gap flag. [VERIFIED-FILE]

## 5. Cross-validation methodology and results

Method [VERIFIED-FILE: cv_compare.py]:
- Folds split participants, not rows: 5 folds, repeated for seeds 11, 22, 33 (15 folds total).
- Each example is predicted once per seed. Learned models are fitted on training folds only.
- Inputs identical for all methods: provided cycle-length history, 2,582 examples.
- Methods: last cycle; app EWMA (α 0.35, ±2 trend cap, clamp 21–45, fallback 28); Ridge
  (median impute, standardise, alpha 1.0); HistGradientBoostingRegressor (max_iter 200, lr 0.05, depth 3,
  min_samples_leaf 40, random_state 42).
- Confidence intervals: 2,000 participant-level bootstrap resamples (seed 2024). Differences use the same resampling.
- "Meaningful" = CI excludes zero AND |difference| ≥ 0.25 days. The 0.25 threshold is an assumption made
  for this analysis, not a clinical standard.

Results (MAE/RMSE in days; mean over seeds; CI = participant bootstrap) [VERIFIED-FILE: cv_summary.csv]:

| Method | MAE | 95% CI | RMSE |
|---|---|---|---|
| Ridge | 2.982 | 2.740–3.263 | 5.409 |
| Gradient boosting | 3.010 | 2.760–3.272 | 5.383 |
| App EWMA | 3.031 | 2.782–3.327 | 5.393 |
| Last cycle | 3.489 | 3.213–3.814 | 6.202 |

Fold-level MAE means: ridge 2.979 (SD 0.195), gradient boosting 3.008 (0.191), app EWMA 3.030 (0.195),
last cycle 3.488 (0.252). Seed SDs: MAE 0.004 (ridge), 0.015 (GBM), 0 (app, deterministic).

Paired differences (A − B, negative = A lower error) [VERIFIED-FILE: cv_paired_differences.csv]:

| A | B | Diff | 95% CI | Meaningful |
|---|---|---|---|---|
| Gradient boosting | App EWMA | −0.021 | −0.082 to +0.039 | No |
| Ridge | App EWMA | −0.050 | −0.102 to +0.006 | No |
| Gradient boosting | Ridge | +0.029 | −0.029 to +0.093 | No |
| App EWMA | Last cycle | −0.458 | −0.561 to −0.355 | Yes |
| Gradient boosting | Last cycle | −0.479 | −0.589 to −0.374 | Yes |
| Ridge | Last cycle | −0.508 | −0.608 to −0.408 | Yes |

By history length (MAE; app EWMA / ridge / GBM / last cycle) [VERIFIED-FILE: cv_by_history.csv]: these
differences were NOT tested with confidence intervals; do not call them significant. Descriptive values
are in the CSV.

Earlier single-split results [VERIFIED-FILE: results/evaluation.json; participant split, 537 examples from
95 test participants, 380 training participants]:
- Participant split: last cycle 3.547 (CI 2.908–4.383); EWMA 3.022 (2.425–3.861); GBM 2.938 (2.398–3.654).
- Chronological split (475 test cases): last cycle 3.829 (3.386–4.326); EWMA 3.536 (3.099–4.034);
  GBM 3.534 (3.042–4.165).
- The single-split gap (GBM 0.08 better than EWMA) shrank to 0.02 across 15 folds. The single split was
  not stable. Use the CV numbers.

App-logic check (start-derived intervals as the app sees them) [VERIFIED-FILE: app_logic_evaluation.json]:
- All 2,582 predictions: app 3.668 (CI 3.367–3.960), naive last valid interval 4.168, RMSE 6.241.
- 537 examples from 95 participants: app 3.873 (CI 3.135–4.684), RMSE 6.944.
- Predictions with no usable history (fallback 28): 29 cases, MAE 10.414.
- Older app logic (no 15–60 filter, no ±2 cap): all 4.038; 537-example set 4.16; fallback 8.
  [VERIFIED-FILE: current_results/app_logic_evaluation.json]
- The start-date check is a different input from the CV check. Do not compare the two numbers directly.

Long-cycle variants [VERIFIED-FILE: variants_output.txt; rule variants run as a script]:
- 23 targets are over 60 days, from 25 participants. 30 of the 32 over-60 cycles have no gap in the file,
  so they look like real long cycles.
- Current rule: all MAE 3.668; over-60 MAE 35.09; ≤60 MAE 3.386.
- Wide (15–120): all 4.788; over-60 29.48. Personal (drop intervals > 1.7× median + 5): all 4.187; over-60 30.83.
- Hybrid (wide only if median > 45): all 3.681; over-60 34.52.
- No variant fixes long-cycle users. Their predictions stay poor. The current rule is kept.

## 6. Why ML is not integrated into the app

- The learned models do not beat the app's EWMA beyond the noise level on the Utah data (paired CI
  includes zero for both GBM and Ridge vs EWMA).
- The only learned model shown in the app (hierarchical) was fitted on synthetic data and is labelled
  experimental. It has not been evaluated against the app's method on real data.
- Integration would add a backend, a new processing flow for cycle dates (to disclose), and a CC BY-NC
  licence constraint for the derived model.
- Decision rule (from the plan): a learned model should replace the app method only if it is meaningfully
  better in most folds. The current result does not meet that rule.

## 7. Limitations (verified)

- The Utah population is Creighton Model users, likely more regular than the general public. [README]
- History uses provided cycle lengths in the CV comparison; the app uses logged start dates.
- Long cycles (>60 days) are poorly predicted under any tested rule.
- 186 cycle-number gaps mean some history cycles are missing; the gap flag is a feature, not a fix.
- The model.joblib artefact is trained on all examples, so it cannot be evaluated on the same data.
- No external validation dataset was used. No clinical validation was done.
- The synthetic results are simulation outputs, not real data.

## 8. Paper sections that need updating (and those that do not)

Needs updating:
- Abstract: add that the learned models were compared with the app's method on the Utah data (CV, 3 seeds,
  5 folds), and that no learned model was meaningfully better than EWMA; the learned models beat last-cycle.
- Section VI-I (experimental estimator): state the synthetic-only training; add that it was not compared
  with EWMA on real data, or add the Utah CV result as a separate comparison (not as the same model).
- Section VIII (evaluation methodology): the CV design (grouped folds, seeds, bootstrap, paired differences)
  now exists. Mark it as performed on the Utah data, not as planned.
- Section IX (results): add Table of CV results and paired differences, and the long-cycle variants.
- Section X (discussion) and XI (future work): long-cycle users, the start-date vs provided-length gap, and
  licence limits.
- References: add the Utah dataset as stated in its README. Copy the exact citation text from the README;
  it has not been checked for this audit. [UNVERIFIED]

Can remain unchanged (verify before keeping):
- Section II (related work) and the cited literature list, unless a new source is added.
- Section VII (privacy): the external-data table is unchanged, but note that the Utah analysis adds no user data.
- The statement that the app uses EWMA and a trend correction (Section VI). It matches cycle.ts.
  [VERIFIED-PASTE]
- The statement that the app is not clinically validated and not a medical device.

Corrections to make (earlier wording that is now known to be wrong):
- "537 held-out participants": the correct figure is 537 prediction examples from 95 participants.
- The earlier claim that cv_compare.py checked the example count against the prepare run was wrong. It is now
  fixed and verified (the check runs when `--prepared` is given).
- "No ML training code exists": true for the app; the Utah pipeline does contain training code (GBM and Ridge fits).

## 9. Facts another AI must preserve

- Utah: 3,324 rows, 581 participants, 2,582 examples from 475 participants; 95 participants in the
  single-split test set; 15 CV folds (5 folds × 3 seeds); 60 fold rows (4 methods × 15).
- CV MAE: ridge 2.982, GBM 3.010, app EWMA 3.031, last cycle 3.489. CIs as in §5.
- Paired: GBM vs EWMA −0.021 (CI −0.082 to 0.039, not meaningful); ridge vs EWMA −0.050 (−0.102 to 0.006,
  not meaningful); EWMA vs last cycle −0.458 (meaningful).
- Single split: GBM 2.938 vs EWMA 3.022 (participant split, 537 examples, 95 participants).
- App-logic check: all 3.668; test 3.873; fallback cases 29 with MAE 10.414.
- Synthetic hierarchical: MAE 1.98 full history vs last cycle 2.67; params μ0 29.035, τ 2.5, σ 2.5.
- Meaningful threshold 0.25 days is an assumption.
- CC BY-NC licence applies to the Utah data and to any derived model.
