# Cross-validation summary

Examples: 2582 from 475 participants. Folds: 5 grouped by participant, seeds [11, 22, 33].
Bootstrap: 2000 resamples of participants. Practical threshold: 0.25 days.

## Methods (MAE in days, mean over seeds; CI = participant bootstrap)

| method            |   MAE_mean_over_seeds |   MAE_sd_over_seeds |   RMSE_mean_over_seeds |   MAE_CI95_low |   MAE_CI95_high |
|:------------------|----------------------:|--------------------:|-----------------------:|---------------:|----------------:|
| ridge             |                 2.982 |               0.004 |                  5.409 |          2.74  |           3.263 |
| gradient_boosting |                 3.01  |               0.015 |                  5.383 |          2.76  |           3.272 |
| app_ewma          |                 3.031 |               0     |                  5.393 |          2.782 |           3.327 |
| last_cycle        |                 3.489 |               0     |                  6.202 |          3.213 |           3.814 |

## Paired differences (A minus B; negative means A is better)

| method_A          | method_B   |   MAE_diff_A_minus_B |   CI95_low |   CI95_high | meaningful   |
|:------------------|:-----------|---------------------:|-----------:|------------:|:-------------|
| gradient_boosting | app_ewma   |               -0.021 |     -0.082 |       0.039 | False        |
| ridge             | app_ewma   |               -0.05  |     -0.102 |       0.006 | False        |
| gradient_boosting | ridge      |                0.029 |     -0.029 |       0.093 | False        |
| app_ewma          | last_cycle |               -0.458 |     -0.561 |      -0.355 | True         |
| gradient_boosting | last_cycle |               -0.479 |     -0.589 |      -0.374 | True         |
| ridge             | last_cycle |               -0.508 |     -0.608 |      -0.408 | True         |

Best by mean MAE: **ridge**.
Versus the app method: difference -0.05 days, CI [-0.102, 0.006], meaningful: False.
