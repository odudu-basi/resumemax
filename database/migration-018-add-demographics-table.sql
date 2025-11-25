-- =============================================
-- Migration 018: Add demographics table
-- Purpose: Store user demographic information for profile completion
-- =============================================

-- Create demographics table
CREATE TABLE IF NOT EXISTS user_demographics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Demographic fields
  race TEXT CHECK (race IN (
    'american_indian_alaska_native',
    'asian',
    'black_african_american', 
    'hispanic_latino',
    'native_hawaiian_pacific_islander',
    'white',
    'two_or_more_races',
    'prefer_not_to_say'
  )),
  
  gender TEXT CHECK (gender IN (
    'male',
    'female', 
    'non_binary',
    'transgender',
    'other',
    'prefer_not_to_say'
  )),
  
  age_range TEXT CHECK (age_range IN (
    'under_18',
    '18_24',
    '25_34',
    '35_44',
    '45_54',
    '55_64',
    '65_plus',
    'prefer_not_to_say'
  )),
  
  education_level TEXT CHECK (education_level IN (
    'high_school',
    'some_college',
    'associate_degree',
    'bachelor_degree',
    'master_degree',
    'doctoral_degree',
    'professional_degree',
    'prefer_not_to_say'
  )),
  
  employment_status TEXT CHECK (employment_status IN (
    'employed_full_time',
    'employed_part_time',
    'self_employed',
    'unemployed_seeking',
    'unemployed_not_seeking',
    'student',
    'retired',
    'prefer_not_to_say'
  )),
  
  veteran_status TEXT CHECK (veteran_status IN (
    'veteran',
    'not_veteran',
    'prefer_not_to_say'
  )),
  
  disability_status TEXT CHECK (disability_status IN (
    'yes',
    'no',
    'prefer_not_to_say'
  )),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_demographics_user_id ON user_demographics(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_demographics_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_demographics_updated_at ON user_demographics;
CREATE TRIGGER trg_user_demographics_updated_at
  BEFORE UPDATE ON user_demographics
  FOR EACH ROW EXECUTE FUNCTION update_demographics_updated_at();

-- Enable RLS
ALTER TABLE user_demographics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own demographics" ON user_demographics;
DROP POLICY IF EXISTS "Users can insert own demographics" ON user_demographics;
DROP POLICY IF EXISTS "Users can update own demographics" ON user_demographics;
DROP POLICY IF EXISTS "Users can delete own demographics" ON user_demographics;

CREATE POLICY "Users can view own demographics" ON user_demographics
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own demographics" ON user_demographics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own demographics" ON user_demographics
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own demographics" ON user_demographics
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE user_demographics IS 'Stores optional demographic information for users';
COMMENT ON COLUMN user_demographics.race IS 'User racial/ethnic background';
COMMENT ON COLUMN user_demographics.gender IS 'User gender identity';
COMMENT ON COLUMN user_demographics.age_range IS 'User age range for demographic purposes';
COMMENT ON COLUMN user_demographics.education_level IS 'Highest level of education completed';
COMMENT ON COLUMN user_demographics.employment_status IS 'Current employment status';
COMMENT ON COLUMN user_demographics.veteran_status IS 'Military veteran status';
COMMENT ON COLUMN user_demographics.disability_status IS 'Disability status for accessibility purposes';

-- End of migration 018
