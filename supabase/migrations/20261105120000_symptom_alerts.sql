/*
  # Symptom alerts

  Stores each pattern-based alert shown to a user so it is not repeated for the same
  cycle and so the user can see the history behind it. Private per user.
*/
CREATE TABLE IF NOT EXISTS symptom_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_key date NOT NULL,
  matched text[] NOT NULL DEFAULT '{}',
  level text NOT NULL CHECK (level IN ('possible', 'strong')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  predicted_days int,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  dismissed_at timestamptz
);

ALTER TABLE symptom_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_access" ON symptom_alerts;
CREATE POLICY "owner_access" ON symptom_alerts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_symptom_alerts_user_cycle ON symptom_alerts(user_id, cycle_key, created_at DESC);
