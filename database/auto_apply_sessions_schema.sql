-- SQL Schema for Auto-Apply Sessions
-- Tracks form filling sessions with 15-minute review window

-- Table: auto_apply_sessions
-- Stores active and completed auto-apply form filling sessions
CREATE TABLE IF NOT EXISTS auto_apply_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job information
  job_id UUID, -- Optional reference to saved_jobs (if it exists)
  job_url TEXT NOT NULL,
  job_title VARCHAR(255),
  company_name VARCHAR(255),

  -- Session status
  status VARCHAR(50) NOT NULL DEFAULT 'filling', -- filling, awaiting_review, submitted, timeout, error

  -- Field statistics
  total_fields INTEGER DEFAULT 0,
  fields_filled INTEGER DEFAULT 0,
  fields_skipped INTEGER DEFAULT 0,
  fields_failed INTEGER DEFAULT 0,
  success_rate INTEGER DEFAULT 0, -- Percentage

  -- Media paths
  screenshot_path TEXT,
  video_path TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled_at TIMESTAMP WITH TIME ZONE, -- When form filling completed
  expires_at TIMESTAMP WITH TIME ZONE, -- 15 minutes after filled_at
  submitted_at TIMESTAMP WITH TIME ZONE, -- When user submitted
  closed_at TIMESTAMP WITH TIME ZONE, -- When session closed (submitted or timeout)

  -- Error tracking
  error_message TEXT,
  field_errors JSONB, -- Array of field-level errors

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (status IN ('filling', 'awaiting_review', 'submitted', 'timeout', 'error'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_user_id ON auto_apply_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_status ON auto_apply_sessions(status);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_job_id ON auto_apply_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_expires_at ON auto_apply_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_created_at ON auto_apply_sessions(created_at DESC);

-- Compound index for active sessions
CREATE INDEX IF NOT EXISTS idx_auto_apply_active_sessions
  ON auto_apply_sessions(user_id, status, expires_at)
  WHERE status = 'awaiting_review';

-- Row Level Security (RLS)
ALTER TABLE auto_apply_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users can view their own auto-apply sessions"
  ON auto_apply_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can create auto-apply sessions"
  ON auto_apply_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their auto-apply sessions"
  ON auto_apply_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their auto-apply sessions"
  ON auto_apply_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_apply_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER trigger_update_auto_apply_sessions_updated_at
  BEFORE UPDATE ON auto_apply_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_apply_sessions_updated_at();

-- Function to automatically mark expired sessions as timeout
CREATE OR REPLACE FUNCTION mark_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE auto_apply_sessions
  SET
    status = 'timeout',
    closed_at = NOW(),
    error_message = 'Session expired - user did not submit within 15 minutes'
  WHERE
    status = 'awaiting_review'
    AND expires_at < NOW()
    AND closed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- View: Active sessions that need user attention
CREATE OR REPLACE VIEW active_auto_apply_sessions AS
SELECT
  s.id,
  s.user_id,
  s.job_id,
  s.job_url,
  s.job_title,
  s.company_name,
  s.status,
  s.fields_filled,
  s.total_fields,
  s.success_rate,
  s.screenshot_path,
  s.video_path,
  s.filled_at,
  s.expires_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) as seconds_remaining,
  CASE
    WHEN s.expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as session_state
FROM auto_apply_sessions s
WHERE s.status = 'awaiting_review'
  AND s.closed_at IS NULL
ORDER BY s.expires_at ASC;

-- Grant permissions for the view
GRANT SELECT ON active_auto_apply_sessions TO authenticated;

-- View: User session statistics
CREATE OR REPLACE VIEW user_auto_apply_stats AS
SELECT
  user_id,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
  COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_review') as active_count,
  AVG(fields_filled::decimal / NULLIF(total_fields, 0) * 100) as avg_fill_rate,
  AVG(EXTRACT(EPOCH FROM (submitted_at - filled_at)) / 60) FILTER (WHERE submitted_at IS NOT NULL) as avg_review_time_minutes
FROM auto_apply_sessions
GROUP BY user_id;

-- Grant permissions for the view
GRANT SELECT ON user_auto_apply_stats TO authenticated;

-- Comments for documentation
COMMENT ON TABLE auto_apply_sessions IS 'Tracks auto-apply form filling sessions with 15-minute review window';
COMMENT ON COLUMN auto_apply_sessions.status IS 'Current session status: filling, awaiting_review, submitted, timeout, error';
COMMENT ON COLUMN auto_apply_sessions.expires_at IS '15 minutes after form filling completes - session timeout';
COMMENT ON VIEW active_auto_apply_sessions IS 'Shows all active sessions awaiting user review with time remaining';
COMMENT ON VIEW user_auto_apply_stats IS 'Aggregated statistics about user auto-apply sessions';
COMMENT ON FUNCTION mark_expired_sessions() IS 'Automatically marks sessions as timeout if expires_at has passed';
