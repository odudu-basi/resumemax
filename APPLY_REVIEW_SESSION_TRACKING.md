# Apply & Review Session Tracking Implementation

## Overview
Updated the "Apply & Review" mode to save job application sessions to the database for tracking purposes, allowing users to see all their job applications (both auto-apply and manual submissions) in the submitted tab.

## Key Changes Made

### 1. Database Schema Updates
- **File**: `migration-013-add-manual-submission-status.sql`
- **Changes**: 
  - Added `manual_submission` status to the allowed status values
  - Updated CHECK constraint to include new status
  - Updated analytics view to track manual submissions
  - Added index for faster queries on manual_submission status

### 2. Intelligent Apply API Updates
- **File**: `app/api/intelligent-apply/route.ts`
- **Changes**:
  - Modified session creation to work for both auto-apply and apply & review modes
  - Set different status values based on mode:
    - Auto-apply: `awaiting_review` (existing behavior)
    - Apply & Review: `manual_submission` (new status)
  - Set `closed_at` timestamp immediately for manual submissions
  - Only save `filled_form_data` and `user_profile_data` for auto-apply mode
  - Only send notifications for auto-apply mode
  - Return `sessionId` for both modes in API response

### 3. Frontend Hook Updates
- **File**: `src/hooks/useSubmittedApplications.ts`
- **Changes**:
  - Updated query to include `manual_submission` status in submitted applications
  - Now fetches sessions with status: `['submitted', 'timeout', 'error', 'manual_submission']`

## Session Status Flow

### Auto-Apply Mode (Toggle ON)
1. **Initial**: `awaiting_review` (with expiry time)
2. **After auto-submission**: `submitted` (with closed_at timestamp)
3. **If expired**: `timeout` (via background job)
4. **If error**: `error`

### Apply & Review Mode (Toggle OFF)
1. **Initial**: `manual_submission` (with immediate closed_at timestamp)
2. **Status remains**: `manual_submission` (no further updates needed)

## Database Fields by Mode

### Auto-Apply Mode
- Saves all fields including `filled_form_data` and `user_profile_data`
- Has expiry time and notification system
- Can be refilled if expired

### Apply & Review Mode
- Saves basic tracking info: job_url, job_title, company_name, success_rate
- No `filled_form_data` or `user_profile_data` (not needed for tracking)
- No expiry time (closed immediately)
- No notifications (user handles submission manually)

## Benefits

1. **Complete Tracking**: Users can see all job applications in one place
2. **Analytics**: Can track success rates and application patterns for both modes
3. **User Experience**: Submitted tab shows comprehensive application history
4. **Data Efficiency**: Only stores necessary data for each mode

## API Response Changes

The intelligent-apply API now returns:
- `sessionId`: Available for both modes (for tracking)
- `mode`: Either `auto_apply` or `apply_and_review`
- `browserOpened`: Boolean indicating if visible browser was launched
- Different success messages based on mode

## Frontend Impact

- Submitted applications tab will now show both auto-applied and manually submitted jobs
- Job cards will display appropriate status information
- No changes needed to existing UI components (they already handle different statuses)

## Migration Required

Run `migration-013-add-manual-submission-status.sql` to update the database schema before deploying these changes.
