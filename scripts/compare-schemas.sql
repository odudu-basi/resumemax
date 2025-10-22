-- =============================================
-- Schema Comparison Script
-- Run this on both databases to compare structures
-- =============================================

-- 1. List all tables
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. List all columns for each table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. List foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. List indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Count records in each table (run this to see data volume)
DO $$
DECLARE
    r RECORD;
    table_count INTEGER;
BEGIN
    FOR r IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || quote_ident(r.table_name) INTO table_count;
        RAISE NOTICE 'Table %: % records', r.table_name, table_count;
    END LOOP;
END $$;
