-- Migration 012: Add auto-apply preferences table
-- This migration creates a table to store user auto-apply preferences

-- Create auto_apply_preferences table
CREATE TABLE IF NOT EXISTS auto_apply_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    auto_apply_enabled BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auto_apply_preferences_user_id ON auto_apply_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE auto_apply_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own auto-apply preferences" 
ON auto_apply_preferences FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto-apply preferences" 
ON auto_apply_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-apply preferences" 
ON auto_apply_preferences FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto-apply preferences" 
ON auto_apply_preferences FOR DELETE 
USING (auth.uid() = user_id);

-- Verification
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auto_apply_preferences') THEN
        RAISE NOTICE '✅ auto_apply_preferences table created successfully';
        
        -- Check columns
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auto_apply_preferences' AND column_name = 'auto_apply_enabled') THEN
            RAISE NOTICE '✅ auto_apply_enabled column exists';
        END IF;
        
        -- Check RLS is enabled
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'auto_apply_preferences' AND rowsecurity = true) THEN
            RAISE NOTICE '✅ RLS enabled on auto_apply_preferences';
        END IF;
        
    ELSE
        RAISE EXCEPTION '❌ auto_apply_preferences table was not created';
    END IF;
END $$;
