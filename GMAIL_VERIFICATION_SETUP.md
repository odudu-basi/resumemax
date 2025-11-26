# 📧 Gmail Verification Integration Setup

## 🎯 **What This Enables**

The agent can now automatically:
- ✅ **Read verification emails** during job applications
- ✅ **Extract verification codes** (6-digit codes, alphanumeric codes)
- ✅ **Extract verification links** (email confirmation, account activation)
- ✅ **Handle multi-factor authentication** for job sites
- ✅ **Complete email verification steps** without manual intervention

## 🔧 **Setup Requirements**

### **1. Environment Variables**
Your `.env.local` should already have these (you mentioned you have them):
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback
```

### **2. Install Dependencies**
```bash
cd python-service
pip install -r requirements.txt
```

The new dependencies added:
- `google-auth==2.23.4`
- `google-auth-oauthlib==1.1.0`
- `google-auth-httplib2==0.1.1`
- `google-api-python-client==2.108.0`

## 🚀 **How to Use**

### **Step 1: Authenticate Gmail (One-time setup per user)**

1. **Start your Python service**:
   ```bash
   cd python-service
   python main.py
   ```

2. **Initiate Gmail authentication**:
   ```bash
   curl -X POST "http://localhost:8000/gmail/auth/YOUR_USER_ID"
   ```

3. **Follow the authorization URL** returned in the response
4. **Complete Google OAuth2 flow** in your browser
5. **Credentials are saved** for future use

### **Step 2: Test Gmail Integration**

**Check authentication status**:
```bash
curl "http://localhost:8000/gmail/status/YOUR_USER_ID"
```

**Test reading recent verification emails**:
```bash
curl -X POST "http://localhost:8000/gmail/test-verification/YOUR_USER_ID"
```

### **Step 3: Use in Job Applications**

The agent will automatically handle email verification during applications:

1. **Agent fills application form**
2. **Encounters "Send verification email" button**
3. **Clicks button and waits for email**
4. **Automatically reads Gmail for verification code/link**
5. **Enters code or clicks link**
6. **Continues with application**

## 🔍 **How It Works**

### **Email Detection Patterns**

**Verification Codes**:
- `verification code: 123456`
- `code: ABC123`
- `your code is 789012`
- `enter code: XYZ789`
- `123456 is your verification code`

**Verification Links**:
- `https://example.com/verify?token=...`
- `https://example.com/confirm-email?code=...`
- `https://example.com/activate-account?id=...`

### **Agent Integration**

The agent now includes these instructions:
```
EMAIL VERIFICATION HANDLING (CRITICAL):
- If the application process requires email verification, PAUSE and wait for verification email
- Look for buttons like "Send verification email", "Verify email address", or "Confirm email"
- After clicking verification button, wait 30-60 seconds for email to arrive
- The system will automatically check Gmail for verification codes and links
- If verification code is found, enter it in the appropriate field
- If verification link is found, the system will handle clicking it
```

## 🔒 **Security & Privacy**

### **OAuth2 Scopes**
- **Only requests**: `gmail.readonly` permission
- **Cannot send emails** or modify anything
- **Only reads emails** for verification purposes

### **Token Storage**
- **Refresh tokens** stored locally as `gmail_token_{user_id}.json`
- **Automatic token refresh** when expired
- **Secure credential handling** via Google's official libraries

### **Data Handling**
- **No email storage** - only extracts codes/links
- **Searches recent emails only** (last 5 minutes by default)
- **Respects Gmail API rate limits**

## 📊 **API Endpoints**

### **Authentication**
- `POST /gmail/auth/{user_id}` - Initiate OAuth2 flow
- `GET /auth/callback` - Handle OAuth2 callback
- `GET /gmail/status/{user_id}` - Check auth status

### **Testing**
- `POST /gmail/test-verification/{user_id}` - Test reading verification emails

## 🎯 **Usage Examples**

### **Common Job Application Scenarios**

#### **Scenario 1: Account Creation with Email Verification**
```
1. Agent fills registration form
2. Agent clicks "Create Account"
3. Site says "Check your email for verification"
4. Agent waits 30 seconds
5. Gmail handler finds verification email
6. Agent clicks verification link
7. Agent continues with application
```

#### **Scenario 2: Two-Factor Authentication**
```
1. Agent enters login credentials
2. Site requests 2FA code
3. Agent waits for SMS/email code
4. Gmail handler extracts 6-digit code
5. Agent enters code
6. Agent proceeds to application
```

#### **Scenario 3: Application Confirmation**
```
1. Agent submits job application
2. Site sends confirmation email
3. Gmail handler finds confirmation link
4. Agent can verify application was received
```

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **"Gmail authentication required"**
- Run: `curl -X POST "http://localhost:8000/gmail/auth/YOUR_USER_ID"`
- Follow the auth URL to complete OAuth2 flow

#### **"No verification emails found"**
- Check if emails are in spam folder
- Verify email patterns match (see detection patterns above)
- Try increasing timeout in `wait_for_verification_email`

#### **"Token expired"**
- Tokens auto-refresh, but if issues persist:
- Delete `gmail_token_{user_id}.json`
- Re-authenticate with `/gmail/auth/{user_id}`

### **Debug Logging**
The system logs detailed information:
```
📧 Gmail verification handler initialized
🔐 Starting Gmail OAuth2 authentication for user: user123
✅ Gmail authentication successful for: user@example.com
🔍 Searching Gmail for: verification OR confirm OR activate after:1234567890
📧 Found 2 recent emails
✅ Found verification code: 123456
```

## 🎉 **Ready to Use!**

Your agent can now handle email verification automatically during job applications. The integration is:

- ✅ **Secure** (OAuth2 with minimal permissions)
- ✅ **Automatic** (no manual intervention needed)
- ✅ **Reliable** (handles various email formats)
- ✅ **Fast** (checks emails every 10 seconds)

**Test it out with a job application that requires email verification!** 🚀
