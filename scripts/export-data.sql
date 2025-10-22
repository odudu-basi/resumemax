-- =============================================
-- Data Export Script
-- Run this on your SOURCE database to export data
-- Save each result set as a CSV file
-- =============================================

-- IMPORTANT: Run these queries one by one and save results as CSV

-- 1. Export user profiles
-- Save as: user_profiles.csv
SELECT 
    id,
    full_name,
    email,
    avatar_url,
    created_at,
    updated_at
FROM user_profiles
ORDER BY created_at;

-- 2. Export resumes
-- Save as: resumes.csv
SELECT 
    id,
    user_id,
    title,
    file_url,
    content,
    created_at,
    updated_at
FROM resumes
ORDER BY created_at;

-- 3. Export resume analyses
-- Save as: resume_analyses.csv
SELECT 
    id,
    resume_id,
    user_id,
    job_title,
    job_description,
    analysis_results,
    created_at
FROM resume_analyses
ORDER BY created_at;

-- 4. Export auth users (if you have access to auth.users)
-- Save as: auth_users.csv
-- Note: This may require special permissions
SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM auth.users
ORDER BY created_at;

-- =============================================
-- Data Validation Queries
-- Use these to verify export completeness
-- =============================================

-- Check record counts
SELECT 'user_profiles' as table_name, COUNT(*) as record_count FROM user_profiles
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes
UNION ALL  
SELECT 'resume_analyses', COUNT(*) FROM resume_analyses
UNION ALL
SELECT 'auth_users', COUNT(*) FROM auth.users;

-- Check date ranges
SELECT 
    'user_profiles' as table_name,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) as total_records
FROM user_profiles
UNION ALL
SELECT 
    'resumes',
    MIN(created_at),
    MAX(created_at),
    COUNT(*)
FROM resumes
UNION ALL
SELECT 
    'resume_analyses',
    MIN(created_at),
    MAX(created_at), 
    COUNT(*)
FROM resume_analyses;

-- Check for orphaned records
SELECT 
    'orphaned_resumes' as check_name,
    COUNT(*) as count
FROM resumes r
LEFT JOIN user_profiles up ON r.user_id = up.id
WHERE up.id IS NULL

UNION ALL

SELECT 
    'orphaned_analyses',
    COUNT(*)
FROM resume_analyses ra
LEFT JOIN user_profiles up ON ra.user_id = up.id  
WHERE up.id IS NULL

UNION ALL

SELECT 
    'orphaned_analyses_resumes',
    COUNT(*)
FROM resume_analyses ra
LEFT JOIN resumes r ON ra.resume_id = r.id
WHERE r.id IS NULL;
