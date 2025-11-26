-- Migration: Update resumes table to store file content
-- This adds necessary columns to the existing resumes table

-- Add missing columns to resumes table
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_content BYTEA,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add unique constraint on user_id (one resume per user)
ALTER TABLE resumes
DROP CONSTRAINT IF EXISTS resumes_user_id_key;

ALTER TABLE resumes
ADD CONSTRAINT resumes_user_id_key UNIQUE (user_id);

-- Enable RLS if not already enabled
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can manage their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

-- Create RLS policies for resumes table
CREATE POLICY "Users can insert their own resumes" ON resumes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own resumes" ON resumes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" ON resumes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" ON resumes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- Migrate data from user_resumes to resumes if needed
INSERT INTO resumes (user_id, file_name, file_content, file_size, file_type, created_at, updated_at)
SELECT
    user_id,
    file_name,
    file_content,
    file_size,
    file_type,
    created_at,
    updated_at
FROM user_resumes
ON CONFLICT (user_id) DO UPDATE SET
    file_name = EXCLUDED.file_name,
    file_content = EXCLUDED.file_content,
    file_size = EXCLUDED.file_size,
    file_type = EXCLUDED.file_type,
    updated_at = EXCLUDED.updated_at;

-- Verify the migration
DO $$
BEGIN
  -- Check if columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resumes' AND column_name = 'file_content'
  ) THEN
    RAISE NOTICE '✅ file_content column exists';
  ELSE
    RAISE EXCEPTION '❌ file_content column missing';
  END IF;

  -- Check if RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'resumes' AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on resumes table';
  ELSE
    RAISE EXCEPTION '❌ RLS not enabled';
  END IF;

  -- Check if policies exist
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'resumes') >= 4 THEN
    RAISE NOTICE '✅ RLS policies created';
  ELSE
    RAISE EXCEPTION '❌ Not all policies created';
  END IF;

  RAISE NOTICE '🎉 Migration completed successfully!';
END
$$;

-- Show table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'resumes'
ORDER BY ordinal_position;
