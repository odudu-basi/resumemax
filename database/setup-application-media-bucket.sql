-- Create Supabase Storage bucket for application screenshots and videos
-- Run this in Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-media',
  'application-media',
  true, -- Public bucket so users can view their screenshots/videos
  104857600, -- 100MB file size limit
  ARRAY['image/png', 'image/jpeg', 'video/webm', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in the bucket
CREATE POLICY IF NOT EXISTS "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'application-media');

-- Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'application-media'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
CREATE POLICY IF NOT EXISTS "Authenticated users can update own files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'application-media' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'application-media' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Authenticated users can delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'application-media' AND auth.role() = 'authenticated');

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE name = 'application-media';
