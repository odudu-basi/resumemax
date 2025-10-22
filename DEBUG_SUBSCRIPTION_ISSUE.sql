-- =============================================
-- Debug Subscription Issue
-- Run these queries to diagnose subscription problems
-- =============================================

-- 1. Check if subscription tables exist
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name IN ('user_subscriptions', 'usage_tracking')
ORDER BY table_name;

-- 2. If tables exist, check for subscription data
-- (Uncomment after tables are created)

/*
-- Check all subscriptions
SELECT 
    us.user_id,
    us.plan_name,
    us.status,
    us.current_period_end,
    us.created_at
FROM user_subscriptions us
ORDER BY us.created_at DESC
LIMIT 10;

-- Check specific user subscription (replace USER_ID)
SELECT 
    us.*,
    CASE 
        WHEN us.current_period_end > NOW() THEN 'Active'
        ELSE 'Expired'
    END as subscription_status
FROM user_subscriptions us 
WHERE us.user_id = 'USER_ID_HERE';

-- Check usage tracking
SELECT 
    ut.user_id,
    ut.action_type,
    ut.month,
    ut.year,
    ut.count
FROM usage_tracking ut
ORDER BY ut.created_at DESC
LIMIT 10;
*/

-- 3. Check Stripe webhooks table (if you have one)
-- This helps debug webhook processing issues

-- 4. Test subscription function
-- (Uncomment after migration)
/*
SELECT * FROM get_user_subscription('USER_ID_HERE');
*/
