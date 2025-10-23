# Webhook Debugging & Testing Guide

## Immediate Action Items

### 1. Check Vercel Environment Variables

Go to: https://vercel.com → Your Project → Settings → Environment Variables

**Verify these are set:**
- ✅ `STRIPE_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
- ✅ `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (for webhook to write to DB)
- ✅ `NEXT_PUBLIC_SUPABASE_URL`

**CRITICAL**: If `STRIPE_WEBHOOK_SECRET` is missing, webhooks won't work!

### 2. Get Your Webhook Secret from Stripe

1. Go to https://dashboard.stripe.com/webhooks
2. Find your webhook endpoint: `https://resumemax.ai/api/stripe/webhook` (or similar)
3. Click on it
4. Click "Reveal" under "Signing secret"
5. Copy the secret (starts with `whsec_...`)
6. Add it to Vercel environment variables
7. **Redeploy** after adding (environment changes require redeployment)

### 3. Check Stripe Webhook Events

1. Go to https://dashboard.stripe.com/events
2. Search for recent events from your paid customers
3. Look for events with status:
   - ✅ **Succeeded** = Webhook was delivered successfully
   - ❌ **Failed** = Webhook delivery failed (THIS IS YOUR PROBLEM)
   - ⏳ **Pending** = Still trying to deliver

### 4. Check Vercel Logs

1. Go to https://vercel.com → Your Project → Logs
2. Filter by `/api/stripe/webhook`
3. Look for:
   - ✅ Success logs: `✅ Webhook processed successfully`
   - ❌ Error logs: `❌ Error upserting subscription`
   - ⚠️ Missing logs = Webhook isn't being called at all

## Quick Test: Resend Webhook from Stripe

For customers who already paid but aren't in Supabase:

1. Go to Stripe Dashboard → Events
2. Find the customer's `checkout.session.completed` event
3. Click the event
4. Click "Send test webhook" button
5. This will retry the webhook with the same data
6. Check Vercel logs to see if it processes

## Manual SQL Fix for Existing Paid Customers

If you need to fix customers immediately while debugging webhooks:

### Step 1: Get Customer Info from Stripe

Go to Stripe Dashboard → Customers → Find the customer

Note:
- Customer ID (starts with `cus_`)
- Subscription ID (starts with `sub_`)
- Price ID (`price_1SJGF6GfV3OgrONkHsG1SRpl` or `price_1SFol1GfV3OgrONkCw68vdG1`)

### Step 2: Get User ID from Supabase

Go to Supabase SQL Editor and run:

```sql
-- Find user by email
SELECT id, email FROM auth.users WHERE email = 'customer@email.com';
```

### Step 3: Insert Subscription Manually

```sql
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
    'USER_ID_FROM_STEP_2',
    'cus_FROM_STRIPE',
    'sub_FROM_STRIPE',
    'price_1SJGF6GfV3OgrONkHsG1SRpl', -- basic plan, or use 'price_1SFol1GfV3OgrONkCw68vdG1' for unlimited
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

### Step 4: Verify

```sql
SELECT * FROM user_subscriptions WHERE user_id = 'USER_ID';
```

## Webhook Delivery Troubleshooting

### Common Issues

#### Issue 1: Webhook Secret Mismatch
**Symptoms**: All webhooks fail with signature error
**Fix**: Make sure `STRIPE_WEBHOOK_SECRET` in Vercel matches Stripe Dashboard

#### Issue 2: Webhook Endpoint Not Found
**Symptoms**: Stripe shows 404 errors
**Fix**: Verify endpoint URL is exactly: `https://your-domain.com/api/stripe/webhook`

#### Issue 3: Supabase Write Permissions
**Symptoms**: Webhook receives event but can't write to database
**Fix**: Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not the anon key!)

#### Issue 4: Metadata Missing
**Symptoms**: Webhook logs show "No supabase_user_id in metadata"
**Fix**: This is set during checkout - check `/api/stripe/checkout/route.ts`

## Test Webhook Locally

You can test webhooks locally using Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

Watch your local terminal for webhook logs!

## Production Debugging Checklist

- [ ] `STRIPE_WEBHOOK_SECRET` is set in Vercel environment variables
- [ ] Webhook endpoint is configured in Stripe Dashboard
- [ ] Webhook endpoint URL is correct in Stripe
- [ ] All required events are selected in Stripe webhook settings
- [ ] Vercel deployment happened after adding environment variables
- [ ] Stripe events show "Succeeded" for recent webhooks
- [ ] Vercel logs show successful webhook processing
- [ ] Supabase `user_subscriptions` table has recent entries
- [ ] Test purchase completes successfully and updates Supabase

## Still Not Working?

### Create a Webhook Debug Endpoint

Add this file: `app/api/stripe/webhook-test/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/src/lib/env';

export async function GET(request: NextRequest) {
  const config = getConfig();

  return NextResponse.json({
    hasWebhookSecret: !!config.stripe.webhookSecret,
    webhookSecretPreview: config.stripe.webhookSecret?.substring(0, 10) + '...',
    hasStripeKey: !!config.stripe.secretKey,
    hasSupabaseKey: !!config.supabase.serviceRoleKey,
    environment: process.env.NODE_ENV,
  });
}
```

Visit: `https://resumemax.ai/api/stripe/webhook-test`

This will tell you if your environment variables are loaded correctly!

## Contact Support

If still stuck after trying everything:

1. Check Stripe Support: https://support.stripe.com
2. Check Vercel Support: https://vercel.com/support
3. Share:
   - Stripe Event ID (from Events page)
   - Vercel deployment URL
   - Error logs from Vercel
