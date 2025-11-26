-- Fix RLS policy on user_resumes table
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS on user_resumes table (simplest)
ALTER TABLE user_resumes DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS, create a proper policy
-- (Comment out the line above and uncomment the lines below)

-- CREATE POLICY "Users can manage their own resumes" ON user_resumes
-- FOR ALL TO authenticated
-- USING (user_id = auth.uid())
-- WITH CHECK (user_id = auth.uid());

-- Verify RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_resumes';
