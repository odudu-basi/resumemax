# Resume Upload Diagnostic Guide

## 🔍 Issue: Resume not appearing in user profile

### ✅ What I Fixed:

1. **Added comprehensive logging** to track the entire upload/load flow
2. **Enhanced error handling** for database queries
3. **Fixed edge cases** where upload succeeds but display doesn't update

---

## 📊 How Resume Storage Works

**Current Setup: DATABASE STORAGE (NOT Storage Bucket)**

```
Upload Flow:
User selects file → /api/upload-resume → Saves to database → Parses resume
              ↓
        user_resumes table
        ├─ file_name
        ├─ file_content (bytea)
        ├─ file_size
        └─ file_type

Display Flow:
Dashboard loads → Query user_resumes → Show file_name
```

**Why the `resumes` bucket is empty:**
- ✅ This is CORRECT behavior
- Your app stores resumes in the **DATABASE** (`user_resumes` table), NOT in Storage
- The `resumes` bucket exists but is unused
- This is actually the recommended approach (as we discussed earlier)

---

## 🧪 Debugging Steps

### Step 1: Check Browser Console

Open your dashboard and check the console logs. You should see:

**On Page Load:**
```
🔍 Loading resume for user: [your-user-id]
📥 Resume query result: { hasData: true/false, fileName: 'resume.pdf', error: null }
✅ Resume found: resume.pdf   OR
ℹ️  No resume uploaded yet (code PGRST116)
```

**On Upload:**
```
📤 Uploading resume: resume.pdf (123456 bytes)
🌐 Sending upload request to /api/upload-resume...
📥 Upload response status: 200 OK
✅ Upload successful: { success: true, fileName: 'resume.pdf', ... }
♻️  Reloading page in 3 seconds to show updated profile...
```

### Step 2: Check Database Directly

Run this query in your Supabase SQL Editor:

```sql
-- Check if your resume exists
SELECT
  user_id,
  file_name,
  file_size,
  file_type,
  LENGTH(file_content) as content_size,
  created_at,
  updated_at
FROM user_resumes
WHERE user_id = auth.uid();
```

**Expected Result:**
- ✅ One row with your file name and content size > 0
- ❌ No rows = Resume never uploaded
- ❌ Row exists but `content_size = 0` = Upload failed

### Step 3: Check RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Verify RLS policies exist
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_resumes';
```

**Expected Result:**
```
Users can insert their own resumes    INSERT    auth.uid() = user_id
Users can view their own resumes      SELECT    auth.uid() = user_id
Users can update their own resumes    UPDATE    auth.uid() = user_id
Users can delete their own resumes    DELETE    auth.uid() = user_id
```

If policies are missing, run:
```bash
# In your terminal
supabase db push --file fix-user-resumes-rls-policy.sql
```

### Step 4: Test Upload Manually

1. Go to dashboard
2. Open browser console (F12)
3. Upload a resume
4. Watch the console logs
5. Check if you see any errors

---

## 🐛 Common Issues & Fixes

### Issue 1: "No resume uploaded yet (code PGRST116)"

**Cause:** Resume was never successfully uploaded

**Fix:**
1. Try uploading again
2. Check console for upload errors
3. Verify file is < 5MB
4. Verify file type is PDF/DOC/DOCX

---

### Issue 2: Upload succeeds but doesn't appear

**Cause:** `loadResume()` not being called after upload

**Fix:** Already fixed! The code now:
1. Sets `resumeFileName` immediately after upload
2. Reloads page after 3 seconds (if parsing succeeded)
3. Shows success message

---

### Issue 3: RLS Policy Error

**Error in console:**
```
Error loading resume: {
  code: '42501',
  message: 'new row violates row-level security policy'
}
```

**Fix:**
Run the RLS policy migration:
```bash
cd /Users/oduduabasivictor/Desktop/Desktop/ResumeMax/resume-scorecard
supabase db push --file fix-user-resumes-rls-policy.sql
```

---

### Issue 4: File too large

**Error:** `File size exceeds 5MB limit`

**Fix:**
- Compress your PDF
- Or increase limit in `app/api/upload-resume/route.ts` line 32:
  ```typescript
  if (file.size > 10 * 1024 * 1024) { // Change to 10MB
  ```

---

## 🧪 Testing Checklist

- [ ] Upload a resume
- [ ] Check browser console for logs
- [ ] Verify success message appears
- [ ] Wait for page reload (3 seconds)
- [ ] Check if resume filename appears in dashboard
- [ ] Try downloading the resume
- [ ] Try deleting and re-uploading

---

## 📝 What to Send Me if Still Broken

If it's still not working, send me:

1. **Browser console logs** (copy/paste from console)
2. **Database query result** (from Step 2 above)
3. **Screenshot** of the dashboard showing the resume section
4. **Any error messages** you see

---

## 🎯 Expected Behavior

**After uploading a resume:**

1. You should see:
   ```
   ✅ Resume uploaded and parsed successfully!
   Your factual profile has been updated with 150 words of structured information.
   ```

2. The page should reload after 3 seconds

3. You should see your resume filename displayed:
   ```
   [📄 resume.pdf icon]
   resume.pdf
   Current resume file
   [Download] [Delete] buttons
   ```

4. Auto-apply should work (resume will be attached to applications)

---

## 🔧 Advanced: Manual Database Fix

If upload is failing, you can manually insert a test row:

```sql
-- Test if you can insert manually
INSERT INTO user_resumes (user_id, file_name, file_content, file_size, file_type)
VALUES (
  auth.uid(),
  'test-resume.pdf',
  decode('JVBERi0xLjQKJ', 'base64'), -- Dummy PDF bytes
  1024,
  'application/pdf'
)
ON CONFLICT (user_id)
DO UPDATE SET
  file_name = EXCLUDED.file_name,
  file_content = EXCLUDED.file_content,
  updated_at = NOW();
```

If this succeeds, the issue is in the upload API.
If this fails, the issue is RLS policies.

---

## ✅ Summary

**Current Status:**
- ✅ Upload saves to DATABASE (not Storage bucket - this is correct!)
- ✅ Added comprehensive logging for debugging
- ✅ Fixed error handling
- ✅ Storage bucket being empty is NORMAL

**Next Steps:**
1. Try uploading a resume
2. Check browser console logs
3. Send me the logs if it doesn't work
