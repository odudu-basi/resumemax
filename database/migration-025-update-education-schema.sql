-- =============================================
-- Migration 025: Update education_entries table schema
-- Purpose: Align with resume parsing data structure
-- =============================================

BEGIN;

-- Drop the old education_entries table and recreate with new schema
DROP TABLE IF EXISTS education_entries CASCADE;

CREATE TABLE education_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  school TEXT,
  degree TEXT, -- Full degree text (e.g., "Bachelor of Science in Computer Science")
  start_date TEXT, -- Format: MM/DD/YYYY (e.g., "09/01/2018")
  end_date TEXT, -- Format: MM/DD/YYYY (e.g., "05/01/2022")
  current BOOLEAN DEFAULT FALSE, -- Is this current education?

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_education_entries_user_id ON education_entries(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_education_entries_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_education_entries_updated_at ON education_entries;
CREATE TRIGGER trg_education_entries_updated_at
  BEFORE UPDATE ON education_entries
  FOR EACH ROW EXECUTE FUNCTION update_education_entries_updated_at();

-- Enable RLS
ALTER TABLE education_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add comments
COMMENT ON TABLE education_entries IS 'Stores user education history from resume';
COMMENT ON COLUMN education_entries.school IS 'School/University name';
COMMENT ON COLUMN education_entries.degree IS 'Full degree name (e.g., Bachelor of Science in Computer Science)';
COMMENT ON COLUMN education_entries.start_date IS 'Start date in MM/DD/YYYY format';
COMMENT ON COLUMN education_entries.end_date IS 'End date in MM/DD/YYYY format';
COMMENT ON COLUMN education_entries.current IS 'Whether user is currently studying here';

COMMIT;

-- End of migration 025
