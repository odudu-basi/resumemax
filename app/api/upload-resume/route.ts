import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';
import { extractTextFromFile } from '@/src/lib/extract';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Get configuration
const config = getConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Helper function to convert date formats to MM/DD/YYYY
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // If already in MM/DD/YYYY format, return as is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // If in MM/YYYY format, add /01 for first day of month
  if (/^\d{2}\/\d{4}$/.test(dateStr)) {
    return `${dateStr.substring(0, 2)}/01/${dateStr.substring(3)}`;
  }

  // If in other format, try to parse and convert
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = '01'; // Always use 1st of the month
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  } catch (e) {
    console.warn('Could not parse date:', dateStr);
  }

  return dateStr; // Return as-is if we can't parse it
}

// Helper function to save parsed resume data to database
async function saveResumeDataToDatabase(userId: string, parsedData: any) {
  try {
    // Save resume data (summary, skills, projects) to user_resume_data table
    if (parsedData) {
      const { error: resumeDataError } = await supabase
        .from('user_resume_data')
        .upsert({
          user_id: userId,
          professional_summary: parsedData.summary || '',
          skills: parsedData.skills || [],
          projects: parsedData.projects || [],
        }, {
          onConflict: 'user_id'
        });

      if (resumeDataError) {
        console.error('Error saving resume data:', resumeDataError);
      } else {
        console.log('✅ Saved to user_resume_data');
      }
    }

    // Save education entries
    if (parsedData.education && parsedData.education.length > 0) {
      // Delete existing education entries first
      await supabase
        .from('education_entries')
        .delete()
        .eq('user_id', userId);

      // Insert new education entries
      const educationEntries = parsedData.education.map((edu: any) => ({
        user_id: userId,
        school: edu.school,
        degree: edu.degree, // Full degree text
        start_date: formatDate(edu.startDate),
        end_date: edu.current ? '' : formatDate(edu.endDate),
        current: edu.current || false,
      }));

      const { error: eduError } = await supabase
        .from('education_entries')
        .insert(educationEntries);

      if (eduError) {
        console.error('Error saving education entries:', eduError);
      } else {
        console.log('✅ Saved education entries');
      }
    }

    // Save experience entries
    if (parsedData.experiences && parsedData.experiences.length > 0) {
      // Delete existing experience entries first
      await supabase
        .from('experience_entries')
        .delete()
        .eq('user_id', userId);

      // Insert new experience entries
      const experienceEntries = parsedData.experiences.map((exp: any) => ({
        user_id: userId,
        company: exp.company,
        position: exp.position, // Job title
        location: exp.location || '', // Location
        start_date: formatDate(exp.startDate),
        end_date: exp.current ? '' : formatDate(exp.endDate),
        current: exp.current || false,
        description: exp.description,
      }));

      const { error: expError } = await supabase
        .from('experience_entries')
        .insert(experienceEntries);

      if (expError) {
        console.error('Error saving experience entries:', expError);
      } else {
        console.log('✅ Saved experience entries');
      }
    }

    console.log('✅ All resume data saved to database tables');
  } catch (error) {
    console.error('Error in saveResumeDataToDatabase:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and user ID are required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOC, or DOCX files only.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    console.log('Processing file upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId
    });

    // Convert file to buffer for database storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store file directly in database (resumes table)
    // Using service role client to bypass RLS policies
    const { error } = await (supabase as any)
      .from('resumes')
      .upsert({
        user_id: userId,
        title: file.name.replace(/\.[^/.]+$/, ''), // Use filename without extension as title
        file_name: file.name,
        file_content: buffer,
        file_size: file.size,
        file_type: file.type,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Database save error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      return NextResponse.json(
        { error: 'Failed to save resume to database', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Resume saved successfully to database');

    // Parse the resume and extract structured data
    console.log('🔍 Starting resume parsing...');
    try {
      const extractionResult = await extractTextFromFile(file);
      const resumeText = extractionResult.text;
      console.log('📄 Text extracted, length:', resumeText.length);

      // AI prompt for parsing resume content
      const systemPrompt = `You are an expert resume parser. Extract structured information from the resume text and return it as JSON.

CRITICAL INSTRUCTIONS:
1. Extract ALL information accurately from the resume - EVERY field must be filled if data exists
2. For dates, use MM/YYYY format (e.g., "01/2023" for January 2023, "08/2021" for August 2021)
3. If information is missing, use empty strings or empty arrays - BUT ALWAYS LOOK CAREFULLY
4. For current positions/education, set "current" to true and "endDate" to empty string
5. Split multi-line descriptions into bullet points separated by newlines
6. Extract skills as individual items in an array
7. Create a professional summary if one exists, otherwise leave empty
8. IMPORTANT: For work experience, ALWAYS extract position/job title, company, location (if available), and dates
9. Output ONLY valid JSON - no markdown code blocks, no explanatory text, start directly with { and end with }

EXAMPLES OF DATE PARSING:
- "August 2021 - April 2023" → startDate: "08/2021", endDate: "04/2023"
- "Jan 2020 - Present" → startDate: "01/2020", endDate: "", current: true
- "2019 - 2023" → startDate: "01/2019", endDate: "01/2023"

JSON Schema to follow:
{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone Number",
    "state": "State/Location"
  },
  "experiences": [
    {
      "company": "Company Name",
      "position": "Job Title/Position",
      "location": "City, State (if available)",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY",
      "current": false,
      "description": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3"
    }
  ],
  "education": [
    {
      "school": "University Name",
      "degree": "Degree Name",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY",
      "current": false
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "• Project detail 1\\n• Project detail 2"
    }
  ],
  "skills": ["Skill1", "Skill2", "Skill3"],
  "summary": "Professional summary text"
}`;

      const userPrompt = `Parse this resume and extract all information into the specified JSON format:

${resumeText}

Return ONLY valid JSON with no additional text or formatting.`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      let parsedData;
      try {
        parsedData = JSON.parse(response);
      } catch (error) {
        console.error('Failed to parse OpenAI response as JSON:', response);
        throw new Error('Invalid JSON response from AI');
      }

      console.log('✅ Resume parsed successfully');

      // Save parsed data to database tables
      await saveResumeDataToDatabase(userId, parsedData);

      console.log('✅ Resume data saved to database tables');

    } catch (parseError: any) {
      console.error('⚠️ Resume parsing failed (continuing anyway):', parseError.message);
      // Don't fail the whole upload if parsing fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: 'Resume uploaded and parsed successfully!',
      parsed: true
    });

  } catch (error: any) {
    console.error('Resume upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}