-- Add work_email_password field to store Nuclei email password
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS work_email_password TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN user_profiles.work_email_password IS 'Encrypted password for the @nuclei-mail.com work email account';
