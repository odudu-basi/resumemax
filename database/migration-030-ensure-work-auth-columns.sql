-- Migration 030: Ensure all work_authorization columns exist

-- Add missing columns to work_authorization table if they don't exist
ALTER TABLE work_authorization 
ADD COLUMN IF NOT EXISTS veteran_status TEXT,
ADD COLUMN IF NOT EXISTS disability_status TEXT,
ADD COLUMN IF NOT EXISTS open_to_relocation TEXT,
ADD COLUMN IF NOT EXISTS work_arrangement TEXT,
ADD COLUMN IF NOT EXISTS travel_willingness TEXT;

-- These should already exist from migration-029, but ensure they're there
ALTER TABLE work_authorization
ADD COLUMN IF NOT EXISTS security_clearance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS country_of_citizenship TEXT,
ADD COLUMN IF NOT EXISTS country_of_origin TEXT;

COMMENT ON COLUMN work_authorization.veteran_status IS 'Veteran status (yes/no/prefer-not-to-say)';
COMMENT ON COLUMN work_authorization.disability_status IS 'Disability disclosure (yes/no/prefer-not-to-answer)';
COMMENT ON COLUMN work_authorization.open_to_relocation IS 'Willingness to relocate (yes/no/depends)';
COMMENT ON COLUMN work_authorization.work_arrangement IS 'Preferred work arrangement (remote/hybrid/onsite/flexible)';
COMMENT ON COLUMN work_authorization.travel_willingness IS 'Willingness to travel (0-25%/25-50%/50-75%/75-100%/none)';
