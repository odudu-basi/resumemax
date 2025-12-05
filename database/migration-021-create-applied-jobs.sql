-- Migration: Create applied_jobs table to track job applications
-- This table stores all jobs that users have applied to through the platform

CREATE TABLE IF NOT EXISTS applied_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job identification
  job_url TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,

  -- Job details from scraper
  location TEXT,
  job_type TEXT, -- Full-time, Part-time, Contract, etc.
  salary_range TEXT,
  date_posted TEXT,
  job_description TEXT,
  requirements TEXT,
  benefits TEXT,

  -- Application details
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  application_status TEXT DEFAULT 'applied', -- applied, interviewing, rejected, accepted

  -- Session tracking from Stagehand
  session_id TEXT,
  session_url TEXT,

  -- Cover letter tracking
  cover_letter_generated BOOLEAN DEFAULT FALSE,

  -- Metadata
  extracted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_job_application UNIQUE(user_id, job_url)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_applied_at ON applied_jobs(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_company_name ON applied_jobs(company_name);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_status ON applied_jobs(application_status);

-- Enable Row Level Security
ALTER TABLE applied_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own applied jobs
CREATE POLICY "Users can view own applied jobs"
  ON applied_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own applied jobs
CREATE POLICY "Users can insert own applied jobs"
  ON applied_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own applied jobs
CREATE POLICY "Users can update own applied jobs"
  ON applied_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own applied jobs
CREATE POLICY "Users can delete own applied jobs"
  ON applied_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_applied_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_applied_jobs_timestamp
  BEFORE UPDATE ON applied_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_applied_jobs_updated_at();

-- Comments for documentation
COMMENT ON TABLE applied_jobs IS 'Stores all job applications submitted through the platform';
COMMENT ON COLUMN applied_jobs.job_url IS 'Original URL of the job posting';
COMMENT ON COLUMN applied_jobs.session_id IS 'Browserbase session ID from Stagehand';
COMMENT ON COLUMN applied_jobs.session_url IS 'URL to view the Browserbase session recording';
COMMENT ON COLUMN applied_jobs.application_status IS 'Current status: applied, interviewing, rejected, accepted';
