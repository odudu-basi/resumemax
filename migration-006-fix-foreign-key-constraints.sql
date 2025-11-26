-- =====================================================
-- MIGRATION 006: Fix foreign key constraints on user_profiles
-- =====================================================
-- Date: 2024-10-31
-- Description: Remove incorrect foreign key constraint on id column and ensure proper constraints
-- This fixes the "violates foreign key constraint user_profiles_id_fkey" error

BEGIN;

-- Check and fix foreign key constraints
DO $$
BEGIN
    -- Drop the problematic foreign key constraint on id column if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_id_fkey') THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_id_fkey;
        RAISE NOTICE 'Dropped incorrect foreign key constraint on id column';
    END IF;
    
    -- Drop any other incorrect constraints on id column
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname LIKE '%id_fkey%' AND conrelid = 'user_profiles'::regclass) THEN
        -- Get all foreign key constraints on id column and drop them
        DECLARE
            constraint_name TEXT;
        BEGIN
            FOR constraint_name IN 
                SELECT conname FROM pg_constraint 
                WHERE conname LIKE '%id_fkey%' 
                AND conrelid = 'user_profiles'::regclass
            LOOP
                EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS ' || constraint_name;
                RAISE NOTICE 'Dropped constraint: %', constraint_name;
            END LOOP;
        END;
    END IF;
    
    -- Ensure the id column is a proper primary key without foreign key constraints
    -- First drop existing primary key if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_pkey' 
        AND conrelid = 'user_profiles'::regclass
    ) THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_pkey;
        RAISE NOTICE 'Dropped existing primary key constraint';
    END IF;
    
    -- Add primary key constraint back on id column
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
    RAISE NOTICE 'Added primary key constraint on id column';
    
    -- Ensure user_id has the correct foreign key constraint (not id)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_fkey') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added correct foreign key constraint on user_id column';
    END IF;
    
    -- Ensure user_id is unique
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_unique') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Added unique constraint on user_id column';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred while fixing foreign key constraints: %', SQLERRM;
        ROLLBACK;
        RETURN;
END $$;

-- Verify the constraints are correct
DO $$
DECLARE
    constraint_count INTEGER;
    pk_exists BOOLEAN;
    fk_exists BOOLEAN;
    unique_exists BOOLEAN;
BEGIN
    -- Check primary key on id
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_pkey' 
        AND conrelid = 'user_profiles'::regclass
        AND contype = 'p'
    ) INTO pk_exists;
    
    -- Check foreign key on user_id (not id)
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_user_id_fkey' 
        AND conrelid = 'user_profiles'::regclass
        AND contype = 'f'
    ) INTO fk_exists;
    
    -- Check unique constraint on user_id
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_user_id_unique' 
        AND conrelid = 'user_profiles'::regclass
        AND contype = 'u'
    ) INTO unique_exists;
    
    -- Check for any remaining incorrect foreign key constraints on id column
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conrelid = 'user_profiles'::regclass
    AND contype = 'f'
    AND conname LIKE '%id_fkey%'
    AND conname != 'user_profiles_user_id_fkey';
    
    RAISE NOTICE 'Constraint verification:';
    RAISE NOTICE '- Primary key on id: %', pk_exists;
    RAISE NOTICE '- Foreign key on user_id: %', fk_exists;
    RAISE NOTICE '- Unique constraint on user_id: %', unique_exists;
    RAISE NOTICE '- Incorrect foreign key constraints on id: %', constraint_count;
    
    IF pk_exists AND fk_exists AND unique_exists AND constraint_count = 0 THEN
        RAISE NOTICE 'Migration 006 completed successfully! All constraints are correct.';
    ELSE
        RAISE WARNING 'Migration 006 may not have completed fully. Please check constraints manually.';
    END IF;
END $$;

COMMIT;

-- Show final constraint structure
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    CASE 
        WHEN contype = 'p' THEN 'PRIMARY KEY'
        WHEN contype = 'f' THEN 'FOREIGN KEY'
        WHEN contype = 'u' THEN 'UNIQUE'
        WHEN contype = 'c' THEN 'CHECK'
        ELSE contype::text
    END as constraint_description
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass
ORDER BY contype, conname;
