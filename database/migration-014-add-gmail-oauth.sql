-- Add Gmail OAuth2 columns to user_profiles table
-- This allows users to connect their Gmail account for automatic email verification

-- Add columns for Gmail OAuth tokens
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_gmail_connected
ON user_profiles(user_id, gmail_access_token)
WHERE gmail_access_token IS NOT NULL;

-- Add comment to explain the feature
COMMENT ON COLUMN user_profiles.gmail_access_token IS 'Google OAuth2 access token for Gmail API access (for email verification)';
COMMENT ON COLUMN user_profiles.gmail_refresh_token IS 'Google OAuth2 refresh token for Gmail API access (for email verification)';
COMMENT ON COLUMN user_profiles.gmail_connected_at IS 'Timestamp when user connected their Gmail account';
