-- =====================================================
-- RESUMEMAX ONBOARDING DATA SCHEMA (FIXED VERSION)
-- =====================================================
-- This version handles existing tables with different structures

-- =====================================================
-- STEP 1: CHECK AND FIX EXISTING USER_PROFILES TABLE
-- =====================================================
-- First, let's see what columns exist and add missing ones

DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE user_profiles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id column to user_profiles';
    END IF;
    
    -- Add other missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'full_name') THEN
        ALTER TABLE user_profiles ADD COLUMN full_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'preferred_name') THEN
        ALTER TABLE user_profiles ADD COLUMN preferred_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
        ALTER TABLE user_profiles ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone') THEN
        ALTER TABLE user_profiles ADD COLUMN phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'location') THEN
        ALTER TABLE user_profiles ADD COLUMN location TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'linkedin_url') THEN
        ALTER TABLE user_profiles ADD COLUMN linkedin_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'portfolio_url') THEN
        ALTER TABLE user_profiles ADD COLUMN portfolio_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'created_at') THEN
        ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add GPT essay field for AI-generated user profile
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'gpt_essay') THEN
        ALTER TABLE user_profiles ADD COLUMN gpt_essay TEXT;
        RAISE NOTICE 'Added gpt_essay column to user_profiles';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'gpt_essay_generated_at') THEN
        ALTER TABLE user_profiles ADD COLUMN gpt_essay_generated_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added gpt_essay_generated_at column to user_profiles';
    END IF;
END $$;

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_profiles' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%user_id%'
    ) THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE(user_id);
        RAISE NOTICE 'Added unique constraint on user_id';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Unique constraint may already exist or user_id column needs data';
END $$;

-- =====================================================
-- STEP 2: CREATE NEW ONBOARDING TABLES
-- =====================================================

-- 2. WORK AUTHORIZATION (Step 3: Work Authorization & Preferences)
CREATE TABLE IF NOT EXISTS work_authorization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Work Authorization
  work_authorized BOOLEAN NOT NULL,
  visa_sponsorship_required BOOLEAN NOT NULL,
  veteran_status TEXT CHECK (veteran_status IN ('yes', 'no', 'prefer-not-to-say')),
  disability_status TEXT CHECK (disability_status IN ('yes', 'no', 'prefer-not-to-answer')),
  
  -- Work Preferences
  open_to_relocation TEXT CHECK (open_to_relocation IN ('yes', 'no', 'depends')),
  work_arrangement TEXT CHECK (work_arrangement IN ('remote', 'hybrid', 'on-site', 'flexible')),
  travel_willingness TEXT CHECK (travel_willingness IN ('no', 'occasionally', 'frequently')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 3. JOB SEARCH CRITERIA (Step 4: Job Search Criteria)
CREATE TABLE IF NOT EXISTS job_search_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job Preferences
  desired_job_titles TEXT[] NOT NULL DEFAULT '{}',
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  preferred_locations TEXT[] NOT NULL DEFAULT '{}',
  min_salary INTEGER,
  job_type TEXT CHECK (job_type IN ('full-time', 'part-time', 'contract', 'internship')),
  start_availability TEXT CHECK (start_availability IN ('immediately', '2-weeks', '1-month', 'flexible')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 4. EXPERIENCE & EDUCATION (Step 5: Experience & Education)
CREATE TABLE IF NOT EXISTS experience_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Employment & Education
  employment_status TEXT CHECK (employment_status IN ('employed', 'unemployed', 'student', 'other')),
  education_level TEXT,
  field_of_study TEXT,
  
  -- Note: Resume/cover letter uploads removed from onboarding
  -- Users will upload these later in the application process
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 5. SKILLS & CERTIFICATIONS (Step 6: Skills & Certifications)
CREATE TABLE IF NOT EXISTS skills_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Skills
  technical_skills TEXT[] DEFAULT '{}',
  software_tools TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  key_strengths TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 6. LANGUAGE SKILLS (Step 6: Languages)
CREATE TABLE IF NOT EXISTS language_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Language Information
  language TEXT NOT NULL,
  proficiency_level TEXT CHECK (proficiency_level IN ('native', 'fluent', 'conversational', 'basic')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, language)
);

-- 7. APPLICATION PREFERENCES (Step 7: Application Preferences)
CREATE TABLE IF NOT EXISTS application_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Application Strategy
  applications_per_week INTEGER CHECK (applications_per_week IN (5, 10, 20, 30)),
  blacklisted_companies TEXT[] DEFAULT '{}',
  
  -- Additional Preferences
  auto_apply_enabled BOOLEAN DEFAULT true,
  notification_preferences JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 8. ONBOARDING PROGRESS (Track completion status)
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Step Completion Status
  step_1_completed BOOLEAN DEFAULT false,
  step_2_completed BOOLEAN DEFAULT false,
  step_3_completed BOOLEAN DEFAULT false,
  step_4_completed BOOLEAN DEFAULT false,
  step_5_completed BOOLEAN DEFAULT false,
  step_6_completed BOOLEAN DEFAULT false,
  step_7_completed BOOLEAN DEFAULT false,
  
  -- Overall Status
  onboarding_completed BOOLEAN DEFAULT false,
  current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 7),
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =====================================================
-- STEP 3: CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_work_authorization_user_id ON work_authorization(user_id);
CREATE INDEX IF NOT EXISTS idx_job_search_criteria_user_id ON job_search_criteria(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_education_user_id ON experience_education(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_certifications_user_id ON skills_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_language_skills_user_id ON language_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_application_preferences_user_id ON application_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);

-- GIN indexes for array fields (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_search_criteria') THEN
        CREATE INDEX IF NOT EXISTS idx_job_search_criteria_titles ON job_search_criteria USING GIN(desired_job_titles);
        CREATE INDEX IF NOT EXISTS idx_job_search_criteria_industries ON job_search_criteria USING GIN(target_industries);
        CREATE INDEX IF NOT EXISTS idx_job_search_criteria_locations ON job_search_criteria USING GIN(preferred_locations);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'skills_certifications') THEN
        CREATE INDEX IF NOT EXISTS idx_skills_certifications_technical ON skills_certifications USING GIN(technical_skills);
        CREATE INDEX IF NOT EXISTS idx_skills_certifications_tools ON skills_certifications USING GIN(software_tools);
    END IF;
END $$;

-- =====================================================
-- STEP 4: ENABLE RLS AND CREATE POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_search_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
    -- Drop policies for user_profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    
    -- Drop policies for other tables
    DROP POLICY IF EXISTS "Users can view own work auth" ON work_authorization;
    DROP POLICY IF EXISTS "Users can insert own work auth" ON work_authorization;
    DROP POLICY IF EXISTS "Users can update own work auth" ON work_authorization;
    
    DROP POLICY IF EXISTS "Users can view own job criteria" ON job_search_criteria;
    DROP POLICY IF EXISTS "Users can insert own job criteria" ON job_search_criteria;
    DROP POLICY IF EXISTS "Users can update own job criteria" ON job_search_criteria;
    
    DROP POLICY IF EXISTS "Users can view own experience" ON experience_education;
    DROP POLICY IF EXISTS "Users can insert own experience" ON experience_education;
    DROP POLICY IF EXISTS "Users can update own experience" ON experience_education;
    
    DROP POLICY IF EXISTS "Users can view own skills" ON skills_certifications;
    DROP POLICY IF EXISTS "Users can insert own skills" ON skills_certifications;
    DROP POLICY IF EXISTS "Users can update own skills" ON skills_certifications;
    
    DROP POLICY IF EXISTS "Users can view own languages" ON language_skills;
    DROP POLICY IF EXISTS "Users can insert own languages" ON language_skills;
    DROP POLICY IF EXISTS "Users can update own languages" ON language_skills;
    DROP POLICY IF EXISTS "Users can delete own languages" ON language_skills;
    
    DROP POLICY IF EXISTS "Users can view own app prefs" ON application_preferences;
    DROP POLICY IF EXISTS "Users can insert own app prefs" ON application_preferences;
    DROP POLICY IF EXISTS "Users can update own app prefs" ON application_preferences;
    
    DROP POLICY IF EXISTS "Users can view own progress" ON onboarding_progress;
    DROP POLICY IF EXISTS "Users can insert own progress" ON onboarding_progress;
    DROP POLICY IF EXISTS "Users can update own progress" ON onboarding_progress;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some policies may not exist yet - continuing...';
END $$;

-- Create new policies (only if user_id column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'user_id') THEN
        CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Policies for other tables
CREATE POLICY "Users can view own work auth" ON work_authorization FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own work auth" ON work_authorization FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own work auth" ON work_authorization FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own job criteria" ON job_search_criteria FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own job criteria" ON job_search_criteria FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own job criteria" ON job_search_criteria FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own experience" ON experience_education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experience" ON experience_education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experience" ON experience_education FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own skills" ON skills_certifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON skills_certifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills" ON skills_certifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own languages" ON language_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own languages" ON language_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own languages" ON language_skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own languages" ON language_skills FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own app prefs" ON application_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own app prefs" ON application_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own app prefs" ON application_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own progress" ON onboarding_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON onboarding_progress FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- STEP 5: CREATE FUNCTIONS AND TRIGGERS
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_work_authorization_updated_at ON work_authorization;
DROP TRIGGER IF EXISTS update_job_search_criteria_updated_at ON job_search_criteria;
DROP TRIGGER IF EXISTS update_experience_education_updated_at ON experience_education;
DROP TRIGGER IF EXISTS update_skills_certifications_updated_at ON skills_certifications;
DROP TRIGGER IF EXISTS update_application_preferences_updated_at ON application_preferences;
DROP TRIGGER IF EXISTS update_onboarding_progress_updated_at ON onboarding_progress;

-- Create triggers (only if updated_at column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
        CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

CREATE TRIGGER update_work_authorization_updated_at BEFORE UPDATE ON work_authorization FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_search_criteria_updated_at BEFORE UPDATE ON job_search_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_experience_education_updated_at BEFORE UPDATE ON experience_education FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_skills_certifications_updated_at BEFORE UPDATE ON skills_certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_preferences_updated_at BEFORE UPDATE ON application_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON onboarding_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 6: HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION get_complete_user_profile(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'basic_info', (SELECT row_to_json(up) FROM user_profiles up WHERE up.user_id = target_user_id),
        'work_auth', (SELECT row_to_json(wa) FROM work_authorization wa WHERE wa.user_id = target_user_id),
        'job_criteria', (SELECT row_to_json(jsc) FROM job_search_criteria jsc WHERE jsc.user_id = target_user_id),
        'experience', (SELECT row_to_json(ee) FROM experience_education ee WHERE ee.user_id = target_user_id),
        'skills', (SELECT row_to_json(sc) FROM skills_certifications sc WHERE sc.user_id = target_user_id),
        'languages', (SELECT json_agg(row_to_json(ls)) FROM language_skills ls WHERE ls.user_id = target_user_id),
        'app_prefs', (SELECT row_to_json(ap) FROM application_preferences ap WHERE ap.user_id = target_user_id),
        'progress', (SELECT row_to_json(op) FROM onboarding_progress op WHERE op.user_id = target_user_id)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_onboarding_complete(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_complete BOOLEAN;
BEGIN
    SELECT onboarding_completed INTO is_complete
    FROM onboarding_progress
    WHERE user_id = target_user_id;
    
    RETURN COALESCE(is_complete, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Onboarding schema setup completed successfully!';
    RAISE NOTICE '📋 Tables created: work_authorization, job_search_criteria, experience_education, skills_certifications, language_skills, application_preferences, onboarding_progress';
    RAISE NOTICE '🔧 user_profiles table updated with missing columns including gpt_essay field';
    RAISE NOTICE '🤖 GPT essay field added for AI-generated user profiles';
    RAISE NOTICE '🔒 Row Level Security enabled on all tables';
    RAISE NOTICE '⚡ Helper functions created: get_complete_user_profile(), is_onboarding_complete()';
    RAISE NOTICE '📄 Resume uploads removed from onboarding - will be handled separately';
END $$;
