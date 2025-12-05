-- Migration 023: Fix RLS policies for applied_jobs to allow service role inserts
-- The issue: Service role inserts were failing because auth.uid() is NULL for service role

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own applied jobs" ON applied_jobs;
DROP POLICY IF EXISTS "Users can insert own applied jobs" ON applied_jobs;
DROP POLICY IF EXISTS "Users can update own applied jobs" ON applied_jobs;
DROP POLICY IF EXISTS "Users can delete own applied jobs" ON applied_jobs;

-- Create new policies that work with service role

-- SELECT: Users can view their own jobs, service role can view all
CREATE POLICY "Users can view own applied jobs"
  ON applied_jobs
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.jwt()->>'role' = 'service_role'
  );

-- INSERT: Allow inserts where user_id matches auth.uid() OR service role
CREATE POLICY "Users can insert own applied jobs"
  ON applied_jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    auth.jwt() IS NULL OR
    auth.jwt()->>'role' = 'service_role'
  );

-- UPDATE: Users can update their own jobs, service role can update all
CREATE POLICY "Users can update own applied jobs"
  ON applied_jobs
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.jwt()->>'role' = 'service_role'
  );

-- DELETE: Users can delete their own jobs, service role can delete all
CREATE POLICY "Users can delete own applied jobs"
  ON applied_jobs
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.jwt()->>'role' = 'service_role'
  );

COMMIT;

-- Verification
COMMENT ON TABLE applied_jobs IS 'Applied jobs table with RLS policies that allow service role access';
