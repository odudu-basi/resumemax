-- Migration 013: Add manual_submission status to auto_apply_sessions
-- This allows tracking of jobs applied through "Apply & Review" mode

-- Remove the existing CHECK constraint
ALTER TABLE auto_apply_sessions DROP CONSTRAINT IF EXISTS auto_apply_sessions_status_check;

-- Add the new CHECK constraint with manual_submission status
ALTER TABLE auto_apply_sessions 
ADD CONSTRAINT auto_apply_sessions_status_check 
CHECK (status IN ('filling', 'awaiting_review', 'submitted', 'timeout', 'error', 'manual_submission'));

-- Update the comment to reflect the new status
COMMENT ON COLUMN auto_apply_sessions.status IS 'Current session status: filling, awaiting_review, submitted, timeout, error, manual_submission';

-- Update the analytics view to include manual_submission counts
DROP VIEW IF EXISTS auto_apply_analytics;

CREATE VIEW auto_apply_analytics AS
SELECT 
  DATE(filled_at) as application_date,
  COUNT(*) as total_applications,
  COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
  COUNT(*) FILTER (WHERE status = 'manual_submission') as manual_submission_count,
  COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
  COUNT(*) FILTER (WHERE status = 'awaiting_review') as active_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  AVG(success_rate) as avg_success_rate,
  AVG(EXTRACT(EPOCH FROM (submitted_at - filled_at)) / 60) FILTER (WHERE submitted_at IS NOT NULL) as avg_review_time_minutes
FROM auto_apply_sessions 
GROUP BY DATE(filled_at)
ORDER BY application_date DESC;

COMMENT ON VIEW auto_apply_analytics IS 'Analytics view for auto-apply sessions including manual submissions';

-- Create index for faster queries on manual_submission status
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_manual_submission 
ON auto_apply_sessions(status) 
WHERE status = 'manual_submission';

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'auto_apply_sessions' 
  AND column_name = 'status';
