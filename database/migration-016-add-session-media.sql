-- Add screenshot and video recording columns to auto_apply_sessions
-- This allows users to review what was submitted

ALTER TABLE auto_apply_sessions
ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS screenshot_path TEXT,
ADD COLUMN IF NOT EXISTS video_path TEXT;

-- Add comments
COMMENT ON COLUMN auto_apply_sessions.screenshot_url IS 'Public URL to full-page screenshot of completed application';
COMMENT ON COLUMN auto_apply_sessions.video_url IS 'Public URL to screen recording of application process';
COMMENT ON COLUMN auto_apply_sessions.screenshot_path IS 'Storage path for screenshot file';
COMMENT ON COLUMN auto_apply_sessions.video_path IS 'Storage path for video file';
