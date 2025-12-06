# Login Handler Integration

## Overview

The login handler has been successfully integrated into the hybrid form filling agent. The agent now automatically detects login/signup pages, handles authentication, and processes email verification before proceeding with the job application.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 0: Login Detection & Handling (NEW)                 │
├─────────────────────────────────────────────────────────────┤
│  1. detectLoginPage()                                       │
│     • Uses observe() to detect login/signup elements        │
│     • Returns true if authentication is required            │
│                                                             │
│  2. handleLogin()                                           │
│     • Analyzes page text to determine if create account     │
│       or login is needed                                    │
│     • Routes to appropriate function                        │
│                                                             │
│  3a. createAccount() OR 3b. performLogin()                  │
│     • Uses userProfile.workspaceEmail (nuclei-mail.com)     │
│     • Uses userProfile.workspacePassword                    │
│     • Agent fills forms using act()                         │
│                                                             │
│  4. handleEmailVerification()                               │
│     • Detects if email verification is required             │
│     • Navigates to https://nuclei-mail.com/webmail          │
│     • Logs into webmail using workspace credentials         │
│     • Finds verification email using act()                  │
│     • Extracts verification code using extract()            │
│     • Returns to application page                           │
│     • Enters verification code and submits                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Traditional Stagehand (EXISTING)                  │
├─────────────────────────────────────────────────────────────┤
│  • Extract job description                                  │
│  • Observe form fields                                      │
│  • Get intelligent answers from ChatGPT                     │
│  • Fill form fields                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Agent Review & Completion (EXISTING)              │
├─────────────────────────────────────────────────────────────┤
│  • Review remaining fields                                  │
│  • Complete application                                     │
│  • Submit                                                   │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

### 1. **stagehand-service/login_handler.js** (NEW)
- **Lines:** 238
- **Exports:**
  - `detectLoginPage(stagehand)`
  - `handleLogin(stagehand, userProfile)`
  - `createAccount(stagehand, userProfile)`
  - `performLogin(stagehand, userProfile)`
  - `handleEmailVerification(stagehand, userProfile)`

### 2. **stagehand-service/adaptive_apply_hybrid.js** (MODIFIED)
- **Line 4:** Added import for login_handler
  ```javascript
  const { detectLoginPage, handleLogin } = require('./login_handler');
  ```
- **Lines 356-373:** Added PHASE 0 login detection at start of `hybridFormFill()`

## User Profile Requirements

The login handler expects the following fields in `userProfile`:

```javascript
{
  workspaceEmail: string,      // nuclei-mail.com email
  workspacePassword: string,   // password for workspace email
  fullName: string,            // used for account creation
  phone?: string               // optional, used if required by site
}
```

## Key Features

### ✅ Automatic Detection
- Uses Stagehand's `observe()` to detect login elements
- Checks for keywords: "sign in", "log in", "create account", "sign up"
- Non-blocking: continues with application if detection fails

### ✅ Smart Routing
- Analyzes page text to determine create account vs login
- Adapts to different authentication flows

### ✅ Workspace Email Integration
- All logins/signups use the workspace's nuclei-mail.com email
- Password is consistently applied across all sites

### ✅ Email Verification Handling
- Detects verification requirements by checking page text
- Navigates to nuclei-mail.com webmail
- Logs in automatically
- Finds and opens verification email using AI
- Extracts verification code using Stagehand's `extract()`
- Returns to application and submits code

### ✅ Error Resilience
- Login failures don't crash the application process
- Email verification errors are caught and logged
- Application continues even if authentication steps fail

## Testing

To test the login handler:

1. **Test Login Detection:**
   - Navigate to a job board with login required
   - Check logs for "🔍 Checking if login/signup is required..."
   - Verify detection: "✅ Login page detected!"

2. **Test Account Creation:**
   - Use a site that requires new account creation
   - Check for "📝 Creating new account..."
   - Verify workspace email is used

3. **Test Login:**
   - Use a site where account already exists
   - Check for "🔑 Logging in..."
   - Verify login completes successfully

4. **Test Email Verification:**
   - Use a site that sends verification codes
   - Check for "📧 Checking for email verification requirement..."
   - Verify navigation to nuclei-mail.com
   - Check for "✅ Found verification code: XXXX"
   - Verify code is entered on application site

## Logs to Monitor

```
🔍 Checking if login/signup is required...
  ✅ Login page detected!
🔐 Starting login handler...
  📝 Creating new account...
    📧 Using workspace email: user@nuclei-mail.com
    ✅ Account creation form submitted
  📧 Checking for email verification requirement...
    🔔 Email verification required!
    💾 Saved application URL: https://...
    📬 Navigating to nuclei-mail.com webmail...
    📧 Checking email: user@nuclei-mail.com
    🔐 Logging into webmail...
    🔍 Looking for verification email...
    ✅ Found verification code: 123456
    🔙 Returning to application...
    ⌨️  Entering verification code...
    ✅ Email verification completed!
  ✅ Login completed successfully!
```

## Next Steps

1. **Add userProfile fields:**
   - Ensure `workspaceEmail` and `workspacePassword` are populated
   - These should come from the user's workspace settings

2. **Test on real job sites:**
   - Try sites like Greenhouse, Lever, Workday
   - Monitor logs for any issues

3. **Handle edge cases:**
   - 2FA/MFA (not currently supported)
   - CAPTCHA (may require human intervention)
   - Social login (Google, LinkedIn) - not implemented

## Notes

- Login handler is **non-blocking** - application continues even if login fails
- Email verification uses **nuclei-mail.com webmail** (not Gmail)
- All authentication uses **workspace credentials** consistently
- Agent uses `act()` for intelligent form filling
- Agent uses `extract()` for verification code extraction
