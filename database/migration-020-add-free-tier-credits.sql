-- =====================================================
-- MIGRATION 020: Add Free Tier Credit System (FIXED v3)
-- =====================================================
-- Date: 2025-12-05
-- Description: Add support for free tier users with 5 monthly applications
-- This version checks if columns exist before altering them

BEGIN;

-- Step 1: Check and modify column constraints
DO $$
BEGIN
    -- Make plan_type nullable if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE user_subscriptions ALTER COLUMN plan_type DROP NOT NULL;
        RAISE NOTICE 'Made plan_type nullable';
    ELSE
        RAISE NOTICE 'Column plan_type does not exist, skipping';
    END IF;

    -- Make price_id nullable if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' AND column_name = 'price_id'
    ) THEN
        ALTER TABLE user_subscriptions ALTER COLUMN price_id DROP NOT NULL;
        RAISE NOTICE 'Made price_id nullable';
    ELSE
        RAISE NOTICE 'Column price_id does not exist, skipping';
    END IF;
END $$;

-- Step 2: Drop existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS check_auto_apply_credits(UUID);

-- Step 3: Create function to initialize free tier subscription
CREATE OR REPLACE FUNCTION initialize_free_tier_subscription(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_id UUID;
    existing_sub_id UUID;
    has_plan_type BOOLEAN;
    has_price_id BOOLEAN;
BEGIN
    -- Check if user already has a subscription
    SELECT id INTO existing_sub_id
    FROM user_subscriptions
    WHERE user_id = p_user_id
    AND status = 'active'
    LIMIT 1;

    -- If subscription exists, return it
    IF existing_sub_id IS NOT NULL THEN
        RETURN existing_sub_id;
    END IF;

    -- Check which columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' AND column_name = 'plan_type'
    ) INTO has_plan_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' AND column_name = 'price_id'
    ) INTO has_price_id;

    -- Create free tier subscription with dynamic SQL based on available columns
    IF has_plan_type AND has_price_id THEN
        -- Both columns exist
        INSERT INTO user_subscriptions (
            user_id,
            stripe_subscription_id,
            stripe_customer_id,
            plan_name,
            plan_type,
            price_id,
            status,
            auto_apply_limit,
            auto_apply_used,
            current_period_start,
            current_period_end
        ) VALUES (
            p_user_id,
            NULL,
            NULL,
            'Free',
            'monthly',
            'free',
            'active',
            5,
            0,
            NOW(),
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO subscription_id;
    ELSE
        -- Columns don't exist, use minimal insert
        INSERT INTO user_subscriptions (
            user_id,
            stripe_subscription_id,
            stripe_customer_id,
            plan_name,
            status,
            auto_apply_limit,
            auto_apply_used,
            current_period_start,
            current_period_end
        ) VALUES (
            p_user_id,
            NULL,
            NULL,
            'Free',
            'active',
            5,
            0,
            NOW(),
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO subscription_id;
    END IF;

    RETURN subscription_id;
END;
$$;

-- Step 4: Recreate check_auto_apply_credits function
CREATE OR REPLACE FUNCTION check_auto_apply_credits(p_user_id UUID)
RETURNS TABLE(
    has_credits BOOLEAN,
    credits_remaining INTEGER,
    credits_limit INTEGER,
    plan_name TEXT,
    period_end TIMESTAMP WITH TIME ZONE,
    is_free_tier BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_record RECORD;
BEGIN
    -- Get active subscription for user
    SELECT
        us.auto_apply_limit,
        us.auto_apply_used,
        us.plan_name,
        us.current_period_end,
        us.status,
        us.stripe_subscription_id
    INTO subscription_record
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.current_period_end > NOW()
    ORDER BY us.created_at DESC
    LIMIT 1;

    -- If no active subscription found, create free tier
    IF NOT FOUND THEN
        PERFORM initialize_free_tier_subscription(p_user_id);

        -- Fetch the newly created subscription
        SELECT
            us.auto_apply_limit,
            us.auto_apply_used,
            us.plan_name,
            us.current_period_end,
            us.status,
            us.stripe_subscription_id
        INTO subscription_record
        FROM user_subscriptions us
        WHERE us.user_id = p_user_id
        AND us.status = 'active'
        ORDER BY us.created_at DESC
        LIMIT 1;
    END IF;

    -- Calculate remaining credits
    RETURN QUERY SELECT
        (subscription_record.auto_apply_used < subscription_record.auto_apply_limit)::BOOLEAN as has_credits,
        (subscription_record.auto_apply_limit - subscription_record.auto_apply_used)::INTEGER as credits_remaining,
        subscription_record.auto_apply_limit::INTEGER as credits_limit,
        subscription_record.plan_name::TEXT as plan_name,
        subscription_record.current_period_end::TIMESTAMP WITH TIME ZONE as period_end,
        (subscription_record.stripe_subscription_id IS NULL)::BOOLEAN as is_free_tier;
END;
$$;

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_name ON user_subscriptions(plan_name);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

-- Step 6: Initialize free tier for existing users
DO $$
DECLARE
    user_record RECORD;
    new_sub_id UUID;
    count_created INTEGER := 0;
BEGIN
    FOR user_record IN
        SELECT id FROM auth.users
        WHERE id NOT IN (
            SELECT user_id FROM user_subscriptions WHERE status = 'active'
        )
    LOOP
        BEGIN
            new_sub_id := initialize_free_tier_subscription(user_record.id);
            count_created := count_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create subscription for user %: %', user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Created % free tier subscriptions', count_created;
END $$;

-- Step 7: Add comments
COMMENT ON FUNCTION initialize_free_tier_subscription(UUID) IS 'Creates a free tier subscription with 5 monthly applications';
COMMENT ON FUNCTION check_auto_apply_credits(UUID) IS 'Checks user credits and auto-creates free tier if needed';

-- Step 8: Verification
DO $$
DECLARE
    free_tier_count INTEGER;
    total_subs INTEGER;
BEGIN
    SELECT COUNT(*) INTO free_tier_count
    FROM user_subscriptions
    WHERE plan_name = 'Free';
    
    SELECT COUNT(*) INTO total_subs
    FROM user_subscriptions
    WHERE status = 'active';

    RAISE NOTICE 'Migration 020 completed! Free tier: % / Total active: %', free_tier_count, total_subs;
END $$;

COMMIT;

-- End of migration 020
