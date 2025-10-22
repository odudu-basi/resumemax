-- DEBUG: Verify Subscription Tables Were Created
-- Run these queries in Supabase SQL Editor to debug subscription recording issue

-- 1. Check if tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_subscriptions', 'usage_tracking')
ORDER BY table_name;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_subscriptions'
ORDER BY ordinal_position;

-- 3. Check if any subscription data exists
SELECT COUNT(*) as total_subscriptions FROM public.user_subscriptions;

-- 4. Check recent subscription attempts (if any data exists)
SELECT 
    us.*,
    up.email,
    created_at
FROM public.user_subscriptions us
LEFT JOIN public.user_profiles up ON us.user_id = up.id
ORDER BY us.created_at DESC
LIMIT 10;

-- 5. Check if RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('user_subscriptions', 'usage_tracking')
ORDER BY tablename, policyname;

-- 6. Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('increment_usage', 'get_user_subscription')
ORDER BY routine_name;

-- 7. Test if you can manually insert a subscription (replace with your user_id)
-- UNCOMMENT AND REPLACE 'your-user-id-here' with an actual user ID from user_profiles
/*
INSERT INTO public.user_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan_name,
    status,
    current_period_start,
    current_period_end
) VALUES (
    'your-user-id-here',  -- Replace with actual user ID
    'test_customer_123',
    'test_subscription_123',
    'unlimited',
    'active',
    NOW(),
    NOW() + INTERVAL '1 month'
) ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan_name = EXCLUDED.plan_name,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
*/

-- 8. Check user_profiles to get a real user_id for testing
SELECT id, email, created_at 
FROM public.user_profiles 
ORDER BY created_at DESC 
LIMIT 5;
