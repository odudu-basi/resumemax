-- =============================================
-- Data Import Script  
-- Run this on your TARGET database to import data
-- Make sure to upload CSV files to accessible location first
-- =============================================

-- IMPORTANT: Replace 'path/to/your/csvs/' with actual CSV file paths

-- 1. Import user profiles
-- Assumes: user_profiles.csv uploaded to accessible location
COPY user_profiles (id, full_name, email, avatar_url, created_at, updated_at)
FROM '/path/to/your/csvs/user_profiles.csv'
WITH CSV HEADER;

-- 2. Import resumes  
-- Assumes: resumes.csv uploaded to accessible location
COPY resumes (id, user_id, title, file_url, content, created_at, updated_at)
FROM '/path/to/your/csvs/resumes.csv' 
WITH CSV HEADER;

-- 3. Import resume analyses
-- Assumes: resume_analyses.csv uploaded to accessible location  
COPY resume_analyses (id, resume_id, user_id, job_title, job_description, analysis_results, created_at)
FROM '/path/to/your/csvs/resume_analyses.csv'
WITH CSV HEADER;

-- =============================================
-- Alternative: Manual INSERT if COPY doesn't work
-- Use these if you can't use COPY command
-- =============================================

-- User profiles (replace with your actual data)
/*
INSERT INTO user_profiles (id, full_name, email, avatar_url, created_at, updated_at) VALUES
('uuid1', 'John Doe', 'john@example.com', null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('uuid2', 'Jane Smith', 'jane@example.com', null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
*/

-- Resumes (replace with your actual data)
/*
INSERT INTO resumes (id, user_id, title, file_url, content, created_at, updated_at) VALUES
('resume_uuid1', 'uuid1', 'Software Engineer Resume', null, '{"sections":[]}', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
*/

-- Resume analyses (replace with your actual data) 
/*
INSERT INTO resume_analyses (id, resume_id, user_id, job_title, job_description, analysis_results, created_at) VALUES
('analysis_uuid1', 'resume_uuid1', 'uuid1', 'Software Engineer', 'Job description...', '{"scores":{"overall":85}}', '2024-01-01T00:00:00Z');
*/

-- =============================================
-- Post-Import Validation
-- Run these to verify import success
-- =============================================

-- Check record counts
SELECT 'user_profiles' as table_name, COUNT(*) as record_count FROM user_profiles
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes
UNION ALL
SELECT 'resume_analyses', COUNT(*) FROM resume_analyses;

-- Check for foreign key violations
SELECT 
    'resumes_missing_users' as issue,
    COUNT(*) as count
FROM resumes r
LEFT JOIN user_profiles up ON r.user_id = up.id  
WHERE up.id IS NULL

UNION ALL

SELECT 
    'analyses_missing_users',
    COUNT(*)
FROM resume_analyses ra
LEFT JOIN user_profiles up ON ra.user_id = up.id
WHERE up.id IS NULL

UNION ALL

SELECT 
    'analyses_missing_resumes', 
    COUNT(*)
FROM resume_analyses ra
LEFT JOIN resumes r ON ra.resume_id = r.id
WHERE r.id IS NULL;

-- Update sequences (important for PostgreSQL)
-- Run this to fix auto-increment issues if you have any
SELECT setval(pg_get_serial_sequence('user_profiles', 'id'), MAX(id)) FROM user_profiles;
SELECT setval(pg_get_serial_sequence('resumes', 'id'), MAX(id)) FROM resumes;  
SELECT setval(pg_get_serial_sequence('resume_analyses', 'id'), MAX(id)) FROM resume_analyses;

-- Refresh materialized views if any
-- REFRESH MATERIALIZED VIEW your_view_name;
