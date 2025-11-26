-- Simple storage bucket setup (no RLS policies)
-- Run this in your Supabase SQL Editor

-- Create the resumes storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'resumes';
