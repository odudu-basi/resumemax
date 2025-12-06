-- =====================================================
-- MIGRATION 028: Fix stripe_price_id nullable constraint
-- =====================================================
-- Date: 2025-12-06
-- Description: Make stripe_price_id nullable for Free tier users
-- The previous migration tried to alter "price_id" but the actual column is "stripe_price_id"

BEGIN;

-- Make stripe_price_id nullable
DO $$
BEGIN
    -- Check if column exists and make it nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_subscriptions'
        AND column_name = 'stripe_price_id'
    ) THEN
        -- Make the column nullable
        ALTER TABLE user_subscriptions
        ALTER COLUMN stripe_price_id DROP NOT NULL;

        RAISE NOTICE 'Made stripe_price_id nullable';
    ELSE
        RAISE NOTICE 'Column stripe_price_id does not exist';
    END IF;
END $$;

-- Verify the change
DO $$
DECLARE
    v_is_nullable TEXT;
BEGIN
    SELECT c.is_nullable INTO v_is_nullable
    FROM information_schema.columns c
    WHERE c.table_name = 'user_subscriptions'
    AND c.column_name = 'stripe_price_id';

    IF v_is_nullable = 'YES' THEN
        RAISE NOTICE 'SUCCESS: stripe_price_id is now nullable';
    ELSE
        RAISE NOTICE 'WARNING: stripe_price_id constraint may not have been updated';
    END IF;
END $$;

COMMIT;

-- End of migration 028
