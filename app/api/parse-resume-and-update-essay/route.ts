import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'nodejs';

/**
 * Extract text from PDF buffer with multiple fallback strategies
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('📄 Attempting to extract text from PDF...');
  
  // Strategy 1: Try pdf-parse
  try {
    const data = await pdfParse(buffer, {
      // Add options to handle problematic PDFs
      max: 0, // No limit on pages
      version: 'v1.10.100' // Use specific version
    });
    
    if (data.text && data.text.trim().length > 50) {
      console.log(`✅ Strategy 1 success: Extracted ${data.text.length} characters from ${data.numpages} pages`);
      return data.text.trim();
    }
  } catch (error: any) {
    console.warn('⚠️ Strategy 1 (pdf-parse) failed:', error.message);
  }

  // Strategy 2: Try with different pdf-parse options
  try {
    const data = await pdfParse(buffer, {
      normalizeWhitespace: false,
      disableCombineTextItems: false
    });
    
    if (data.text && data.text.trim().length > 50) {
      console.log(`✅ Strategy 2 success: Extracted ${data.text.length} characters`);
      return data.text.trim();
    }
  } catch (error: any) {
    console.warn('⚠️ Strategy 2 (pdf-parse with options) failed:', error.message);
  }

  // If all strategies fail, throw error
  throw new Error('Unable to extract text from PDF. The file may be corrupted, password-protected, or contain only images.');
}

/**
 * Extract text from DOCX buffer
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error: any) {
    console.error('Error extracting DOCX text:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Parse resume text using ChatGPT to extract structured information
 */
async function parseResumeWithGPT(resumeText: string): Promise<any> {
  console.log('🤖 Parsing resume with ChatGPT...');
  
  const prompt = `You are an expert resume parser and career analyst. Parse the following resume text and extract detailed, comprehensive information. Be thorough and capture ALL relevant details.

RESUME TEXT:
${resumeText}

Extract and structure the information into the following JSON format. Be as detailed as possible - include specific technologies, methodologies, achievements, metrics, and any other relevant details:

{
  "personalInfo": {
    "fullName": "Full name from resume",
    "email": "Email address",
    "phone": "Phone number", 
    "location": "City, State/Country",
    "linkedinUrl": "LinkedIn profile URL",
    "portfolioUrl": "Portfolio/website URL",
    "githubUrl": "GitHub profile URL"
  },
  "professionalSummary": "A comprehensive 2-3 sentence summary of their professional background, key strengths, and career focus",
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "location": "Job location",
      "startDate": "Start date",
      "endDate": "End date or 'Present'",
      "duration": "Duration (e.g., '2 years 3 months')",
      "description": "Detailed description of role and responsibilities",
      "achievements": [
        "Specific achievement with metrics/impact",
        "Another quantified accomplishment"
      ],
      "technologies": ["Technology1", "Technology2"],
      "keyResponsibilities": [
        "Major responsibility 1",
        "Major responsibility 2"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree type and field",
      "school": "Institution name",
      "location": "School location",
      "graduationDate": "Graduation date",
      "gpa": "GPA if mentioned",
      "relevantCoursework": ["Course1", "Course2"],
      "honors": ["Honor1", "Honor2"]
    }
  ],
  "skills": {
    "technical": ["Technical skill 1", "Technical skill 2"],
    "programming": ["Language1", "Language2"],
    "frameworks": ["Framework1", "Framework2"],
    "tools": ["Tool1", "Tool2"],
    "databases": ["Database1", "Database2"],
    "cloud": ["AWS", "Azure", "GCP"],
    "soft": ["Leadership", "Communication", "Problem-solving"]
  },
  "projects": [
    {
      "name": "Project name",
      "description": "Detailed project description",
      "technologies": ["Tech1", "Tech2"],
      "achievements": "Key outcomes/metrics",
      "url": "Project URL if available"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "Date obtained",
      "expiryDate": "Expiry date if applicable"
    }
  ],
  "languages": [
    {
      "language": "Language name",
      "proficiency": "Proficiency level"
    }
  ],
  "awards": [
    {
      "name": "Award name",
      "issuer": "Issuing organization",
      "date": "Date received",
      "description": "Award description"
    }
  ],
  "volunteering": [
    {
      "organization": "Organization name",
      "role": "Volunteer role",
      "duration": "Time period",
      "description": "Description of volunteer work"
    }
  ],
  "careerHighlights": [
    "Most impressive career achievement",
    "Another significant accomplishment",
    "Third major highlight"
  ],
  "industryExpertise": ["Industry1", "Industry2"],
  "yearsOfExperience": "Total years of professional experience",
  "careerLevel": "Entry-level/Mid-level/Senior/Executive",
  "specializations": ["Specialization1", "Specialization2"]
}

IMPORTANT INSTRUCTIONS:
1. Extract ALL information present in the resume - don't leave anything out
2. If information is not available, use null or empty array []
3. Be specific with technologies, tools, and methodologies mentioned
4. Include ALL quantifiable achievements and metrics
5. Capture the full scope of their experience and expertise
6. Pay attention to industry-specific terminology and skills
7. Extract soft skills mentioned or implied in descriptions
8. Include any leadership experience, team sizes managed, budgets handled
9. Note any international experience, remote work, or special circumstances
10. Ensure all dates, locations, and contact information are accurate

Return ONLY the JSON object, no additional text or formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume parser and career analyst. You extract comprehensive, detailed information from resumes and structure it perfectly. You are thorough, accurate, and capture every relevant detail.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent, accurate parsing
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from ChatGPT');
    }

    const parsedResume = JSON.parse(content);
    console.log('✅ Resume parsed successfully');
    return parsedResume;

  } catch (error: any) {
    console.error('❌ Error parsing resume with ChatGPT:', error);
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
}

/**
 * Generate enhanced essay using parsed resume data
 */
async function generateEnhancedEssay(parsedResume: any, existingUserProfile: any): Promise<string> {
  console.log('✍️ Generating enhanced essay with resume details...');

  const prompt = `You are an expert career writer and personal branding specialist. Create a comprehensive, compelling professional essay/profile for this candidate using their detailed resume information and existing profile data.

PARSED RESUME DATA:
${JSON.stringify(parsedResume, null, 2)}

EXISTING USER PROFILE DATA:
${JSON.stringify(existingUserProfile, null, 2)}

Create a detailed, engaging professional essay (400-600 words) that:

1. **PROFESSIONAL SUMMARY** (2-3 sentences):
   - Captures their career level, specializations, and years of experience
   - Highlights their most impressive achievements and expertise areas
   - Positions them as a strong candidate in their field

2. **TECHNICAL EXPERTISE** (1-2 paragraphs):
   - Detail their technical skills, programming languages, frameworks, and tools
   - Mention specific technologies they've worked with and their proficiency
   - Include any cloud platforms, databases, and development methodologies
   - Reference specific projects or implementations where they used these skills

3. **PROFESSIONAL EXPERIENCE** (2-3 paragraphs):
   - Highlight their most significant roles and career progression
   - Include specific achievements with metrics and quantifiable impact
   - Mention companies they've worked for and the scale of their responsibilities
   - Detail leadership experience, team sizes managed, budgets handled
   - Reference major projects, initiatives, or transformations they led

4. **EDUCATION & CREDENTIALS** (1 paragraph):
   - Include their educational background, degrees, and institutions
   - Mention relevant certifications, courses, or professional development
   - Highlight any academic achievements, honors, or special recognitions
   - Connect their education to their current career path

5. **UNIQUE VALUE PROPOSITION** (1-2 paragraphs):
   - What makes them stand out from other candidates?
   - Specific industry expertise or niche specializations
   - Cross-functional skills or unique combinations of expertise
   - International experience, language skills, or cultural competencies
   - Innovation, problem-solving abilities, or strategic thinking

6. **CAREER GOALS & MOTIVATION** (1 paragraph):
   - Based on their career trajectory, what are their likely next steps?
   - What types of challenges and opportunities would excite them?
   - How do they want to grow and contribute to organizations?
   - What impact do they want to make in their field?

WRITING GUIDELINES:
- Write in third person (professional tone)
- Use specific details, metrics, and concrete examples from their resume
- Make it engaging and compelling, not just a list of facts
- Show progression and growth throughout their career
- Highlight both technical and soft skills
- Include industry-specific terminology and keywords
- Make it ATS-friendly while remaining human and engaging
- Ensure it flows naturally and tells a cohesive career story

IMPORTANT: Use ONLY information from the provided resume and profile data. Do not fabricate or assume details not present in the source material. If specific information is missing, focus on what is available and write around it naturally.

Return the essay as plain text, well-structured with natural paragraph breaks.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert career writer and personal branding specialist. You create compelling, detailed professional profiles that showcase candidates in the best possible light while remaining truthful and accurate.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Slightly higher for more engaging writing
      max_tokens: 1500
    });

    const essay = response.choices[0].message.content;
    if (!essay) {
      throw new Error('No essay generated by ChatGPT');
    }

    console.log('✅ Enhanced essay generated successfully');
    return essay.trim();

  } catch (error: any) {
    console.error('❌ Error generating enhanced essay:', error);
    throw new Error(`Failed to generate essay: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Processing resume parsing and essay update for user: ${userId}`);

    // 1. Get the user's resume from database
    const { data: resumeData, error: resumeError } = await supabase
      .from('user_resumes')
      .select('file_name, file_content, file_type')
      .eq('user_id', userId)
      .single();

    if (resumeError || !resumeData) {
      return NextResponse.json(
        { success: false, error: 'No resume found for user' },
        { status: 404 }
      );
    }

    console.log(`📄 Found resume: ${resumeData.file_name} (${resumeData.file_type})`);

    // 2. Extract text from resume based on file type
    let resumeText: string;
    const fileBuffer = Buffer.from(resumeData.file_content);

    console.log(`📄 Processing ${resumeData.file_type} file (${fileBuffer.length} bytes)`);

    let resumeTextExtracted = false;
    
    try {
      if (resumeData.file_type === 'application/pdf') {
        resumeText = await extractTextFromPDF(fileBuffer);
        resumeTextExtracted = true;
      } else if (resumeData.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 resumeData.file_type === 'application/msword') {
        resumeText = await extractTextFromDOCX(fileBuffer);
        resumeTextExtracted = true;
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported file type: ${resumeData.file_type}. Please upload PDF or DOCX files.` },
          { status: 400 }
        );
      }
    } catch (extractionError: any) {
      console.error('❌ Text extraction failed:', extractionError);
      console.log('💡 Will proceed with essay generation using existing profile data only');
      resumeText = '';
      resumeTextExtracted = false;
    }

    // If we couldn't extract text, we'll still try to generate an enhanced essay using existing profile data
    if (!resumeTextExtracted || !resumeText || resumeText.length < 100) {
      console.log('⚠️ Limited or no text extracted from resume, using existing profile data for essay generation');
      resumeText = `Resume file: ${resumeData.file_name} (text extraction failed or insufficient content)`;
    }

    console.log(`📝 Extracted ${resumeText.length} characters from resume`);

    // 3. Parse resume with ChatGPT
    const parsedResume = await parseResumeWithGPT(resumeText);

    // 4. Get existing user profile data
    const { data: existingProfile, error: profileError } = await supabase
      .rpc('get_complete_user_profile', { profile_user_id: userId });

    if (profileError) {
      console.warn('Could not fetch existing profile:', profileError);
    }

    // 5. Generate enhanced essay
    const enhancedEssay = await generateEnhancedEssay(parsedResume, existingProfile || {});

    // 6. Update user profile with parsed data and enhanced essay
    const { error: updateError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        full_name: parsedResume.personalInfo?.fullName || null,
        email: parsedResume.personalInfo?.email || null,
        phone: parsedResume.personalInfo?.phone || null,
        location: parsedResume.personalInfo?.location || null,
        linkedin_url: parsedResume.personalInfo?.linkedinUrl || null,
        portfolio_url: parsedResume.personalInfo?.portfolioUrl || null,
        gpt_essay: enhancedEssay,
        gpt_essay_generated_at: new Date().toISOString(),
        parsed_resume_data: parsedResume, // Store full parsed data for future use
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('❌ Error updating user profile:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update user profile with parsed data' },
        { status: 500 }
      );
    }

    console.log('✅ User profile updated successfully with parsed resume data and enhanced essay');

    return NextResponse.json({
      success: true,
      message: 'Resume parsed and profile essay updated successfully',
      parsedData: {
        personalInfo: parsedResume.personalInfo,
        yearsOfExperience: parsedResume.yearsOfExperience,
        careerLevel: parsedResume.careerLevel,
        specializations: parsedResume.specializations,
        careerHighlights: parsedResume.careerHighlights
      },
      essayWordCount: enhancedEssay.split(' ').length,
      extractedTextLength: resumeText.length
    });

  } catch (error: any) {
    console.error('❌ Error in resume parsing and essay update:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Resume Parser and Essay Updater API',
    description: 'Parses uploaded resumes using ChatGPT and updates user profile essays with detailed information',
    features: [
      'PDF and DOCX text extraction',
      'Comprehensive resume parsing with ChatGPT',
      'Detailed professional essay generation',
      'User profile data enhancement',
      'Structured data extraction and storage'
    ],
    usage: {
      method: 'POST',
      body: {
        userId: 'string (required) - User ID to process resume for'
      }
    }
  });
}
