# Utah menstrual cycle analysis (research only)

This folder holds the offline analysis of the University of Utah Creighton Model cycle-length dataset.
It is research code. It is NOT imported by, and does NOT change, the FemCare+ app.

## Dataset (not copied into this folder)

The original dataset is kept where it was downloaded. Scripts read it through `--data`.

- Files: `CrMcyclelength_share.csv` (3,324 cycle rows, 581 participants) and `Najmabadi_README20230824.txt`.
- Licence (from the README): CC BY-NC. Non-commercial use with attribution only.
- Location on the computer used for this work, sandbox copy: `/home/claude/utah/CrMcyclelength_share.csv`.
- Location on your Windows machine: **[UNVERIFIED - fill in]**
  - To locate it: `Get-ChildItem $HOME\Downloads -Recurse -Filter CrMcyclelength_share.csv`

## Folder structure

```
research/
  research_paper_revision_audit.md      audit for another AI (does not rewrite the paper)
  utah_cycle_analysis/
    README.md                           this file
    scripts/
      prepare_and_evaluate.py           cleaning + examples + first evaluation (imported by cv_compare.py)
      cv_compare.py                     grouped 5-fold CV x 3 seeds, MAE/RMSE, bootstrap CIs
      app_logic_check.py                app's prediction logic (as in cycle.ts) on the Utah data
      current_logic_check.py            older app logic (3 cases), for comparison
      variants.py                       long-cycle rule variants (current / wide / personal / hybrid)
    results/                            from prepare_and_evaluate.py
      cleaning_report.md
      evaluation.json                   first split + chronological split
      evaluation_by_history.csv
      prepared_examples.csv             2,582 prediction examples (the shared input)
      model.joblib                      gradient boosting fitted on all examples (research artefact, CC BY-NC)
    results_cv/                         from cv_compare.py
      summary.md, cv_summary.csv, cv_paired_differences.csv,
      cv_fold_results.csv (60 rows), cv_by_history.csv
    results_app_logic/
      app_results/                      app_logic_evaluation.json, app_logic_examples.csv
      current_results/                  older logic, same files
      variants_output.txt
```

## Dependencies (versions used)

- Python 3.12.3
- pandas 3.0.2, numpy 2.4.4, scikit-learn 1.8.0, joblib 1.5.3, tabulate 0.10.0

Install: `pip install pandas==3.0.2 scikit-learn==1.8.0 numpy joblib tabulate`

## Reproduce (Windows PowerShell)

Run from `research\utah_cycle_analysis`. Replace `<DATA>` with the full path to `CrMcyclelength_share.csv`.

```powershell
cd <project>\research\utah_cycle_analysis
python scripts\prepare_and_evaluate.py --data "<DATA>" --out results
python scripts\cv_compare.py --data "<DATA>" --out results_cv --prepared results\prepared_examples.csv
python scripts\app_logic_check.py "<DATA>" results_app_logic\app_results
python scripts\current_logic_check.py "<DATA>" results_app_logic\current_results
python scripts\variants.py "<DATA>" > results_app_logic\variants_output.txt
Get-Content results_cv\summary.md | Set-Clipboard
"Summary copied to clipboard"
```

`cv_compare.py` imports `prepare_and_evaluate.py` from the same `scripts` folder, so keep them together.
Its `--prepared` check fails if the example count differs from the prepare run.

## Reproducibility

All seeds are fixed (fold seeds 11, 22, 33; bootstrap seed 2024; model random_state 42).
Re-running `cv_compare.py` produced an identical `cv_summary.csv` (checked in the sandbox).

## Copy into the FemCare+ project (optional)

The task asked for this folder to sit in the project root. Copy it there with:

```powershell
Copy-Item -Recurse "<download-location>\research" "C:\Users\91767\Downloads\project-bolt-sb1-tgm5s2ku\project\research"
```

Nothing in `src\`, `supabase\`, `android\`, or the app's prediction code is touched by this folder.
