/*
# Cycle Prediction Audit Table

Creates a table to store cycle predictions and their accuracy over time,
enabling the ML prediction engine to learn from past prediction errors.

## New Tables
- `prediction_audit` — stores each cycle prediction made for a user, the predicted
  next period date, the algorithm used, model parameters (weights, trend), and later
  the actual period start date and the error in days once the actual period arrives.

## Security
- RLS enabled on `prediction_audit`.
- Owner-scoped CRUD policies (auth.uid() = user_id) on all four verbs.
- user_id defaults to auth.uid() so inserts work without explicit owner.
*/

CREATE TABLE IF NOT EXISTS prediction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_date date NOT NULL,
  actual_date date,
  error_days int,
  algorithm text NOT NULL DEFAULT 'weighted_regression',
  model_params jsonb DEFAULT '{}'::jsonb,
  confidence text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE prediction_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_predictions" ON prediction_audit;
CREATE POLICY "select_own_predictions" ON prediction_audit FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_predictions" ON prediction_audit;
CREATE POLICY "insert_own_predictions" ON prediction_audit FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_predictions" ON prediction_audit;
CREATE POLICY "update_own_predictions" ON prediction_audit FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_predictions" ON prediction_audit;
CREATE POLICY "delete_own_predictions" ON prediction_audit FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prediction_audit_user_id ON prediction_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_audit_unresolved ON prediction_audit(user_id) WHERE actual_date IS NULL;