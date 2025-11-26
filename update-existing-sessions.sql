-- Check current sessions to see what job_title and company_name values exist
SELECT 
    id,
    job_url,
    job_title,
    company_name,
    status,
    created_at
FROM auto_apply_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Update existing sessions with extracted info from job_url
-- This is a manual approach - you can run this to see what URLs you have
-- and then manually update them with the correct job titles and company names

-- Example updates (replace with your actual data):
-- UPDATE auto_apply_sessions 
-- SET 
--     job_title = 'Software Engineer',
--     company_name = 'Google'
-- WHERE job_url LIKE '%google.com%' AND job_title IS NULL;

-- UPDATE auto_apply_sessions 
-- SET 
--     job_title = 'Frontend Developer', 
--     company_name = 'Meta'
-- WHERE job_url LIKE '%meta.com%' AND job_title IS NULL;

-- You can add more UPDATE statements based on the URLs you see in the SELECT results
