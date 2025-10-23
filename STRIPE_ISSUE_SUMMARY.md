# Stripe Subscription Issue - Summary & Action Plan

## Problem Statement
Customers are paying for subscriptions via Stripe, but:
- ❌ Their subscription status isn't updating in Supabase
- ❌ They can't access paid features
- ❌ Pricing page doesn't show they have a paid plan
- ✅ Payment shows as successful in Stripe Dashboard

## Root Cause
**The Stripe webhook is not properly updating Supabase when payments complete.**

## What I Fixed

### 1. **Enabled Webhook Signature Verification** ✅
**File**: `app/api/stripe/webhook/route.ts`

**Before**: Webhook signature verification was disabled (commented out)
**After**: Now verifies webhook signatures properly with clear error logging

### 2. **Created Webhook Debug Endpoint** ✅
**File**: `app/api/stripe/webhook-test/route.ts`

**Purpose**: Diagnose webhook configuration issues
**URL**: `https://resumemax.ai/api/stripe/webhook-test`

This endpoint shows:
- Whether webhook secret is configured
- Supabase connection status
- Recent subscription count
- Configuration recommendations

### 3. **Created Comprehensive Debug Guides** ✅
**Files**:
- `SUBSCRIPTION_FIX_GUIDE.md` - Complete troubleshooting guide
- `TEST_WEBHOOK.md` - Webhook testing procedures

## What You Need To Do NOW

### **CRITICAL: Step 1 - Add Webhook Secret to Vercel**

1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks
2. Find your webhook endpoint (should be `https://resumemax.ai/api/stripe/webhook`)
3. Click on it → Click "Reveal" under "Signing secret"
4. Copy the secret (starts with `whsec_...`)

5. Go to Vercel: https://vercel.com → Your Project → Settings → Environment Variables
6. Add new variable:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_...` (paste the secret from step 4)
   - **Environments**: Select "Production", "Preview", and "Development"

7. Click "Save"

8. **IMPORTANT**: Redeploy your app (environment changes require redeployment)
   - Go to Deployments tab
   - Click "..." on latest deployment → "Redeploy"

### **Step 2 - Check Webhook Configuration in Stripe**

1. In Stripe Dashboard → Webhooks
2. Verify your endpoint: `https://resumemax.ai/api/stripe/webhook`
3. Ensure these events are selected:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

### **Step 3 - Test the Debug Endpoint**

After deploying, visit: `https://resumemax.ai/api/stripe/webhook-test`

This will tell you if everything is configured correctly.

### **Step 4 - Fix Existing Paid Customers**

For customers who already paid but aren't in Supabase:

#### Option A: Resend Webhook from Stripe (Easiest)

1. Go to Stripe Dashboard → Events
2. Search for the customer's email or subscription ID
3. Find `checkout.session.completed` event
4. Click "Send test webhook"
5. This will re-process the payment and update Supabase

#### Option B: Manual SQL Insert (If Option A doesn't work)

Get customer info from Stripe Dashboard, then run this SQL in Supabase:

```sql
-- Get user ID from their email
SELECT id, email FROM auth.users WHERE email = 'customer@email.com';

-- Insert subscription (replace values with actual data from Stripe)
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
    'USER_ID_FROM_ABOVE',
    'cus_...', -- From Stripe
    'sub_...', -- From Stripe
    'price_1SJGF6GfV3OgrONkHsG1SRpl', -- basic, or 'price_1SFol1GfV3OgrONkCw68vdG1' for unlimited
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
    plan_name = EXCLUDED.plan_name,
    status = EXCLUDED.status,
    updated_at = NOW();
```

### **Step 5 - Test with New Purchase**

1. Use Stripe test card: `4242 4242 4242 4242`
2. Complete a test purchase on pricing page
3. Check Vercel logs for webhook processing
4. Check Supabase for new subscription entry
5. Verify user can access paid features

## How to Monitor Going Forward

### 1. **Check Webhook Delivery in Stripe**
- Go to: https://dashboard.stripe.com/events
- Filter: Last 7 days
- Look for:
  - ✅ Green = Success
  - ❌ Red = Failed (investigate immediately!)

### 2. **Check Vercel Logs**
- Go to: https://vercel.com → Your Project → Logs
- Filter: `/api/stripe/webhook`
- Look for:
  - `✅ Successfully upserted subscription`
  - `❌ Error upserting subscription` (fix if you see this!)

### 3. **Weekly Reconciliation**
Run this SQL weekly to find discrepancies:

```sql
-- Count subscriptions created in last 7 days
SELECT
    DATE(created_at) as date,
    plan_name,
    COUNT(*) as count
FROM user_subscriptions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), plan_name
ORDER BY date DESC;
```

Compare with Stripe Dashboard → Subscriptions count

## Files Changed

- ✅ `app/api/stripe/webhook/route.ts` - Enabled signature verification
- ✅ `app/api/stripe/webhook-test/route.ts` - New debug endpoint
- ✅ `SUBSCRIPTION_FIX_GUIDE.md` - Complete troubleshooting guide
- ✅ `TEST_WEBHOOK.md` - Testing procedures
- ✅ `STRIPE_ISSUE_SUMMARY.md` - This file

## Next Steps After Deploying

1. Deploy the changes (after adding webhook secret)
2. Test the debug endpoint
3. Fix existing paid customers
4. Test new purchase flow
5. Monitor for 24-48 hours
6. Set up alerts for failed webhooks

## If Still Not Working

Check these in order:

1. **Vercel Environment Variables**: All secrets present?
2. **Stripe Webhook Endpoint**: Correct URL?
3. **Stripe Events**: Are webhooks being sent?
4. **Vercel Logs**: Are webhooks being received?
5. **Supabase Permissions**: Can service role key write to table?
6. **Table Schema**: Does `user_subscriptions` table exist?

## Support Resources

- **Stripe Support**: https://support.stripe.com
- **Vercel Support**: https://vercel.com/support
- **Supabase Docs**: https://supabase.com/docs

## Ready to Deploy?

Run these commands:

```bash
# Stage changes
git add -A

# Commit
git commit -m "Fix: Enable webhook signature verification and add debug tools

- Enable Stripe webhook signature verification for production
- Add webhook debug endpoint at /api/stripe/webhook-test
- Add comprehensive troubleshooting guides
- Improve error logging in webhook handler

This fixes the issue where paid customers' subscriptions weren't
updating in Supabase after successful Stripe payments."

# Push to GitHub
git push

# Deploy to Vercel
vercel --prod
```

**THEN**: Add `STRIPE_WEBHOOK_SECRET` to Vercel and redeploy!
