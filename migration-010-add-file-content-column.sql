-- Add file_content column to store resume files directly in database
-- Run this in your Supabase SQL Editor

-- Add file_content column to store binary data
ALTER TABLE user_resumes 
ADD COLUMN IF NOT EXISTS file_content bytea;

-- Remove file_url column since we won't need it anymore
ALTER TABLE user_resumes 
DROP COLUMN IF EXISTS file_url;

-- Add a comment to explain the new structure
COMMENT ON COLUMN user_resumes.file_content IS 'Binary content of the resume file (PDF, DOC, DOCX)';

-- Verify the updated table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_resumes' 
ORDER BY ordinal_position;
