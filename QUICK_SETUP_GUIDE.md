# Quick Setup Guide - Auto-Apply Session System

## ⚡ 3-Step Setup

### Step 1: Apply Database Schema (2 minutes)

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the contents of `database/APPLY_THIS_auto_apply_sessions.sql`
4. Paste and click **RUN**

**Verify it worked:**
```sql
SELECT * FROM auto_apply_sessions;
```
You should see an empty table (no errors).

---

### Step 2: Add Environment Variable (30 seconds)

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

For production:
```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

---

### Step 3: Test It (1 minute)

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to the smart-jobs page
3. Click "Auto Apply" on any job
4. Watch the console output:
   ```
   💾 Creating auto-apply session in database...
   ✅ Session created with ID: abc123-...
   📬 Sending notification to user...
   ✅ Notification sent successfully
   ```

5. Check Supabase:
   ```sql
   SELECT * FROM auto_apply_sessions ORDER BY created_at DESC LIMIT 1;
   ```
   You should see your new session!

---

## ✅ That's It!

The system is now:
- ✅ Creating sessions in the database
- ✅ Sending notifications
- ✅ Tracking 15-minute timeouts
- ✅ Updating status on submit/timeout

---

## 🎨 Optional: Add Timer to Job Cards

To show the countdown timer on job cards, add this to your `app/smart-jobs/page.tsx`:

### 1. Add imports (top of file):
```typescript
import { useAutoApplySessions } from '@/src/hooks/useAutoApplySessions';
import { SessionTimer } from '@/components/SessionTimer';
```

### 2. Add hook (inside component):
```typescript
// Add after other useState declarations
const [userId, setUserId] = useState<string | null>(null);
const { sessions } = useAutoApplySessions(userId);

// Get userId from your auth system
useEffect(() => {
  // Replace with your actual user ID logic
  // Example: const user = await supabase.auth.getUser();
  // setUserId(user.id);
}, []);
```

### 3. Add timer to job card (in the map function around line 1494):
```typescript
{jobResults.map((job) => {
  // Find active session for this job
  const activeSession = sessions.find(s => s.job_url === job.applicationUrl);

  return (
    <Card key={job.id} className="relative">
      {/* Add this: */}
      {activeSession && (
        <SessionTimer
          session={activeSession}
          onReviewClick={(url) => window.open(url, '_blank')}
        />
      )}

      {/* Rest of your existing card code */}
      <CardHeader>
        {/* ... */}
      </CardHeader>
    </Card>
  );
})}
```

---

## 🔍 Troubleshooting

### "relation saved_jobs does not exist"
✅ Fixed! Use `database/APPLY_THIS_auto_apply_sessions.sql` instead of the other schema file.

### Session not showing in database
Check console for errors:
- Database connection issue?
- User ID valid?
- Supabase RLS policies correct?

### Notification not sent
Check:
- `NEXT_PUBLIC_BASE_URL` environment variable set
- `/api/notify` endpoint accessible
- Console logs for notification errors

---

## 📊 Monitoring Sessions

### View active sessions:
```sql
SELECT
  job_title,
  company_name,
  status,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM auto_apply_sessions
WHERE status = 'awaiting_review'
ORDER BY expires_at ASC;
```

### View statistics:
```sql
SELECT * FROM user_auto_apply_stats;
```

### Mark expired sessions manually:
```sql
SELECT mark_expired_sessions();
```

---

## 🎉 You're Done!

The auto-apply session system is now fully operational. Users will see:
1. Form fills automatically
2. Session created with 15-minute timer
3. Notification sent to review
4. Timer appears on job card (if integrated)
5. Status updates when submitted or times out

Questions? Check `AUTO_APPLY_SESSION_IMPLEMENTATION.md` for detailed documentation.
