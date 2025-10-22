# 🔍 Webhook Debug Plan

## Step 1: Verify Tables Were Created

Run these queries in **Supabase SQL Editor**:

```sql
-- Check if tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_subscriptions', 'usage_tracking')
ORDER BY table_name;

-- Check subscription count
SELECT COUNT(*) as total_subscriptions FROM public.user_subscriptions;
```

## Step 2: Check Stripe Webhook Configuration

1. **Go to Stripe Dashboard → Developers → Webhooks**
2. **Find your webhook endpoint**: `https://resumemax.ai/api/stripe/webhook`
3. **Check events being sent**: Should include:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
4. **Check webhook logs** for any failed attempts

## Step 3: Test a Manual Payment

1. **Make a test payment** (you can refund immediately)
2. **Check webhook logs in Stripe** - do you see any attempts?
3. **Check Vercel function logs** - any webhook calls received?

## Step 4: Key Issues I Found

### Issue 1: Webhook Signature Disabled
```typescript
// Line 33-35 in webhook/route.ts
// Webhook signature verification is DISABLED!
event = JSON.parse(body);  // ← This is not secure
```

### Issue 2: Missing User Metadata
```typescript
// Line 100: Looking for userId in session metadata
const userId = session.metadata?.userId;
// ⚠️ This might not be set during checkout
```

### Issue 3: Upsert Conflict Resolution
```typescript
// Line 188: Using wrong conflict field
.upsert(subscriptionData, {
  onConflict: 'stripe_subscription_id',  // ← Should be 'user_id'
})
```

## Next Steps

1. **Run the debugging queries above**
2. **Check Stripe webhook logs**
3. **Let me know what you find**
4. **I'll fix the webhook code based on results**
