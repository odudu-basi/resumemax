-- Create the resumes storage bucket
-- Run this in your Supabase SQL Editor

-- First, insert the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes', 
  true,
  5242880, -- 5MB in bytes
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to upload their own resumes
CREATE POLICY "Users can upload resumes" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes');

-- Create policy for authenticated users to view their own resumes  
CREATE POLICY "Users can view resumes" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'resumes');

-- Create policy for authenticated users to update their own resumes
CREATE POLICY "Users can update resumes" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'resumes')
WITH CHECK (bucket_id = 'resumes');

-- Create policy for authenticated users to delete their own resumes
CREATE POLICY "Users can delete resumes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'resumes');

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'resumes';
