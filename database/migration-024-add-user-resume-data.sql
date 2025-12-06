-- =============================================
-- Migration 024: Add user_resume_data table
-- Purpose: Store parsed resume data (summary, skills, projects)
-- =============================================

BEGIN;

-- Create user_resume_data table
CREATE TABLE IF NOT EXISTS user_resume_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Resume content fields
  professional_summary TEXT,
  skills TEXT[], -- Array of skill strings
  projects JSONB, -- Array of project objects with name and description

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_resume_data_user_id ON user_resume_data(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_resume_data_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_resume_data_updated_at ON user_resume_data;
CREATE TRIGGER trg_user_resume_data_updated_at
  BEFORE UPDATE ON user_resume_data
  FOR EACH ROW EXECUTE FUNCTION update_resume_data_updated_at();

-- Enable RLS
ALTER TABLE user_resume_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own resume data" ON user_resume_data;
DROP POLICY IF EXISTS "Users can insert own resume data" ON user_resume_data;
DROP POLICY IF EXISTS "Users can update own resume data" ON user_resume_data;
DROP POLICY IF EXISTS "Users can delete own resume data" ON user_resume_data;

CREATE POLICY "Users can view own resume data" ON user_resume_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume data" ON user_resume_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume data" ON user_resume_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume data" ON user_resume_data
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE user_resume_data IS 'Stores parsed resume data including summary, skills, and projects';
COMMENT ON COLUMN user_resume_data.professional_summary IS 'Professional summary/objective from resume';
COMMENT ON COLUMN user_resume_data.skills IS 'Array of technical and soft skills';
COMMENT ON COLUMN user_resume_data.projects IS 'JSON array of projects with name and description';

-- Verify the migration worked
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_resume_data'
  ) THEN
    RAISE NOTICE 'Migration 024 completed successfully!';
  ELSE
    RAISE WARNING 'Migration 024 may not have completed fully. Please check manually.';
  END IF;
END $$;

COMMIT;

-- End of migration 024
