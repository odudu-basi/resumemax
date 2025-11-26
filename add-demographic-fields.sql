-- Add demographic fields to work_authorization table
-- These fields are used for EEO (Equal Employment Opportunity) questions in job applications

ALTER TABLE work_authorization
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Non-binary', 'Prefer not to say', NULL)),
ADD COLUMN IF NOT EXISTS ethnicity TEXT CHECK (ethnicity IN ('Hispanic or Latino', 'Not Hispanic or Latino', 'Prefer not to say', NULL)),
ADD COLUMN IF NOT EXISTS race TEXT CHECK (race IN (
  'White',
  'Black or African American',
  'Hispanic or Latino',
  'Asian',
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Two or More Races',
  'Decline to Self Identify',
  'Prefer not to say',
  NULL
));

-- Add comments to explain the columns
COMMENT ON COLUMN work_authorization.gender IS 'Gender identity for EEO reporting (optional)';
COMMENT ON COLUMN work_authorization.ethnicity IS 'Ethnicity for EEO reporting (optional)';
COMMENT ON COLUMN work_authorization.race IS 'Race for EEO reporting (optional)';

-- Update existing rows to have NULL values (optional fields)
UPDATE work_authorization SET gender = NULL WHERE gender IS NULL;
UPDATE work_authorization SET ethnicity = NULL WHERE ethnicity IS NULL;
UPDATE work_authorization SET race = NULL WHERE race IS NULL;
