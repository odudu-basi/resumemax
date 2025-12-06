-- =============================================
-- Migration 026: Update experience_entries table schema
-- Purpose: Align with resume parsing data structure
-- =============================================

BEGIN;

-- Drop the old experience_entries table and recreate with new schema
DROP TABLE IF EXISTS experience_entries CASCADE;

CREATE TABLE experience_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  company TEXT,
  position TEXT, -- Job title/position
  location TEXT, -- City, State or location
  start_date TEXT, -- Format: MM/DD/YYYY (e.g., "01/01/2020")
  end_date TEXT, -- Format: MM/DD/YYYY (e.g., "12/01/2023")
  current BOOLEAN DEFAULT FALSE, -- Is this current position?
  description TEXT, -- Job responsibilities and achievements

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_experience_entries_user_id ON experience_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_entries_company ON experience_entries(company);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_experience_entries_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_experience_entries_updated_at ON experience_entries;
CREATE TRIGGER trg_experience_entries_updated_at
  BEFORE UPDATE ON experience_entries
  FOR EACH ROW EXECUTE FUNCTION update_experience_entries_updated_at();

-- Enable RLS
ALTER TABLE experience_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add comments
COMMENT ON TABLE experience_entries IS 'Stores user work experience from resume';
COMMENT ON COLUMN experience_entries.company IS 'Company name';
COMMENT ON COLUMN experience_entries.position IS 'Job title/position';
COMMENT ON COLUMN experience_entries.location IS 'Work location (City, State)';
COMMENT ON COLUMN experience_entries.start_date IS 'Start date in MM/DD/YYYY format';
COMMENT ON COLUMN experience_entries.end_date IS 'End date in MM/DD/YYYY format';
COMMENT ON COLUMN experience_entries.current IS 'Whether this is current position';
COMMENT ON COLUMN experience_entries.description IS 'Job responsibilities and achievements';

COMMIT;

-- End of migration 026
