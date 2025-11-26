# Auto-Apply Toggle Implementation

## Overview
The Auto-Apply Toggle feature allows users to choose between two application modes:
- **Manual Review Mode** (Default): Applications pause for user review before submission
- **Full Auto-Apply Mode**: Applications are submitted automatically without user intervention

## Features Implemented

### 1. UI Toggle Component
- **Location**: Browse Jobs page in dashboard
- **Component**: Custom Switch component with visual feedback
- **States**: ON/OFF with color-coded badges and descriptive text
- **Loading State**: Disabled during preference save operations

### 2. Database Integration
- **Table**: `auto_apply_preferences`
- **Schema**: 
  ```sql
  user_id UUID PRIMARY KEY REFERENCES auth.users(id)
  auto_apply_enabled BOOLEAN DEFAULT false
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  ```
- **RLS Policies**: Users can only access their own preferences

### 3. API Integration
- **Parameter**: `autoApply` boolean in intelligent-apply API
- **Schema**: Added to options object in `IntelligentApplySchema`
- **Default**: `false` (maintains backward compatibility)

### 4. Playwright Logic Enhancement
- **Manual Mode**: Pauses after form filling, creates session, sends notification
- **Auto Mode**: Attempts automatic form submission after filling
- **Submission Detection**: 
  - Looks for submit buttons with keywords: submit, apply, send, continue, next, finish, complete
  - Checks for URL changes or success messages
  - Updates session status to 'submitted' on success

## File Changes

### Frontend (`app/dashboard/page.tsx`)
- Added auto-apply toggle state management
- Created `loadAutoApplyPreference()` function
- Created `handleAutoApplyToggle()` function for saving preferences
- Added toggle UI in Auto-Apply Settings card
- Updated `handleAutoApply()` to pass `autoApply` parameter

### Backend (`app/api/intelligent-apply/route.ts`)
- Added `autoApply` parameter to request schema
- Enhanced form submission logic with conditional behavior
- Added automatic submit button detection and clicking
- Added submission success detection
- Added session status updates for auto-submitted applications

### UI Components
- Created `components/ui/switch.tsx` using Radix UI
- Installed `@radix-ui/react-switch` dependency

### Database
- Created `migration-012-add-auto-apply-preferences.sql`
- Added RLS policies for user data isolation

## User Experience

### Manual Review Mode (Default)
1. User clicks "Auto Apply" on a job
2. Form gets filled automatically
3. System pauses and creates a session
4. User receives notification to review
5. User manually reviews and submits via session link

### Full Auto-Apply Mode
1. User enables toggle in Browse Jobs settings
2. User clicks "Auto Apply" on a job
3. Form gets filled automatically
4. System automatically finds and clicks submit button
5. System detects submission success
6. Session marked as 'submitted' automatically
7. No user intervention required

## Safety Features
- **Warning Message**: Shows when auto-apply is enabled
- **Preference Persistence**: Settings saved to database per user
- **Fallback Handling**: If auto-submit fails, falls back to manual review
- **Error Recovery**: Reverts toggle state if save fails
- **Loading States**: Prevents multiple simultaneous operations

## Technical Details

### Toggle State Management
```typescript
const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
const [autoApplyToggleLoading, setAutoApplyToggleLoading] = useState(false);
```

### API Parameter Passing
```typescript
options: {
  submitForm: true,
  recordVideo: true,
  autoApply: autoApplyEnabled // Pass the toggle state
}
```

### Automatic Submission Logic
```typescript
if (autoApplyEnabled) {
  // Find submit button
  // Click submit button
  // Wait for submission
  // Check for success indicators
  // Update session status
} else {
  // Pause for manual review (existing behavior)
}
```

## Benefits
1. **User Choice**: Flexibility between automation and control
2. **Efficiency**: Fully automated applications for power users
3. **Safety**: Manual review option for cautious users
4. **Persistence**: Settings remembered across sessions
5. **Backward Compatibility**: Default behavior unchanged

## Future Enhancements
- Batch auto-apply for multiple jobs
- Success rate tracking and reporting
- Smart submission detection improvements
- Custom submission confirmation rules
