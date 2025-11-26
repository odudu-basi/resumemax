-- Fix user_profiles table structure and permissions
-- Run this in your Supabase SQL editor

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    preferred_name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    gpt_essay TEXT,
    gpt_essay_generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create RLS policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- Test the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;
