-- Migration 011: Add parsed resume data column to user_profiles table
-- This stores the structured data extracted from resumes by ChatGPT

-- Add parsed_resume_data column to store structured resume information
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS parsed_resume_data JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN user_profiles.parsed_resume_data IS 'Structured resume data parsed by ChatGPT including experience, skills, education, etc.';

-- Create an index on the JSONB column for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_parsed_resume_data 
ON user_profiles USING GIN (parsed_resume_data);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'parsed_resume_data';

-- Example of how the parsed_resume_data will be structured:
/*
{
  "personalInfo": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-0123",
    "location": "San Francisco, CA",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "portfolioUrl": "https://johndoe.dev"
  },
  "experience": [
    {
      "company": "Tech Corp",
      "title": "Senior Software Engineer",
      "startDate": "2020-01",
      "endDate": "Present",
      "achievements": ["Led team of 5 developers", "Increased performance by 40%"],
      "technologies": ["React", "Node.js", "PostgreSQL"]
    }
  ],
  "skills": {
    "technical": ["JavaScript", "Python", "React"],
    "soft": ["Leadership", "Communication"]
  },
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "school": "University of California",
      "graduationDate": "2018"
    }
  ],
  "yearsOfExperience": "5",
  "careerLevel": "Senior",
  "careerHighlights": [
    "Led development of microservices architecture",
    "Mentored 10+ junior developers"
  ]
}
*/
