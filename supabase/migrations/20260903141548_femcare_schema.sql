/*
# FemCare+ Database Schema

Creates the full data model for a menstrual health and reproductive wellness app.

## New Tables
- `profiles` — user profile and cycle settings (name, email, cycle length, period duration, last period date, regularity, language, preferences)
- `periods` — logged period records (start/end dates, duration, notes)
- `symptoms` — daily symptom/mood check-ins (symptoms array, severity, mood, pain, notes)
- `chat_history` — AI assistant conversation history (mode, sender, message)
- `emergency_contacts` — user's saved emergency contacts (name, phone, relationship)
- `user_settings` — notification and app preferences (notifications, privacy lock, theme, language)

## Security
- RLS enabled on all tables
- Owner-scoped CRUD policies (auth.uid() = user_id) on all tables
- user_id defaults to auth.uid() so inserts work without explicit owner
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  date_of_birth date,
  cycle_length int DEFAULT 28,
  period_duration int DEFAULT 5,
  last_period_date date,
  cycle_regularity text DEFAULT 'regular',
  language text DEFAULT 'en',
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Periods table
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  duration int,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_periods" ON periods;
CREATE POLICY "select_own_periods" ON periods FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_periods" ON periods;
CREATE POLICY "insert_own_periods" ON periods FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_periods" ON periods;
CREATE POLICY "update_own_periods" ON periods FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_periods" ON periods;
CREATE POLICY "delete_own_periods" ON periods FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Symptoms table
CREATE TABLE IF NOT EXISTS symptoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  symptoms text[] DEFAULT '{}',
  severity text,
  mood text,
  pain int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_symptoms" ON symptoms;
CREATE POLICY "select_own_symptoms" ON symptoms FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_symptoms" ON symptoms;
CREATE POLICY "insert_own_symptoms" ON symptoms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_symptoms" ON symptoms;
CREATE POLICY "update_own_symptoms" ON symptoms FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_symptoms" ON symptoms;
CREATE POLICY "delete_own_symptoms" ON symptoms FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL,
  sender text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat" ON chat_history;
CREATE POLICY "select_own_chat" ON chat_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat" ON chat_history;
CREATE POLICY "insert_own_chat" ON chat_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat" ON chat_history;
CREATE POLICY "delete_own_chat" ON chat_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_emergency" ON emergency_contacts;
CREATE POLICY "select_own_emergency" ON emergency_contacts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_emergency" ON emergency_contacts;
CREATE POLICY "insert_own_emergency" ON emergency_contacts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_emergency" ON emergency_contacts;
CREATE POLICY "update_own_emergency" ON emergency_contacts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_emergency" ON emergency_contacts;
CREATE POLICY "delete_own_emergency" ON emergency_contacts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text DEFAULT 'system',
  language text DEFAULT 'en',
  notifications jsonb DEFAULT '{}'::jsonb,
  privacy_lock_enabled boolean DEFAULT false,
  privacy_pin_hash text,
  sexual_health_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_periods_user_id ON periods(user_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
