# Database Structure Fix - Migration 007

## Problem
The database had incorrect structure where each table was creating separate UUID `id` columns in addition to `user_id`. This created unnecessary complexity and multiple UUIDs per user.

## Solution
**Migration 007** restructures all tables to use `user_id` as the primary key, eliminating separate `id` columns.

## Fixed Table Structure

### Before (❌ Incorrect)
```sql
user_profiles:
- id: UUID (primary key) 
- user_id: UUID (foreign key)
- other_fields...

work_authorization:
- id: UUID (primary key)
- user_id: UUID (foreign key) 
- other_fields...
```

### After (✅ Correct)
```sql
user_profiles:
- user_id: UUID (primary key, foreign key to auth.users)
- other_fields...

work_authorization:
- user_id: UUID (primary key, foreign key to auth.users)
- other_fields...
```

## Tables Fixed
1. `user_profiles`
2. `work_authorization` 
3. `job_search_criteria`
4. `experience_education`
5. `skills_certifications`
6. `language_skills`
7. `application_preferences`

## Changes Made

### 1. Migration Script (`migration-007-fix-table-structure.sql`)
- Removes `id` columns from all tables
- Sets `user_id` as primary key
- Adds proper foreign key constraints to `auth.users(id)`
- Enables RLS and creates policies
- Includes verification steps

### 2. Code Updates
- **OnboardingContext**: Updated all `upsert` operations to use `onConflict: 'user_id'`
- **Dashboard**: Updated profile save logic to use `user_id` as conflict resolution

### 3. Benefits
- **Single UUID per user**: Only `user_id` exists, referencing `auth.users(id)`
- **Simplified queries**: Direct relationship between user and their data
- **Better performance**: No unnecessary joins or lookups
- **Cleaner architecture**: One-to-one relationship between user and profile data

## How to Apply

1. **Run Migration**: Copy `migration-007-fix-table-structure.sql` into Supabase SQL Editor
2. **Execute**: Click "Run" to apply all changes
3. **Verify**: Check the verification output to ensure all tables are correctly structured

## Verification
The migration includes automatic verification that checks:
- ✅ `id` columns are removed
- ✅ `user_id` is set as primary key  
- ✅ Foreign key constraints exist
- ✅ RLS policies are in place

After running this migration, each user will have exactly one UUID (`user_id`) that connects all their data across all tables.
