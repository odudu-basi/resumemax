# Subscription Payment Issue - Diagnostic & Fix Guide

## Problem
Customers pay via Stripe but their subscription doesn't update in Supabase, and they can't access paid features.

## Root Causes Identified

### 1. **Webhook Signature Verification Disabled**
**Location**: `app/api/stripe/webhook/route.ts` lines 34-43

**Issue**: The webhook is currently skipping Stripe's signature verification:
```typescript
// For now, we'll skip webhook signature verification during development
event = JSON.parse(body);
```

**Impact**:
- In production, Stripe may be rejecting or not sending webhooks properly
- Webhooks might not be configured correctly in Stripe dashboard

### 2. **Missing Webhook Secret**
The code expects `config.stripe.webhookSecret` but it's commented out.

## Step-by-Step Fix

### **Step 1: Check Stripe Webhook Configuration**

1. Go to https://dashboard.stripe.com/webhooks
2. Check if you have a webhook endpoint configured
3. The endpoint should be: `https://resumemax.ai/api/stripe/webhook`
4. Required events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### **Step 2: Get Webhook Signing Secret**

1. In Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click "Reveal" under "Signing secret"
4. Copy the secret (starts with `whsec_...`)

### **Step 3: Add Webhook Secret to Environment**

Add to your `.env.local` and Vercel environment variables:
```
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### **Step 4: Check Supabase Tables**

Run this SQL in your Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name IN ('user_subscriptions', 'usage_tracking')
ORDER BY table_name;

-- Check subscription data
SELECT
    user_id,
    plan_name,
    status,
    stripe_subscription_id,
    current_period_end,
    created_at,
    updated_at
FROM user_subscriptions
ORDER BY created_at DESC
LIMIT 10;
```

### **Step 5: Test a Paid Customer**

Find a customer who paid. Run this SQL (replace with actual user_id):

```sql
SELECT
    us.*,
    CASE
        WHEN us.status = 'active' AND us.current_period_end > NOW() THEN 'Should Have Access'
        WHEN us.status = 'active' AND us.current_period_end <= NOW() THEN 'Expired'
        WHEN us.status != 'active' THEN 'Inactive: ' || us.status
        ELSE 'No Subscription'
    END as access_status
FROM user_subscriptions us
WHERE us.user_id = 'USER_ID_HERE';
```

### **Step 6: Check Stripe Events**

1. Go to https://dashboard.stripe.com/events
2. Filter by customer or subscription ID
3. Check if webhook events were sent successfully
4. Look for:
   - ✅ Green checkmark = Success
   - ❌ Red X = Failed
   - ⚠️ Yellow = Retry

### **Step 7: Manual Webhook Retry (Quick Fix)**

If webhooks failed, you can resend them:

1. In Stripe Dashboard → Events
2. Find the `checkout.session.completed` event for the paid customer
3. Click "Send test webhook" or "Resend"
4. This will trigger your webhook handler manually

## Quick Manual Fix for Existing Paid Customers

If customers already paid but data isn't in Supabase, run this SQL:

```sql
-- Get customer's Stripe subscription ID from Stripe dashboard
-- Then insert/update manually:

INSERT INTO user_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    plan_name,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
) VALUES (
    'USER_ID_FROM_AUTH_USERS_TABLE',
    'cus_...', -- From Stripe dashboard
    'sub_...', -- From Stripe dashboard
    'price_1SJGF6GfV3OgrONkHsG1SRpl', -- or 'price_1SFol1GfV3OgrONkCw68vdG1' for unlimited
    'basic', -- or 'unlimited'
    'active',
    NOW(),
    NOW() + INTERVAL '1 month',
    false,
    NOW(),
    NOW()
)
ON CONFLICT (user_id)
DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    plan_name = EXCLUDED.plan_name,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
```

## Code Fixes Needed

### Fix 1: Enable Webhook Signature Verification

Update `app/api/stripe/webhook/route.ts`:

```typescript
// BEFORE (lines 34-43):
event = JSON.parse(body);

// AFTER:
if (!config.stripe.webhookSecret) {
  console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
  return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
}

event = stripe.webhooks.constructEvent(
  body,
  signature,
  config.stripe.webhookSecret
);
```

### Fix 2: Add Webhook Secret to env config

Update `src/lib/env.ts`:

```typescript
stripe: {
  secretKey: process.env.STRIPE_SECRET_KEY!,
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!, // ← Add this
},
```

### Fix 3: Add Logging to Webhook Handler

Add more detailed logging to catch errors:

```typescript
console.log('🔍 Webhook Details:', {
  eventType: event.type,
  eventId: event.id,
  customerId: (event.data.object as any).customer,
  subscriptionId: (event.data.object as any).subscription,
  metadata: (event.data.object as any).metadata
});
```

## Testing After Fix

1. **Test with Stripe CLI** (local testing):
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

2. **Test in production**:
   - Make a test purchase with Stripe test card: `4242 4242 4242 4242`
   - Check Vercel logs for webhook processing
   - Verify data in Supabase

## Monitoring Going Forward

1. **Set up Stripe webhook monitoring**:
   - Enable email notifications for failed webhooks in Stripe dashboard

2. **Add logging to your app**:
   - Log all webhook events to a table
   - Alert on failed webhook processing

3. **Regular checks**:
   - Weekly review of Stripe events vs Supabase subscriptions
   - Automated script to reconcile differences

## Emergency Contact Points

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Vercel Logs**: https://vercel.com/dashboard → Your Project → Logs

## Next Steps

1. ✅ Check Stripe webhook configuration (Step 1)
2. ✅ Add webhook secret to environment (Steps 2-3)
3. ✅ Verify Supabase tables (Step 4)
4. ✅ Test with a paid customer (Step 5)
5. ✅ Check Stripe events (Step 6)
6. ✅ Manually fix existing customers if needed (Quick Manual Fix)
7. ✅ Deploy code fixes (Fixes 1-3)
8. ✅ Test end-to-end (Testing section)
