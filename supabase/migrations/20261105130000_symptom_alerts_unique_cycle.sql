/*
  # One Smart Alert per cycle

  The app creates at most one alert per user per cycle. This unique index makes the
  database enforce that, so two overlapping syncs (or two devices) cannot both create one.
  Run after 20261105120000_symptom_alerts.sql.
*/
CREATE UNIQUE INDEX IF NOT EXISTS uq_symptom_alerts_user_cycle ON symptom_alerts(user_id, cycle_key);
