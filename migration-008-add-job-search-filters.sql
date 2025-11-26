-- =====================================================
-- MIGRATION 008: Add job search filters table
-- =====================================================
-- Date: 2024-10-31
-- Description: Create table to store user's job search filter preferences

BEGIN;

-- Create job_search_filters table
CREATE TABLE IF NOT EXISTS job_search_filters (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT,
    pay_min INTEGER,
    pay_max INTEGER,
    city TEXT,
    flexibility TEXT,
    experience TEXT,
    sponsorship TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_search_filters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own job_search_filters" 
ON job_search_filters FOR ALL 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_search_filters_user_id ON job_search_filters(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_search_filters_updated_at 
    BEFORE UPDATE ON job_search_filters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_search_filters'
ORDER BY ordinal_position;
