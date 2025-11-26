-- Fix storage permissions for resumes bucket
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS for storage.objects (simplest fix)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS enabled, create a permissive policy instead
-- (Comment out the line above and uncomment the lines below)

-- CREATE POLICY "Allow all operations on resumes bucket" ON storage.objects
-- FOR ALL TO authenticated
-- USING (bucket_id = 'resumes')
-- WITH CHECK (bucket_id = 'resumes');

-- Verify the change
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage';
