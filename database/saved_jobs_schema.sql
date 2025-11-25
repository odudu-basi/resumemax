-- SQL Schema for Saved/Bookmarked Jobs
-- This extends the existing Supabase database

-- Table: saved_jobs
-- Stores jobs that users have bookmarked for later viewing
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job information
  job_title VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  job_url TEXT NOT NULL,
  job_description TEXT,
  job_location VARCHAR(255),
  salary_range VARCHAR(100),
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[], -- Array of reasons why this job matches
  source VARCHAR(100), -- Job board source (Indeed, LinkedIn, etc.)
  posted_date VARCHAR(100),

  -- User notes and status
  notes TEXT,
  status VARCHAR(50) DEFAULT 'saved', -- saved, applied, interviewing, rejected, accepted
  application_date TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate saves
  UNIQUE(user_id, job_url)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_status ON saved_jobs(status);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_created_at ON saved_jobs(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own saved jobs
CREATE POLICY "Users can view their own saved jobs"
  ON saved_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own saved jobs
CREATE POLICY "Users can save jobs"
  ON saved_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own saved jobs
CREATE POLICY "Users can update their saved jobs"
  ON saved_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own saved jobs
CREATE POLICY "Users can delete their saved jobs"
  ON saved_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER trigger_update_saved_jobs_updated_at
  BEFORE UPDATE ON saved_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_jobs_updated_at();

-- Table: job_applications
-- Tracks detailed application progress
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_job_id UUID REFERENCES saved_jobs(id) ON DELETE SET NULL,

  -- Application details
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  application_method VARCHAR(100), -- online, referral, recruiter, etc.
  application_url TEXT,

  -- Timeline
  applied_date DATE NOT NULL,
  follow_up_date DATE,
  response_date DATE,
  interview_dates DATE[],
  offer_date DATE,
  decision_date DATE,

  -- Status tracking
  current_stage VARCHAR(100) DEFAULT 'applied', -- applied, phone_screen, interview, offer, rejected, accepted, withdrawn
  outcome VARCHAR(50), -- pending, rejected, accepted, withdrawn

  -- Additional information
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  recruiter_name VARCHAR(255),
  salary_offered VARCHAR(100),
  notes TEXT,
  resume_version TEXT, -- Which version of resume was used

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_current_stage ON job_applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_date ON job_applications(applied_date DESC);

-- RLS Policies
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
  ON job_applications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
  ON job_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON job_applications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
  ON job_applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER trigger_update_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_jobs_updated_at();

-- View: Application statistics per user
CREATE OR REPLACE VIEW user_application_stats AS
SELECT
  user_id,
  COUNT(*) as total_applications,
  COUNT(*) FILTER (WHERE current_stage = 'applied') as applied_count,
  COUNT(*) FILTER (WHERE current_stage IN ('phone_screen', 'interview')) as interviewing_count,
  COUNT(*) FILTER (WHERE current_stage = 'offer') as offer_count,
  COUNT(*) FILTER (WHERE outcome = 'accepted') as accepted_count,
  COUNT(*) FILTER (WHERE outcome = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE outcome = 'pending') as pending_count,
  AVG(CASE WHEN outcome = 'accepted' AND applied_date IS NOT NULL AND decision_date IS NOT NULL
      THEN decision_date - applied_date END) as avg_days_to_offer
FROM job_applications
GROUP BY user_id;

-- Grant permissions for the view
GRANT SELECT ON user_application_stats TO authenticated;

-- Comments for documentation
COMMENT ON TABLE saved_jobs IS 'Stores job listings that users have bookmarked for later viewing';
COMMENT ON TABLE job_applications IS 'Tracks detailed application progress and timeline for each job';
COMMENT ON VIEW user_application_stats IS 'Provides aggregated statistics about user job applications';
