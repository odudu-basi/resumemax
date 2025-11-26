-- =====================================================
-- MIGRATION 007: Fix table structure - Remove unnecessary id columns
-- =====================================================
-- Date: 2024-10-31
-- Description: Remove separate id columns from all tables and use user_id as primary key
-- This ensures each table has only one UUID (user_id) that references auth.users(id)

BEGIN;

-- =====================================================
-- 1. Fix user_profiles table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints and indexes
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey CASCADE;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey CASCADE;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey CASCADE;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_unique CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'id') THEN
        ALTER TABLE user_profiles DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from user_profiles';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE user_profiles ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed user_profiles table structure';
END $$;

-- =====================================================
-- 2. Fix work_authorization table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE work_authorization DROP CONSTRAINT IF EXISTS work_authorization_pkey CASCADE;
    ALTER TABLE work_authorization DROP CONSTRAINT IF EXISTS work_authorization_id_fkey CASCADE;
    ALTER TABLE work_authorization DROP CONSTRAINT IF EXISTS work_authorization_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_authorization' AND column_name = 'id') THEN
        ALTER TABLE work_authorization DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from work_authorization';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_authorization' AND column_name = 'user_id') THEN
        ALTER TABLE work_authorization ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE work_authorization ADD CONSTRAINT work_authorization_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE work_authorization ADD CONSTRAINT work_authorization_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed work_authorization table structure';
END $$;

-- =====================================================
-- 3. Fix job_search_criteria table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE job_search_criteria DROP CONSTRAINT IF EXISTS job_search_criteria_pkey CASCADE;
    ALTER TABLE job_search_criteria DROP CONSTRAINT IF EXISTS job_search_criteria_id_fkey CASCADE;
    ALTER TABLE job_search_criteria DROP CONSTRAINT IF EXISTS job_search_criteria_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_search_criteria' AND column_name = 'id') THEN
        ALTER TABLE job_search_criteria DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from job_search_criteria';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_search_criteria' AND column_name = 'user_id') THEN
        ALTER TABLE job_search_criteria ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE job_search_criteria ADD CONSTRAINT job_search_criteria_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE job_search_criteria ADD CONSTRAINT job_search_criteria_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed job_search_criteria table structure';
END $$;

-- =====================================================
-- 4. Fix experience_education table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE experience_education DROP CONSTRAINT IF EXISTS experience_education_pkey CASCADE;
    ALTER TABLE experience_education DROP CONSTRAINT IF EXISTS experience_education_id_fkey CASCADE;
    ALTER TABLE experience_education DROP CONSTRAINT IF EXISTS experience_education_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experience_education' AND column_name = 'id') THEN
        ALTER TABLE experience_education DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from experience_education';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experience_education' AND column_name = 'user_id') THEN
        ALTER TABLE experience_education ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE experience_education ADD CONSTRAINT experience_education_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE experience_education ADD CONSTRAINT experience_education_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed experience_education table structure';
END $$;

-- =====================================================
-- 5. Fix skills_certifications table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE skills_certifications DROP CONSTRAINT IF EXISTS skills_certifications_pkey CASCADE;
    ALTER TABLE skills_certifications DROP CONSTRAINT IF EXISTS skills_certifications_id_fkey CASCADE;
    ALTER TABLE skills_certifications DROP CONSTRAINT IF EXISTS skills_certifications_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills_certifications' AND column_name = 'id') THEN
        ALTER TABLE skills_certifications DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from skills_certifications';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills_certifications' AND column_name = 'user_id') THEN
        ALTER TABLE skills_certifications ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE skills_certifications ADD CONSTRAINT skills_certifications_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE skills_certifications ADD CONSTRAINT skills_certifications_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed skills_certifications table structure';
END $$;

-- =====================================================
-- 6. Fix language_skills table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE language_skills DROP CONSTRAINT IF EXISTS language_skills_pkey CASCADE;
    ALTER TABLE language_skills DROP CONSTRAINT IF EXISTS language_skills_id_fkey CASCADE;
    ALTER TABLE language_skills DROP CONSTRAINT IF EXISTS language_skills_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'language_skills' AND column_name = 'id') THEN
        ALTER TABLE language_skills DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from language_skills';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'language_skills' AND column_name = 'user_id') THEN
        ALTER TABLE language_skills ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE language_skills ADD CONSTRAINT language_skills_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE language_skills ADD CONSTRAINT language_skills_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed language_skills table structure';
END $$;

-- =====================================================
-- 7. Fix application_preferences table
-- =====================================================
DO $$
BEGIN
    -- Drop existing constraints
    ALTER TABLE application_preferences DROP CONSTRAINT IF EXISTS application_preferences_pkey CASCADE;
    ALTER TABLE application_preferences DROP CONSTRAINT IF EXISTS application_preferences_id_fkey CASCADE;
    ALTER TABLE application_preferences DROP CONSTRAINT IF EXISTS application_preferences_user_id_fkey CASCADE;
    
    -- Drop the separate id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_preferences' AND column_name = 'id') THEN
        ALTER TABLE application_preferences DROP COLUMN id;
        RAISE NOTICE 'Dropped id column from application_preferences';
    END IF;
    
    -- Ensure user_id exists and is properly configured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_preferences' AND column_name = 'user_id') THEN
        ALTER TABLE application_preferences ADD COLUMN user_id UUID NOT NULL;
    END IF;
    
    -- Set user_id as primary key
    ALTER TABLE application_preferences ADD CONSTRAINT application_preferences_pkey PRIMARY KEY (user_id);
    
    -- Add foreign key constraint to auth.users
    ALTER TABLE application_preferences ADD CONSTRAINT application_preferences_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed application_preferences table structure';
END $$;

-- =====================================================
-- 8. Enable RLS on all tables
-- =====================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_search_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. Create RLS policies for all tables
-- =====================================================

-- User Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Work Authorization policies
DROP POLICY IF EXISTS "Users can manage own work_authorization" ON work_authorization;
CREATE POLICY "Users can manage own work_authorization" ON work_authorization FOR ALL USING (auth.uid() = user_id);

-- Job Search Criteria policies
DROP POLICY IF EXISTS "Users can manage own job_search_criteria" ON job_search_criteria;
CREATE POLICY "Users can manage own job_search_criteria" ON job_search_criteria FOR ALL USING (auth.uid() = user_id);

-- Experience Education policies
DROP POLICY IF EXISTS "Users can manage own experience_education" ON experience_education;
CREATE POLICY "Users can manage own experience_education" ON experience_education FOR ALL USING (auth.uid() = user_id);

-- Skills Certifications policies
DROP POLICY IF EXISTS "Users can manage own skills_certifications" ON skills_certifications;
CREATE POLICY "Users can manage own skills_certifications" ON skills_certifications FOR ALL USING (auth.uid() = user_id);

-- Language Skills policies
DROP POLICY IF EXISTS "Users can manage own language_skills" ON language_skills;
CREATE POLICY "Users can manage own language_skills" ON language_skills FOR ALL USING (auth.uid() = user_id);

-- Application Preferences policies
DROP POLICY IF EXISTS "Users can manage own application_preferences" ON application_preferences;
CREATE POLICY "Users can manage own application_preferences" ON application_preferences FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 10. Verification
-- =====================================================
DO $$
DECLARE
    tbl_name TEXT;
    table_names TEXT[] := ARRAY[
        'user_profiles', 
        'work_authorization', 
        'job_search_criteria', 
        'experience_education', 
        'skills_certifications', 
        'language_skills', 
        'application_preferences'
    ];
    has_id_column BOOLEAN;
    has_user_id_pk BOOLEAN;
    has_foreign_key BOOLEAN;
BEGIN
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    
    FOREACH tbl_name IN ARRAY table_names
    LOOP
        -- Check if id column exists (should be false)
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = tbl_name AND column_name = 'id'
        ) INTO has_id_column;
        
        -- Check if user_id is primary key
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = tbl_name 
            AND tc.constraint_type = 'PRIMARY KEY' 
            AND kcu.column_name = 'user_id'
        ) INTO has_user_id_pk;
        
        -- Check if foreign key exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            WHERE tc.table_name = tbl_name 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND tc.constraint_name LIKE '%user_id_fkey'
        ) INTO has_foreign_key;
        
        RAISE NOTICE 'Table: % | ID Column: % | User_ID PK: % | Foreign Key: %', 
            tbl_name, 
            CASE WHEN has_id_column THEN '❌ EXISTS' ELSE '✅ REMOVED' END,
            CASE WHEN has_user_id_pk THEN '✅ YES' ELSE '❌ NO' END,
            CASE WHEN has_foreign_key THEN '✅ YES' ELSE '❌ NO' END;
    END LOOP;
    
    RAISE NOTICE '=== Migration 007 completed! ===';
END $$;

COMMIT;
