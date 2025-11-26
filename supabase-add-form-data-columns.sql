-- Add columns to store filled form data for re-filling
ALTER TABLE auto_apply_sessions
ADD COLUMN IF NOT EXISTS filled_form_data JSONB,
ADD COLUMN IF NOT EXISTS user_profile_data JSONB;

-- Add comment to explain the columns
COMMENT ON COLUMN auto_apply_sessions.filled_form_data IS 'Stores the actual filled form values to enable re-filling the form later';
COMMENT ON COLUMN auto_apply_sessions.user_profile_data IS 'Stores the user profile data used during form filling';
