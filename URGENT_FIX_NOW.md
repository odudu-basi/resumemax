# URGENT FIX - Database Schema Issue

## The Problem
Your webhook is failing with this error:
```
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```

**Root Cause**: The `user_subscriptions` table doesn't have `user_id` as a unique constraint or primary key, so the upsert operation fails.

## Fix It NOW (2 minutes)

### Step 1: Go to Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query"

### Step 2: Run This SQL

Copy and paste this into the SQL Editor:

```sql
-- Add unique constraint on user_id
ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
```

### Step 3: Click "Run" ✅

### Step 4: Verify It Worked

Run this to check:

```sql
SELECT
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'user_subscriptions'::regclass;
```

You should see: `user_subscriptions_user_id_key` with type `u` (unique)

## Step 5: Test Again

Now go back to Stripe and:
1. Click "Resend" on the failed webhook event
2. Or make a new test purchase

**It should work now!** ✅

## Alternative: If You Get an Error About Duplicate Values

If the SQL fails with "duplicate key value violates unique constraint", it means you have multiple subscriptions for the same user. Fix it first:

```sql
-- Check for duplicate user_ids
SELECT user_id, COUNT(*)
FROM user_subscriptions
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Delete duplicates, keeping only the most recent
DELETE FROM user_subscriptions a
USING user_subscriptions b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Now add the constraint
ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
```

## What This Fixes

✅ Allows webhooks to upsert subscription data
✅ Prevents duplicate subscriptions for the same user
✅ Makes your webhook work properly

## After This Works

Once webhooks are working, you can:
1. Retry all failed webhook events from Stripe Dashboard
2. Fix existing paid customers who aren't in the database
3. Test new purchases to ensure everything works

---

**DO THIS NOW** - Your customers can't access paid features until this is fixed!
