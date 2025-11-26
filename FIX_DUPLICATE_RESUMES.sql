-- Fix: Remove duplicate resumes and add unique constraint
-- Run this in Supabase SQL Editor

-- Step 1: Check current duplicates
SELECT user_id, COUNT(*) as count
FROM resumes
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 2: Keep only the most recent resume per user, delete old ones
DELETE FROM resumes
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM resumes
  ORDER BY user_id, created_at DESC NULLS LAST, id DESC
);

-- Step 3: Verify no more duplicates
SELECT user_id, COUNT(*) as count
FROM resumes
GROUP BY user_id
HAVING COUNT(*) > 1;
-- This should return no rows

-- Step 4: Now add the columns (if not already added)
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_content BYTEA,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 5: Now add unique constraint (should work now)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'resumes_user_id_key'
  ) THEN
    ALTER TABLE resumes ADD CONSTRAINT resumes_user_id_key UNIQUE (user_id);
  END IF;
END
$$;

-- Step 6: Enable RLS
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop old policies if they exist
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

-- Step 8: Create new policies
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

-- Step 9: Create index
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- Step 10: Verify final structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'resumes'
ORDER BY ordinal_position;

-- Step 11: Show your resume count
SELECT COUNT(*) as total_resumes FROM resumes;
SELECT user_id, COUNT(*) as count FROM resumes GROUP BY user_id;
