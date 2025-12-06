-- =============================================
-- Migration 019: Add first_name, last_name, and work_email fields
-- Purpose: Support Gmail account creation with proper name fields
-- =============================================

BEGIN;

-- Add first_name, last_name, and work_email columns to user_profiles
DO $$
BEGIN
    -- Add first_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'first_name') THEN
        ALTER TABLE user_profiles ADD COLUMN first_name TEXT;
        RAISE NOTICE 'Added first_name column to user_profiles';
    END IF;

    -- Add last_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_name') THEN
        ALTER TABLE user_profiles ADD COLUMN last_name TEXT;
        RAISE NOTICE 'Added last_name column to user_profiles';
    END IF;

    -- Add work_email column if it doesn't exist (for the @nuclei-mail.com email)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'work_email') THEN
        ALTER TABLE user_profiles ADD COLUMN work_email TEXT;
        RAISE NOTICE 'Added work_email column to user_profiles';
    END IF;

    -- Add work_email_created_at column to track when the Gmail account was created
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'work_email_created_at') THEN
        ALTER TABLE user_profiles ADD COLUMN work_email_created_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added work_email_created_at column to user_profiles';
    END IF;
END $$;

-- Create index for faster work_email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_work_email ON user_profiles(work_email);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.first_name IS 'User first name for Gmail account creation';
COMMENT ON COLUMN user_profiles.last_name IS 'User last name for Gmail account creation';
COMMENT ON COLUMN user_profiles.work_email IS 'Auto-created work email (@nuclei-mail.com)';
COMMENT ON COLUMN user_profiles.work_email_created_at IS 'Timestamp when work email was created';

-- Verify the migration worked
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- Count expected columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name IN ('first_name', 'last_name', 'work_email', 'work_email_created_at');

    RAISE NOTICE 'Migration verification: Found % expected columns', column_count;

    IF column_count >= 4 THEN
        RAISE NOTICE 'Migration 019 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 019 may not have completed fully. Please check manually.';
    END IF;
END $$;

COMMIT;

-- End of migration 019
