-- Secure production-ready storage policy for resumes
-- This ensures users can ONLY access their own resume files
-- Run this in your Supabase SQL Editor

-- First, make sure RLS is enabled on storage.objects
-- (This might fail with permission error, but try it first)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create secure policy that isolates users by their auth.uid()
CREATE POLICY "Users can only access their own resumes" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Alternative: If the above fails due to permissions, try this simpler version
-- CREATE POLICY "Secure resume access" ON storage.objects
-- FOR ALL TO authenticated
-- USING (bucket_id = 'resumes' AND auth.uid()::text = split_part(name, '_', 2))
-- WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = split_part(name, '_', 2));

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
