-- =============================================
-- Migration 017: Add education_entries & experience_entries tables
-- Purpose: Persist multi-entry Education and Experience from Profile tab
-- =============================================

-- Safety: create helper updated_at function if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- =============================================
-- Table: education_entries
-- =============================================
CREATE TABLE IF NOT EXISTS education_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  school TEXT,
  start_year TEXT,
  end_year TEXT,
  major TEXT,
  degree TEXT CHECK (degree IN ('associate','bachelor','master','phd','diploma')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_entries_user_id ON education_entries(user_id);

-- Trigger
DROP TRIGGER IF EXISTS trg_education_entries_updated_at ON education_entries;
CREATE TRIGGER trg_education_entries_updated_at
  BEFORE UPDATE ON education_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE education_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own education" ON education_entries;
DROP POLICY IF EXISTS "Users can insert own education" ON education_entries;
DROP POLICY IF EXISTS "Users can update own education" ON education_entries;
DROP POLICY IF EXISTS "Users can delete own education" ON education_entries;

CREATE POLICY "Users can view own education" ON education_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own education" ON education_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own education" ON education_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own education" ON education_entries
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Table: experience_entries
-- =============================================
CREATE TABLE IF NOT EXISTS experience_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  company TEXT,
  role TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  reason_for_leaving TEXT,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_dates_consistent CHECK (
    (is_current = TRUE AND end_date IS NULL) OR (is_current = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS idx_experience_entries_user_id ON experience_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_entries_company ON experience_entries(company);

-- Trigger
DROP TRIGGER IF EXISTS trg_experience_entries_updated_at ON experience_entries;
CREATE TRIGGER trg_experience_entries_updated_at
  BEFORE UPDATE ON experience_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE experience_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own experience entries" ON experience_entries;
DROP POLICY IF EXISTS "Users can insert own experience entries" ON experience_entries;
DROP POLICY IF EXISTS "Users can update own experience entries" ON experience_entries;
DROP POLICY IF EXISTS "Users can delete own experience entries" ON experience_entries;

CREATE POLICY "Users can view own experience entries" ON experience_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experience entries" ON experience_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experience entries" ON experience_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experience entries" ON experience_entries
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Optional: augment get_complete_user_profile RPC to include arrays
-- NOTE: Only illustrative; modify your RPC separately if desired.
-- SELECT json_agg(row_to_json(ee)) FROM education_entries ee WHERE ee.user_id = target_user_id;
-- SELECT json_agg(row_to_json(xp)) FROM experience_entries xp WHERE xp.user_id = target_user_id;

-- End of migration 017

