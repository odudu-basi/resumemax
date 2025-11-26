-- Migration 009: Add user_resumes table
-- This migration creates a table to store user resume content

-- Create user_resumes table
CREATE TABLE IF NOT EXISTS user_resumes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own resumes
CREATE POLICY "Users can manage their own resumes" ON user_resumes
  FOR ALL USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON user_resumes(user_id);

-- Verification
DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_resumes') THEN
    RAISE NOTICE '✅ user_resumes table created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create user_resumes table';
  END IF;
  
  -- Check if RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'user_resumes' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ Row Level Security enabled on user_resumes';
  ELSE
    RAISE EXCEPTION '❌ Row Level Security not enabled on user_resumes';
  END IF;
  
  -- Check if policy exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_resumes' 
    AND policyname = 'Users can manage their own resumes'
  ) THEN
    RAISE NOTICE '✅ Security policy created for user_resumes';
  ELSE
    RAISE EXCEPTION '❌ Security policy not created for user_resumes';
  END IF;
  
  -- Check if index exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_resumes' 
    AND indexname = 'idx_user_resumes_user_id'
  ) THEN
    RAISE NOTICE '✅ Index created on user_resumes.user_id';
  ELSE
    RAISE EXCEPTION '❌ Index not created on user_resumes.user_id';
  END IF;
  
  RAISE NOTICE '🎉 Migration 009 completed successfully!';
END
$$;
