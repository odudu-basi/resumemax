# Supabase Storage Setup for Resume Upload

## Issue
The resume upload feature requires a Supabase Storage bucket called `resumes` to store the uploaded files.

## Setup Steps

### 1. Create Storage Bucket
1. Go to your Supabase dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Set bucket name: `resumes`
5. Make it **Public** (so users can access their resume files)
6. Click **"Create bucket"**

### 2. Set Bucket Policies
After creating the bucket, you need to set up Row Level Security (RLS) policies:

```sql
-- Allow authenticated users to upload their own resumes
INSERT INTO storage.policies (name, bucket_id, policy_role, policy_cmd, policy_definition)
VALUES (
  'Users can upload their own resumes',
  'resumes',
  'authenticated',
  'INSERT',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow authenticated users to view their own resumes
INSERT INTO storage.policies (name, bucket_id, policy_role, policy_cmd, policy_definition)
VALUES (
  'Users can view their own resumes',
  'resumes',
  'authenticated',
  'SELECT',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow authenticated users to update their own resumes
INSERT INTO storage.policies (name, bucket_id, policy_role, policy_cmd, policy_definition)
VALUES (
  'Users can update their own resumes',
  'resumes',
  'authenticated',
  'UPDATE',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow authenticated users to delete their own resumes
INSERT INTO storage.policies (name, bucket_id, policy_role, policy_cmd, policy_definition)
VALUES (
  'Users can delete their own resumes',
  'resumes',
  'authenticated',
  'DELETE',
  'auth.uid()::text = (storage.foldername(name))[1]'
);
```

### 3. Alternative: Simple Public Bucket (Less Secure)
If you want to keep it simple for now, you can make the bucket completely public:

1. In the Storage section, click on the `resumes` bucket
2. Go to **Policies** tab
3. Disable RLS for now (you can enable it later)

### 4. Test the Setup
After setting up the bucket:
1. Try uploading a resume file
2. Check the browser console for any detailed error messages
3. Verify the file appears in the Supabase Storage dashboard

## File Structure
Files will be stored with this naming pattern:
```
resume_[USER_ID]_[TIMESTAMP].[EXTENSION]
```

Example: `resume_123e4567-e89b-12d3-a456-426614174000_1699123456789.pdf`

## Troubleshooting

### Common Errors:
- **"Storage bucket not found"**: The `resumes` bucket doesn't exist
- **"Permission denied"**: RLS policies are too restrictive
- **"File size too large"**: File exceeds 5MB limit (handled in code)

### Debug Steps:
1. Check Supabase Storage dashboard for the `resumes` bucket
2. Verify bucket policies are correctly set
3. Check browser console for detailed error messages
4. Test with a small PDF file first
