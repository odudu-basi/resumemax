# Setup Supabase Storage Bucket for Screenshots & Videos

## Why You Need This

When deployed to production (Vercel), you **cannot** save files to the `/public` folder because:
1. Vercel's filesystem is **read-only** in production
2. Files would disappear on every deployment
3. Serverless functions can't write to disk

**Solution:** Upload screenshots and videos to **Supabase Storage** instead!

## How It Works

**Development (localhost):**
1. Screenshot/video saved to `/public/screenshots` and `/public/recordings`
2. Uploaded to Supabase Storage in background
3. Database updated with Supabase public URLs
4. Local files deleted after successful upload

**Production (Vercel):**
1. Screenshot/video saved to temporary directory
2. Immediately uploaded to Supabase Storage
3. Database updated with Supabase public URLs
4. Temp files cleaned up automatically

## Setup Instructions

### Step 1: Run SQL Script in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `database/setup-application-media-bucket.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

You should see output confirming the bucket was created:
```
id                | name              | public | file_size_limit
application-media | application-media | true   | 104857600
```

### Step 2: Verify Bucket in Storage

1. Click **Storage** in the left sidebar
2. You should see a bucket named **application-media**
3. Click on it to verify it's empty (ready for uploads)

### Step 3: Test Upload (Optional)

You can test by running the helper function in a Next.js API route:

```typescript
import { ensureMediaBucketExists } from '@/src/lib/upload-session-media';

// Test endpoint
export async function GET() {
  const exists = await ensureMediaBucketExists();
  return Response.json({ bucketExists: exists });
}
```

## What Gets Uploaded

For each auto-applied job:
- **Screenshot**: Full-page PNG of completed application form
- **Video**: WebM recording of entire application process

### File Structure in Supabase Storage:

```
application-media/
├── {sessionId-1}/
│   ├── screenshot.png    (~500KB - 2MB)
│   └── recording.webm    (~5MB - 20MB)
├── {sessionId-2}/
│   ├── screenshot.png
│   └── recording.webm
└── ...
```

## Database Schema

The `auto_apply_sessions` table stores references:
- `screenshot_url` - Supabase public URL (production)
- `video_url` - Supabase public URL (production)
- `screenshot_path` - Local path (development fallback)
- `video_path` - Local path (development fallback)

## Storage Costs

**Supabase Pricing:**
- Free tier: 1GB storage
- Pro tier: 100GB storage ($25/month)

**Estimated usage:**
- Average per application: ~10MB
- 1000 applications: ~10GB
- 10,000 applications: ~100GB

**Recommendation:** Start with free tier, upgrade to Pro when you hit ~100 applications.

## Storage Lifecycle (Cleanup)

To prevent unlimited storage growth, you should clean up old files periodically.

**Option 1: Manual cleanup (run every month)**
```sql
-- Delete media older than 30 days
DELETE FROM storage.objects
WHERE bucket_id = 'application-media'
AND created_at < NOW() - INTERVAL '30 days';
```

**Option 2: Supabase Lifecycle Policy (Recommended)**
1. Go to Storage → application-media → Settings
2. Add lifecycle rule: "Delete after 30 days"
3. Supabase will automatically clean up old files

**Option 3: Cron job**
Create a Supabase Edge Function or Vercel Cron Job to run cleanup weekly.

## Troubleshooting

### "Bucket already exists" error
- This is fine! The SQL script uses `ON CONFLICT DO NOTHING`
- Your bucket is already set up

### "Permission denied" when uploading
- Check that your `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Verify the key has `service_role` permissions (not `anon` key)

### "Could not upload to Supabase" error
- Check Supabase project is active (not paused)
- Verify internet connection
- Check Supabase status: https://status.supabase.com

### Files not showing in modal
- Check database: Does `screenshot_url` and `video_url` have values?
- Check Supabase Storage: Do files exist in the bucket?
- Check browser console for CORS errors

## Testing

After setup, test by:
1. Turn on auto-apply toggle
2. Auto-apply to a test job
3. Check server logs for:
   ```
   📤 Uploading screenshot: /path/to/screenshot.png
   ✅ Screenshot uploaded: https://...supabase.co/storage/...
   📤 Uploading video: /path/to/recording.webm
   ✅ Video uploaded: https://...supabase.co/storage/...
   ✅ Session updated with Supabase Storage URLs
   ```
4. Go to Supabase Storage → application-media
5. You should see a folder named after the session ID
6. Click on the session folder to see `screenshot.png` and `recording.webm`
7. Click on job card in dashboard to view in modal

## Security

The bucket is **public** because:
- Users need to view their own screenshots/videos
- Files are only accessible if you know the session ID (UUID)
- Session IDs are not guessable

**Access control:**
- Files are stored in folders named by session ID
- Only users who created a session know its ID
- RLS policies ensure users can only see their own sessions

## You're All Set! 🎉

Once you run the SQL script, your app will automatically:
1. Save files locally (development) or to temp directory (production)
2. Upload to Supabase Storage
3. Store public URLs in database
4. Clean up local files
5. Display in modal when user clicks job card
