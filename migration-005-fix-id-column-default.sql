-- =====================================================
-- MIGRATION 005: Fix id column default value
-- =====================================================
-- Date: 2024-10-31
-- Description: Ensure the id column has a proper default UUID generator
-- This fixes the "null value in column id violates not-null constraint" error

BEGIN;

-- Check if the id column exists and fix its default value
DO $$
BEGIN
    -- Check if id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'id'
    ) THEN
        -- Set default value for id column to generate UUID
        ALTER TABLE user_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
        RAISE NOTICE 'Set default UUID generator for id column';
    ELSE
        -- If id column doesn't exist, add it with proper default
        ALTER TABLE user_profiles ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
        RAISE NOTICE 'Added id column with UUID default';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred while fixing id column: %', SQLERRM;
        ROLLBACK;
        RETURN;
END $$;

-- Verify the fix
DO $$
DECLARE
    default_value TEXT;
BEGIN
    SELECT column_default INTO default_value
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'id';
    
    RAISE NOTICE 'ID column default value: %', default_value;
    
    IF default_value IS NOT NULL AND default_value LIKE '%gen_random_uuid%' THEN
        RAISE NOTICE 'Migration 005 completed successfully! ID column now has UUID default.';
    ELSE
        RAISE WARNING 'Migration 005 may not have completed fully. ID column default: %', default_value;
    END IF;
END $$;

COMMIT;
