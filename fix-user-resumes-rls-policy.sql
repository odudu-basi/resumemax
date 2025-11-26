-- Fix RLS policy for user_resumes table
-- This allows authenticated users to manage their own resumes

-- First, check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_resumes';

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own resumes" ON user_resumes;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON user_resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON user_resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON user_resumes;
DROP POLICY IF EXISTS "Users can view their own resumes" ON user_resumes;

-- Create comprehensive RLS policies for user_resumes
CREATE POLICY "Users can insert their own resumes" ON user_resumes
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own resumes" ON user_resumes
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" ON user_resumes
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" ON user_resumes
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_resumes';

-- Test query (this should work for authenticated users)
-- SELECT * FROM user_resumes WHERE user_id = auth.uid();
