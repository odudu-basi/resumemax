-- =============================================
-- Migration 003: Fix Missing Subscription Tables
-- Purpose: Add subscription tables that were missing from production database
-- This fixes the issue where paid users still see paywalls
-- =============================================

-- First, check if tables already exist to avoid errors
DO $$ 
BEGIN
    -- Drop existing tables if they exist (to handle partial migrations)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
        DROP TABLE user_subscriptions CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
        DROP TABLE usage_tracking CASCADE;
    END IF;
END $$;

-- =============================================
-- User Subscriptions Table
-- =============================================
CREATE TABLE user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT NOT NULL,
  plan_name TEXT NOT NULL, -- 'free', 'basic', 'unlimited'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions" ON user_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- Usage Tracking Table
-- =============================================
CREATE TABLE usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'resume_analysis', 'resume_creation', etc.
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, action_type, month, year)
);

-- Enable RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage" ON usage_tracking
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_user_month_year ON usage_tracking(user_id, month, year);

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE TRIGGER update_user_subscriptions_updated_at 
  BEFORE UPDATE ON user_subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at 
  BEFORE UPDATE ON usage_tracking 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Helper Functions for Subscriptions
-- =============================================

-- Function to increment usage tracking
CREATE OR REPLACE FUNCTION increment_usage(
  user_uuid UUID,
  action TEXT
)
RETURNS void AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
BEGIN
  INSERT INTO usage_tracking (user_id, action_type, month, year, count)
  VALUES (user_uuid, action, current_month, current_year, 1)
  ON CONFLICT (user_id, action_type, month, year)
  DO UPDATE SET 
    count = usage_tracking.count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current subscription
CREATE OR REPLACE FUNCTION get_user_subscription(user_uuid UUID)
RETURNS TABLE (
  plan_name TEXT,
  status TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.plan_name,
    us.status,
    us.current_period_end
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Migration Complete
-- =============================================
-- This migration adds the missing subscription tables that are required
-- for the paywall functionality to work correctly for paid users.
-- After running this migration, paid users should no longer see paywalls.
