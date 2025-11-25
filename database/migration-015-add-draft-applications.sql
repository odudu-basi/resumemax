-- Add draft applications table
-- This stores pre-filled application data that users can review and edit before submission

CREATE TABLE IF NOT EXISTS draft_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,

  -- Job information
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_url TEXT NOT NULL,
  job_description TEXT,

  -- Application form data
  form_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ fieldId, label, type, value, aiGenerated, options }]

  -- Metadata
  status TEXT DEFAULT 'draft', -- 'draft', 'reviewed', 'submitted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,

  -- Link to final submission session
  submission_session_id UUID REFERENCES auto_apply_sessions(id),

  -- User notes
  user_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draft_applications_user_id
  ON draft_applications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_draft_applications_status
  ON draft_applications(user_id, status);

CREATE INDEX IF NOT EXISTS idx_draft_applications_job_url
  ON draft_applications(user_id, job_url);

-- Add RLS policies
ALTER TABLE draft_applications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own drafts
CREATE POLICY "Users can view own draft applications"
  ON draft_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own drafts
CREATE POLICY "Users can create own draft applications"
  ON draft_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own drafts
CREATE POLICY "Users can update own draft applications"
  ON draft_applications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete own draft applications"
  ON draft_applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_draft_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_draft_applications_timestamp
  BEFORE UPDATE ON draft_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_draft_applications_updated_at();

-- Comments
COMMENT ON TABLE draft_applications IS 'Stores pre-filled application data for user review before submission';
COMMENT ON COLUMN draft_applications.form_fields IS 'JSON array of form fields with AI-generated answers';
COMMENT ON COLUMN draft_applications.status IS 'Application status: draft (AI filled), reviewed (user edited), submitted (final submission completed)';
