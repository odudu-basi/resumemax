-- Migration 014: Add validation_errors column to auto_apply_sessions table
-- This column stores validation errors that occurred during form submission

-- Add validation_errors column (JSONB for structured error data)
ALTER TABLE auto_apply_sessions
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT NULL;

-- Add index for querying sessions with errors
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_validation_errors
ON auto_apply_sessions USING gin (validation_errors)
WHERE validation_errors IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN auto_apply_sessions.validation_errors IS
'Array of validation errors from form submission. Each error contains {field: string, message: string}';
