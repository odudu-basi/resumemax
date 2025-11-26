-- Quick Fix: Add missing columns to resumes table
-- Copy and paste this into Supabase SQL Editor and click RUN

-- Step 1: Add missing columns
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_content BYTEA,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Add unique constraint (one resume per user)
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

-- Step 3: Enable RLS
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old policies if they exist
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

-- Step 5: Create new policies
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

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- Step 7: Show final table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'resumes'
ORDER BY ordinal_position;

-- You should see these columns:
-- id, user_id, title, file_name, file_content, file_size, file_type, created_at, updated_at
