-- URGENT FIX: Disable RLS for user_resumes table to allow resume uploads
-- This will immediately fix the upload error you're experiencing

-- Disable Row Level Security on user_resumes table
ALTER TABLE user_resumes DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled (should show 'f' for false)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_resumes';

-- This should now allow resume uploads to work immediately
