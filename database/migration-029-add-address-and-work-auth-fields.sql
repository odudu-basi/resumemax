-- Migration 029: Add address fields to user_profiles and new fields to work_authorization

-- Add address fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zipcode TEXT;

-- Add new fields to work_authorization table
ALTER TABLE work_authorization
ADD COLUMN IF NOT EXISTS security_clearance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS country_of_citizenship TEXT,
ADD COLUMN IF NOT EXISTS country_of_origin TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_city ON user_profiles(city);
CREATE INDEX IF NOT EXISTS idx_user_profiles_state ON user_profiles(state);
CREATE INDEX IF NOT EXISTS idx_work_authorization_country ON work_authorization(country_of_citizenship);

-- Update get_complete_user_profile function to include new fields
CREATE OR REPLACE FUNCTION get_complete_user_profile(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'basic_info', (
      SELECT json_build_object(
        'full_name', full_name,
        'preferred_name', preferred_name,
        'email', email,
        'phone', phone,
        'location', location,
        'address', address,
        'city', city,
        'state', state,
        'zipcode', zipcode,
        'linkedin_url', linkedin_url,
        'portfolio_url', portfolio_url,
        'gpt_essay', gpt_essay
      )
      FROM user_profiles
      WHERE user_id = target_user_id
    ),
    'work_auth', (
      SELECT json_build_object(
        'work_authorized', work_authorized,
        'visa_sponsorship_required', visa_sponsorship_required,
        'veteran_status', veteran_status,
        'disability_status', disability_status,
        'security_clearance', security_clearance,
        'country_of_citizenship', country_of_citizenship,
        'country_of_origin', country_of_origin,
        'open_to_relocation', open_to_relocation,
        'work_arrangement', work_arrangement,
        'travel_willingness', travel_willingness
      )
      FROM work_authorization
      WHERE user_id = target_user_id
    ),
    'job_criteria', (
      SELECT json_build_object(
        'desired_job_titles', desired_job_titles,
        'target_industries', target_industries,
        'preferred_locations', preferred_locations,
        'min_salary', min_salary,
        'job_type', job_type,
        'start_availability', start_availability
      )
      FROM job_search_criteria
      WHERE user_id = target_user_id
    ),
    'experience', (
      SELECT json_build_object(
        'employment_status', employment_status,
        'education_level', education_level,
        'field_of_study', field_of_study
      )
      FROM experience_education
      WHERE user_id = target_user_id
    ),
    'skills', (
      SELECT json_build_object(
        'technical_skills', technical_skills,
        'software_tools', software_tools,
        'certifications', certifications,
        'key_strengths', key_strengths
      )
      FROM skills_certifications
      WHERE user_id = target_user_id
    ),
    'languages', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'language', language,
          'proficiency_level', proficiency_level
        )
      ), '[]'::json)
      FROM languages
      WHERE user_id = target_user_id
    ),
    'app_prefs', (
      SELECT json_build_object(
        'applications_per_week', applications_per_week,
        'blacklisted_companies', blacklisted_companies
      )
      FROM application_preferences
      WHERE user_id = target_user_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN user_profiles.address IS 'Street address of the user';
COMMENT ON COLUMN user_profiles.city IS 'City of residence';
COMMENT ON COLUMN user_profiles.state IS 'State/Province of residence';
COMMENT ON COLUMN user_profiles.zipcode IS 'Postal/ZIP code';
COMMENT ON COLUMN work_authorization.security_clearance IS 'Whether user has security clearance';
COMMENT ON COLUMN work_authorization.country_of_citizenship IS 'Country of citizenship';
COMMENT ON COLUMN work_authorization.country_of_origin IS 'Original country/country of origin';
