-- =====================================================
-- MIGRATION 004: Fix user_profiles table constraints
-- =====================================================
-- Date: 2024-10-31
-- Description: Fix user_profiles table to ensure proper constraints and missing columns
-- This fixes the save error where user_id was nullable and missing constraints

BEGIN;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add full_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'full_name') THEN
        ALTER TABLE user_profiles ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Added full_name column to user_profiles';
    END IF;
    
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
        ALTER TABLE user_profiles ADD COLUMN email TEXT;
        RAISE NOTICE 'Added email column to user_profiles';
    END IF;
    
    -- Add gpt_essay column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'gpt_essay') THEN
        ALTER TABLE user_profiles ADD COLUMN gpt_essay TEXT;
        RAISE NOTICE 'Added gpt_essay column to user_profiles';
    END IF;
    
    -- Add gpt_essay_generated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'gpt_essay_generated_at') THEN
        ALTER TABLE user_profiles ADD COLUMN gpt_essay_generated_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added gpt_essay_generated_at column to user_profiles';
    END IF;
END $$;

-- Fix user_id constraints (this is the key fix for the save error)
DO $$
BEGIN
    -- Check if user_id column allows nulls and fix it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        -- First, ensure no NULL values exist (set them to a default or handle appropriately)
        -- For safety, we'll delete any rows with NULL user_id as they're invalid
        DELETE FROM user_profiles WHERE user_id IS NULL;
        
        -- Make user_id NOT NULL
        ALTER TABLE user_profiles ALTER COLUMN user_id SET NOT NULL;
        RAISE NOTICE 'Set user_id column to NOT NULL';
    END IF;
    
    -- Drop existing constraints that might conflict
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_unique') THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_user_id_unique;
        RAISE NOTICE 'Dropped existing user_profiles_user_id_unique constraint';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_fkey') THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_user_id_fkey;
        RAISE NOTICE 'Dropped existing user_profiles_user_id_fkey constraint';
    END IF;
    
    -- Add unique constraint on user_id
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
    RAISE NOTICE 'Added unique constraint on user_id';
    
    -- Add foreign key constraint with CASCADE delete
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint with CASCADE delete';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred while fixing constraints: %', SQLERRM;
        ROLLBACK;
        RETURN;
END $$;

-- Create unique index on user_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
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

-- Create or replace trigger for updated_at
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

-- Verify the migration worked
DO $$
DECLARE
    column_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Count expected columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name IN ('user_id', 'full_name', 'email', 'gpt_essay', 'gpt_essay_generated_at');
    
    -- Count expected constraints
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conname IN ('user_profiles_user_id_unique', 'user_profiles_user_id_fkey');
    
    RAISE NOTICE 'Migration verification: Found % expected columns and % expected constraints', column_count, constraint_count;
    
    IF column_count >= 5 AND constraint_count >= 2 THEN
        RAISE NOTICE 'Migration 004 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 004 may not have completed fully. Please check manually.';
    END IF;
END $$;

COMMIT;

-- Final verification query (run this separately to see results)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_profiles' 
-- ORDER BY ordinal_position;
