# Cleaning report

- Rows: 3324; participants: 581
- Cycles per participant: min 1, median 5, max 15
- Unparseable start dates: 0; end dates: 0
- Date range: 1990-01-21 to 2012-10-13
- Duplicate (new_id, start) rows: 0 (flagged, not removed)
- cycle_number steps other than +1 within participant: 186
- Rows with end before start: 0; recorded duration (days): {'count': 3324.0, 'mean': 30.7, 'std': 7.0, 'min': 15.0, '25%': 27.0, '50%': 29.0, '75%': 32.0, 'max': 98.0}
- conception_cycle values: {'no': 3137, 'yes': 180, 'missing': 7}
- Blank cycle_length: 180; conception=yes: 180; other: 0
- Conception rows that are the final record of their participant: 180 of 180
- Missing age: 0
- Rows followed by a cycle_number gap (cycles missing from file): 186
- Start-to-next-start across gaps: min 48.0, median 63.0, max 259.0 days (not single cycle lengths)
- Gap-free rows comparing provided cycle_length with start-to-next-start: 2557; identical 2556; differ 1 {1.0: 1}
- Cycle lengths used for modelling: 3144; outside (15, 60): 32 (flagged, not removed)
- Cycle length summary: {'count': 3144.0, 'mean': 30.3, 'std': 6.7, 'min': 15.0, '25%': 27.0, '50%': 29.0, '75%': 32.0, 'max': 98.0}
- Prediction examples: 2582 from 475 participants
- Examples with unusual target: 23; unusual history: 67; target preceded by a gap: 560
