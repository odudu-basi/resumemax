-- Subscription Tracking Schema for Auto-Apply Usage
-- This schema tracks user subscriptions and auto-apply usage

-- Create subscriptions table to track user subscription details
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    plan_name TEXT NOT NULL, -- 'Basic', 'Student', 'Desperate'
    plan_type TEXT NOT NULL, -- 'weekly', 'monthly'
    price_id TEXT NOT NULL, -- Stripe price ID
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due', 'incomplete'
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    auto_apply_limit INTEGER NOT NULL, -- Number of auto-applies allowed per period
    auto_apply_used INTEGER DEFAULT 0, -- Number of auto-applies used in current period
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id) -- One active subscription per user
);

-- Create auto_apply_usage table to track individual auto-apply attempts
CREATE TABLE IF NOT EXISTS auto_apply_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL, -- Job identifier from the job board
    job_title TEXT,
    company_name TEXT,
    job_url TEXT,
    application_status TEXT NOT NULL, -- 'success', 'failed', 'pending'
    error_message TEXT, -- If application failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate applications to same job
    UNIQUE(user_id, job_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_auto_apply_usage_user_id ON auto_apply_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_usage_subscription_id ON auto_apply_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_usage_created_at ON auto_apply_usage(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for auto_apply_usage
CREATE POLICY "Users can view their own usage" ON auto_apply_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" ON auto_apply_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to check if user has remaining auto-apply credits
CREATE OR REPLACE FUNCTION check_auto_apply_credits(p_user_id UUID)
RETURNS TABLE(
    has_credits BOOLEAN,
    credits_remaining INTEGER,
    credits_limit INTEGER,
    plan_name TEXT,
    period_end TIMESTAMP WITH TIME ZONE
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
        us.status
    INTO subscription_record
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.current_period_end > NOW()
    LIMIT 1;
    
    -- If no active subscription found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN as has_credits,
            0::INTEGER as credits_remaining,
            0::INTEGER as credits_limit,
            ''::TEXT as plan_name,
            NULL::TIMESTAMP WITH TIME ZONE as period_end;
        RETURN;
    END IF;
    
    -- Calculate remaining credits
    RETURN QUERY SELECT 
        (subscription_record.auto_apply_used < subscription_record.auto_apply_limit)::BOOLEAN as has_credits,
        (subscription_record.auto_apply_limit - subscription_record.auto_apply_used)::INTEGER as credits_remaining,
        subscription_record.auto_apply_limit::INTEGER as credits_limit,
        subscription_record.plan_name::TEXT as plan_name,
        subscription_record.current_period_end::TIMESTAMP WITH TIME ZONE as period_end;
END;
$$;

-- Function to consume an auto-apply credit
CREATE OR REPLACE FUNCTION consume_auto_apply_credit(
    p_user_id UUID,
    p_job_id TEXT,
    p_job_title TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_job_url TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    credits_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_record RECORD;
    new_usage_count INTEGER;
BEGIN
    -- Get active subscription for user
    SELECT 
        id,
        auto_apply_limit,
        auto_apply_used,
        plan_name
    INTO subscription_record
    FROM user_subscriptions
    WHERE user_id = p_user_id 
    AND status = 'active'
    AND current_period_end > NOW()
    LIMIT 1;
    
    -- If no active subscription found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN as success,
            'No active subscription found'::TEXT as message,
            0::INTEGER as credits_remaining;
        RETURN;
    END IF;
    
    -- Check if user has credits remaining
    IF subscription_record.auto_apply_used >= subscription_record.auto_apply_limit THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN as success,
            'No auto-apply credits remaining'::TEXT as message,
            0::INTEGER as credits_remaining;
        RETURN;
    END IF;
    
    -- Check if user already applied to this job
    IF EXISTS (
        SELECT 1 FROM auto_apply_usage 
        WHERE user_id = p_user_id AND job_id = p_job_id
    ) THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN as success,
            'Already applied to this job'::TEXT as message,
            (subscription_record.auto_apply_limit - subscription_record.auto_apply_used)::INTEGER as credits_remaining;
        RETURN;
    END IF;
    
    -- Consume credit: increment usage count
    UPDATE user_subscriptions 
    SET 
        auto_apply_used = auto_apply_used + 1,
        updated_at = NOW()
    WHERE id = subscription_record.id;
    
    -- Record the usage
    INSERT INTO auto_apply_usage (
        user_id,
        subscription_id,
        job_id,
        job_title,
        company_name,
        job_url,
        application_status
    ) VALUES (
        p_user_id,
        subscription_record.id,
        p_job_id,
        p_job_title,
        p_company_name,
        p_job_url,
        'pending'
    );
    
    -- Calculate new remaining credits
    new_usage_count := subscription_record.auto_apply_used + 1;
    
    RETURN QUERY SELECT 
        TRUE::BOOLEAN as success,
        'Credit consumed successfully'::TEXT as message,
        (subscription_record.auto_apply_limit - new_usage_count)::INTEGER as credits_remaining;
END;
$$;

-- Function to update auto-apply status after attempt
CREATE OR REPLACE FUNCTION update_auto_apply_status(
    p_user_id UUID,
    p_job_id TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auto_apply_usage 
    SET 
        application_status = p_status,
        error_message = p_error_message
    WHERE user_id = p_user_id AND job_id = p_job_id;
    
    RETURN FOUND;
END;
$$;

-- Function to reset usage count at period renewal
CREATE OR REPLACE FUNCTION reset_auto_apply_usage(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_subscriptions 
    SET 
        auto_apply_used = 0,
        updated_at = NOW()
    WHERE id = p_subscription_id;
    
    RETURN FOUND;
END;
$$;

-- Function to get user's subscription status and usage
CREATE OR REPLACE FUNCTION get_user_subscription_status(p_user_id UUID)
RETURNS TABLE(
    subscription_id UUID,
    plan_name TEXT,
    plan_type TEXT,
    status TEXT,
    auto_apply_limit INTEGER,
    auto_apply_used INTEGER,
    credits_remaining INTEGER,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id as subscription_id,
        us.plan_name,
        us.plan_type,
        us.status,
        us.auto_apply_limit,
        us.auto_apply_used,
        (us.auto_apply_limit - us.auto_apply_used) as credits_remaining,
        us.current_period_start,
        us.current_period_end,
        EXTRACT(DAY FROM (us.current_period_end - NOW()))::INTEGER as days_remaining
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$;

-- Sample data for testing (remove in production)
-- INSERT INTO user_subscriptions (
--     user_id,
--     stripe_subscription_id,
--     stripe_customer_id,
--     plan_name,
--     plan_type,
--     price_id,
--     auto_apply_limit,
--     current_period_start,
--     current_period_end
-- ) VALUES (
--     'sample-user-id',
--     'sub_sample123',
--     'cus_sample123',
--     'Student',
--     'weekly',
--     'price_1SOBxFGfV3OgrONkjWcGYa7k',
--     20,
--     NOW(),
--     NOW() + INTERVAL '7 days'
-- );

COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription plans and auto-apply limits';
COMMENT ON TABLE auto_apply_usage IS 'Records individual auto-apply attempts and their outcomes';
COMMENT ON FUNCTION check_auto_apply_credits(UUID) IS 'Checks if user has remaining auto-apply credits';
COMMENT ON FUNCTION consume_auto_apply_credit(UUID, TEXT, TEXT, TEXT, TEXT) IS 'Consumes one auto-apply credit and records usage';
COMMENT ON FUNCTION update_auto_apply_status(UUID, TEXT, TEXT, TEXT) IS 'Updates the status of an auto-apply attempt';
COMMENT ON FUNCTION get_user_subscription_status(UUID) IS 'Gets comprehensive subscription status for a user';
