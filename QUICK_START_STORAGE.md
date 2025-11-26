# Quick Start: Enable Screenshot & Video Storage

## 🚀 One-Time Setup (5 minutes)

### Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **Storage** in left sidebar
4. Click **New Bucket**
5. Fill in:
   - **Name:** `application-media`
   - **Public bucket:** ✅ Yes (checked)
   - **File size limit:** 100 MB
   - **Allowed MIME types:** `image/png, image/jpeg, video/webm, video/mp4`
6. Click **Create Bucket**

### Step 2: Set Bucket Policies

1. In the same Storage section, click on **Policies**
2. Click **New Policy**
3. **For SELECT (view files):**
   - Policy name: `Public Access`
   - Operation: `SELECT`
   - Policy definition:
     ```sql
     bucket_id = 'application-media'
     ```
4. Click **Review** → **Save Policy**

5. Click **New Policy** again
6. **For INSERT (upload files):**
   - Policy name: `Authenticated users can upload`
   - Operation: `INSERT`
   - Policy definition:
     ```sql
     bucket_id = 'application-media' AND auth.role() = 'authenticated'
     ```
7. Click **Review** → **Save Policy**

### Alternative: Use SQL Script

Or just run this SQL in **SQL Editor**:

```sql
-- Copy entire contents of: database/setup-application-media-bucket.sql
```

## ✅ That's It!

Your app will now:
1. ✅ Auto-upload screenshots and videos to Supabase
2. ✅ Store public URLs in database
3. ✅ Display them when users click job cards
4. ✅ Work in production (Vercel, etc.)

## 🧪 Test It

1. Turn on **Auto-Apply** toggle
2. Auto-apply to any job
3. Go to **Submitted Applications**
4. Click on the job card
5. **Modal opens** with screenshot and video!

## 📊 Monitor Usage

Check storage usage:
- Supabase Dashboard → Storage → application-media
- See all uploaded screenshots and videos
- Monitor storage size

## 💰 Storage Limits

- **Free tier:** 1GB (~100 applications)
- **Pro tier:** 100GB (~10,000 applications) - $25/month

## 🗑️ Auto-Cleanup (Optional)

Set up automatic deletion of old files:
1. Storage → application-media → **Settings**
2. Add **Lifecycle Rule**: Delete after 30 days
3. Click **Save**

Done! Old files automatically deleted after 30 days.

---

That's all! The feature is ready to use. 🎉
