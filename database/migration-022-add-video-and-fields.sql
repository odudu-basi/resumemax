-- Migration 022: Add session video URL and filled fields to applied_jobs
-- This adds support for storing downloaded session recordings and extracted form data

BEGIN;

-- Add session_video_url column for storing the video in Supabase Storage
ALTER TABLE applied_jobs 
ADD COLUMN IF NOT EXISTS session_video_url TEXT;

-- Add filled_fields column for storing extracted form answers as JSON
ALTER TABLE applied_jobs 
ADD COLUMN IF NOT EXISTS filled_fields JSONB;

-- Add index for querying filled fields
CREATE INDEX IF NOT EXISTS idx_applied_jobs_filled_fields ON applied_jobs USING gin(filled_fields);

-- Add comments
COMMENT ON COLUMN applied_jobs.session_video_url IS 'URL to the downloaded session recording video stored in Supabase Storage';
COMMENT ON COLUMN applied_jobs.filled_fields IS 'JSON object containing all form fields that were filled: { "Field Label": "Value filled", ... }';

COMMIT;
