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
 * Enhanced text extraction with multiple fallback methods
 */
async function extractResumeText(buffer: Buffer, fileType: string): Promise<string> {
  console.log(`📄 Extracting text from ${fileType}...`);
  
  try {
    if (fileType === 'application/pdf') {
      // Try multiple PDF extraction methods
      try {
        // Method 1: Standard pdf-parse
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 50) {
          console.log(`✅ PDF text extracted successfully (${data.text.length} characters)`);
          return data.text.trim();
        }
      } catch (pdfError: any) {
        console.warn('⚠️ Standard PDF extraction failed:', pdfError.message);
      }

      // Method 2: Try with different options
      try {
      const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 20) {
          console.log(`✅ PDF text extracted with alternative method (${data.text.length} characters)`);
          return data.text.trim();
        }
      } catch (altError: any) {
        console.warn('⚠️ Alternative PDF extraction failed:', altError.message);
      }

    } else if (fileType.includes('word') || fileType.includes('document')) {
      // Try DOCX extraction
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 20) {
        console.log(`✅ DOCX text extracted successfully (${result.value.length} characters)`);
        return result.value.trim();
      }
    }
  } catch (error: any) {
    console.warn('⚠️ Text extraction failed:', error.message);
  }
  
  console.log('📄 Text extraction unsuccessful - will rely on parsed resume data');
  return ''; // Return empty string if extraction fails
}

/**
 * Normalize various possible Supabase/PG bytea return types to a Node Buffer
 */
function normalizeToBuffer(fileContent: any): Buffer {
  // Already a Buffer
  if (Buffer.isBuffer(fileContent)) return fileContent as Buffer;

  // ArrayBuffer
  if (typeof fileContent === 'object' && fileContent?.byteLength !== undefined) {
    return Buffer.from(fileContent as ArrayBuffer);
  }

  // Uint8Array
  if (typeof fileContent === 'object' && fileContent?.buffer && fileContent?.BYTES_PER_ELEMENT) {
    return Buffer.from(fileContent as Uint8Array);
  }

  // Hex string from Postgres bytea (e.g., "\\x25504446...")
  if (typeof fileContent === 'string' && fileContent.startsWith('\\x')) {
    return Buffer.from(fileContent.slice(2), 'hex');
  }

  // Base64 string
  if (typeof fileContent === 'string') {
    const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
    if (base64Regex.test(fileContent)) {
      return Buffer.from(fileContent, 'base64');
    }
    // Fallback: treat as utf8 (last resort)
    return Buffer.from(fileContent, 'utf8');
  }

  // Array of numbers
  if (Array.isArray(fileContent)) {
    return Buffer.from(Uint8Array.from(fileContent));
  }

  throw new Error('Unsupported resume file_content format');
}

function bufferLooksLikePdf(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  const header = buf.slice(0, 4).toString('utf8');
  return header === '%PDF';
}

function salvagePrintableText(buf: Buffer): string {
  // Convert to a string keeping printable ASCII, replace others with spaces
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    // printable ASCII and common whitespace
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) {
      out += String.fromCharCode(c);
    } else {
      out += ' ';
    }
  }
  // Collapse excessive spaces and normalize newlines
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(input: string, maxChars: number): string[] {
  if (!input) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < input.length) {
    chunks.push(input.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

async function extractStructuredResumeWithAI(resumeText: string) {
  const MAX_CHARS_PER_CHUNK = 8000; // conservative per request
  const chunks = chunkText(resumeText, MAX_CHARS_PER_CHUNK);
  const aggregate = { experiences: [] as any[], education: [] as any[], projects: [] as any[], skills: [] as string[], summary: '' };

  for (const chunk of chunks) {
    const sys = `You are a resume parser. Return ONLY valid JSON with keys: experiences[], education[], projects[], skills[], summary.
Each experience: { company, position, location?, startDate?, endDate?, current?, description }.
Each education: { school, degree, startDate?, endDate?, current? }.
Each project: { name, description }.
Limit to facts present in the text. No fabrication.`;
    const user = `Resume fragment:\n\n${chunk}\n\nReturn JSON only.`;
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      });
      const content = resp.choices?.[0]?.message?.content || '';
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed.experiences)) aggregate.experiences.push(...parsed.experiences);
        if (Array.isArray(parsed.education)) aggregate.education.push(...parsed.education);
        if (Array.isArray(parsed.projects)) aggregate.projects.push(...parsed.projects);
        if (Array.isArray(parsed.skills)) aggregate.skills.push(...parsed.skills);
        if (parsed.summary && typeof parsed.summary === 'string') aggregate.summary += (aggregate.summary ? '\n' : '') + parsed.summary;
      }
    } catch (e: any) {
      console.warn('⚠️ AI chunk parse failed:', e.message);
    }
  }

  // Deduplicate skills and trim lengths
  aggregate.skills = Array.from(new Set(aggregate.skills)).slice(0, 200);
  return aggregate;
}

function mergeParsedResume(primary: any, extra: any) {
  const out = { ...(primary || {}) } as any;
  out.experiences = [...(primary?.experiences || []), ...(extra?.experiences || [])];
  out.education = [...(primary?.education || []), ...(extra?.education || [])];
  out.projects = [...(primary?.projects || []), ...(extra?.projects || [])];
  out.skills = Array.from(new Set([...(primary?.skills || []), ...(extra?.skills || [])]));
  out.summary = [primary?.summary, extra?.summary].filter(Boolean).join('\n');
  return out;
}

/**
 * Generate factual structured profile using user data and resume information
 */
async function generateFactualProfile(resumeText: string, fileName: string, existingProfile: any, parsedResumeData: any): Promise<string> {
  console.log('✍️ Generating factual structured profile...');

  const hasResumeText = resumeText && resumeText.length > 100;
  
  // Compact inputs to avoid model context overflow
  const MAX_RESUME_CHARS = 35000;
  const MAX_FIELD_CHARS = 800;
  const MAX_ARRAY_ITEMS = 6;
  const capString = (s: string, max: number) => {
    if (!s) return '';
    if (s.length <= max) return s;
    const head = Math.floor(max * 0.7);
    const tail = max - head - 10;
    return s.slice(0, head) + "\n...\n" + s.slice(-tail);
  };
  const capList = <T,>(arr: T[] | undefined, max: number) => Array.isArray(arr) ? arr.slice(0, max) : ([] as T[]);
  const compactParsedResume = (() => {
    const d = parsedResumeData || {};
    const experiences = capList(d.experiences, MAX_ARRAY_ITEMS).map((e: any) => ({
      company: e?.company,
      position: e?.position,
      location: e?.location,
      startDate: e?.startDate,
      endDate: e?.endDate,
      current: e?.current,
      description: capString(e?.description || '', MAX_FIELD_CHARS)
    }));
    const education = capList(d.education, 4).map((ed: any) => ({
      school: ed?.school,
      degree: ed?.degree,
      startDate: ed?.startDate,
      endDate: ed?.endDate,
      current: ed?.current
    }));
    const projects = capList(d.projects, MAX_ARRAY_ITEMS).map((p: any) => ({
      name: p?.name,
      description: capString(p?.description || '', MAX_FIELD_CHARS)
    }));
    const skills = capList(d.skills, 100);
    const summary = capString(d.summary || '', MAX_FIELD_CHARS);
    return { personalInfo: d.personalInfo, experiences, education, projects, skills, summary };
  })();
  const compactResumeText = hasResumeText ? capString(resumeText, MAX_RESUME_CHARS) : '';
  const parsedJson = JSON.stringify(compactParsedResume, null, 2);
  
  const prompt = `You are a professional profile compiler. Create a comprehensive, factual profile for this candidate using ONLY the information provided. Do NOT invent or assume any details.

${hasResumeText ? `RESUME CONTENT (truncated):\n${compactResumeText}\n\n` : ''}

USER PROFILE DATA (from profile form):
Basic Information:
- Full Name: ${existingProfile.basicInfo?.full_name || 'Not provided'}
- Preferred Name: ${existingProfile.basicInfo?.preferred_name || 'Not provided'}
- Email: ${existingProfile.basicInfo?.email || 'Not provided'}
- Phone: ${existingProfile.basicInfo?.phone || 'Not provided'}
- Location: ${existingProfile.basicInfo?.location || 'Not provided'}
- LinkedIn: ${existingProfile.basicInfo?.linkedin_url || 'Not provided'}
- Portfolio: ${existingProfile.basicInfo?.portfolio_url || 'Not provided'}

Work Authorization:
- Authorized to Work: ${existingProfile.workAuth?.work_authorized ? 'Yes' : existingProfile.workAuth?.work_authorized === false ? 'No' : 'Not specified'}
- Visa Sponsorship Required: ${existingProfile.workAuth?.visa_sponsorship_required ? 'Yes' : existingProfile.workAuth?.visa_sponsorship_required === false ? 'No' : 'Not specified'}
- Veteran Status: ${existingProfile.workAuth?.veteran_status || 'Not specified'}
- Disability Status: ${existingProfile.workAuth?.disability_status || 'Not specified'}
- Open to Relocation: ${existingProfile.workAuth?.open_to_relocation || 'Not specified'}
- Work Arrangement Preference: ${existingProfile.workAuth?.work_arrangement || 'Not specified'}
- Travel Willingness: ${existingProfile.workAuth?.travel_willingness || 'Not specified'}

Job Search Criteria:
- Desired Job Titles: ${existingProfile.jobCriteria?.desired_job_titles?.join(', ') || 'Not specified'}
- Target Industries: ${existingProfile.jobCriteria?.target_industries?.join(', ') || 'Not specified'}
- Preferred Locations: ${existingProfile.jobCriteria?.preferred_locations?.join(', ') || 'Not specified'}
- Minimum Salary: ${existingProfile.jobCriteria?.min_salary ? '$' + existingProfile.jobCriteria.min_salary : 'Not specified'}
- Job Type: ${existingProfile.jobCriteria?.job_type || 'Not specified'}
- Start Availability: ${existingProfile.jobCriteria?.start_availability || 'Not specified'}

Experience & Education:
- Employment Status: ${existingProfile.experienceEd?.employment_status || 'Not specified'}
- Education Level: ${existingProfile.experienceEd?.education_level || 'Not specified'}
- Field of Study: ${existingProfile.experienceEd?.field_of_study || 'Not specified'}

Skills & Certifications:
- Technical Skills: ${existingProfile.skills?.technical_skills?.join(', ') || 'Not specified'}
- Software Tools: ${existingProfile.skills?.software_tools?.join(', ') || 'Not specified'}
- Certifications: ${existingProfile.skills?.certifications?.join(', ') || 'Not specified'}
- Key Strengths: ${existingProfile.skills?.key_strengths?.join(', ') || 'Not specified'}

Languages:
${existingProfile.languages?.map((lang: any) => `- ${lang.language}: ${lang.proficiency_level}`).join('\n') || '- Not specified'}

Application Preferences:
- Applications per Week: ${existingProfile.appPrefs?.applications_per_week || 'Not specified'}
- Blacklisted Companies: ${existingProfile.appPrefs?.blacklisted_companies?.join(', ') || 'None specified'}

STRUCTURED RESUME DATA (from parsed_resumes table):
${Object.keys(parsedResumeData).length > 0 ? parsedJson : 'No structured resume data available'}

RESUME FILE: ${fileName}

INSTRUCTIONS FOR PROFILE CREATION:
- Create a comprehensive profile using ALL available profile form data
- For resume sections (work experience, education, skills), use structured data if available
- If resume data is not available, create placeholder sections that show the structure
- Focus on making a complete, professional profile using the rich profile form data provided
- Be factual and only use information that is actually provided

Create a structured, factual profile with the following sections:

## PROFESSIONAL SUMMARY
- Brief overview based on actual experience and skills listed

## RESUME INFORMATION
- Resume File: ${fileName} (uploaded and available)
- Note: Resume content extraction is currently limited due to PDF format
- For complete work experience and education details, user may need to manually enter information in profile form

## WORK EXPERIENCE
${Object.keys(parsedResumeData).length > 0 && parsedResumeData.experiences ? 
  'From structured resume data:' : 
  'From profile form data (if available):'}
- Job titles, companies, employment dates
- Key responsibilities and achievements
- Career progression and growth

## EDUCATION
${Object.keys(parsedResumeData).length > 0 && parsedResumeData.education ? 
  'From structured resume data:' : 
  'From profile form data (if available):'}
- Degrees and certifications
- Educational institutions
- Graduation dates and academic achievements

## TECHNICAL SKILLS
${Object.keys(parsedResumeData).length > 0 && parsedResumeData.skills ? 
  'From structured resume data:' : 
  'From profile form data:'}
- Programming languages and technical skills
- Software tools and frameworks
- Professional certifications

## PROJECTS
- Notable projects and accomplishments
- Technologies and methodologies used
- Impact and results achieved

## LEADERSHIP EXPERIENCE
- Management and leadership roles
- Team leadership experience
- Cross-functional collaboration

## CERTIFICATIONS & ACHIEVEMENTS
- Professional certifications and credentials
- Awards and recognition
- Publications or presentations

## CONTACT INFORMATION
- Full Name: [from profile form]
- Preferred Name: [if different from full name]
- Email: [from profile form]
- Phone: [from profile form]
- Location: [from profile form]
- LinkedIn: [from profile form if provided]
- Portfolio: [from profile form if provided]

## WORK AUTHORIZATION & PREFERENCES
- Work Authorization: [from profile form]
- Visa Sponsorship: [from profile form]
- Veteran Status: [from profile form if provided]
- Disability Status: [from profile form if provided]
- Relocation: [from profile form]
- Work Arrangement: [from profile form - remote/hybrid/on-site preference]
- Travel Willingness: [from profile form]

## JOB SEARCH CRITERIA
- Desired Job Titles: [from profile form]
- Target Industries: [from profile form]
- Preferred Locations: [from profile form]
- Minimum Salary: [from profile form if provided]
- Job Type: [from profile form - full-time/part-time/contract]
- Start Availability: [from profile form]

## LANGUAGES
- [Language]: [Proficiency Level] (from profile form)

## APPLICATION PREFERENCES
- Applications per Week: [from profile form]
- Blacklisted Companies: [from profile form if any]

CRITICAL INSTRUCTIONS:
- Use BOTH resume data AND profile form data
- Profile form data should be included even if not in resume
- Include specific dates, company names, school names, and locations as provided
- Do NOT invent or assume any information not explicitly stated
- Use bullet points and clear formatting
- Be precise with dates and timeframes
- Include all relevant details from both sources
- Prioritize profile form data for contact info and preferences

Return the profile in clean, structured format with clear section headers.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional profile compiler who creates comprehensive, factual profiles. You use only the information provided and never invent details. You organize information clearly and professionally.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Lower temperature for more factual, consistent output
      max_tokens: 2000 // Increased for more detailed structured content
    });

    const profile = response.choices[0].message.content;
    if (!profile) {
      throw new Error('No profile generated');
    }

    console.log('✅ Factual structured profile generated successfully');
    return profile.trim();

  } catch (error: any) {
    console.error('❌ Error generating profile:', error);
    throw new Error(`Failed to generate profile: ${error.message}`);
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

    console.log(`🔍 Updating profile for user: ${userId}`);

    // 1. Get the user's resume from database
    const { data: resumeData, error: resumeError } = await supabase
      .from('user_resumes')
      .select('file_name, file_content, file_type')
      .eq('user_id', userId)
      .single();

    if (resumeError || !resumeData) {
      console.log(`❌ No resume found for user ${userId}:`, resumeError?.message);
      return NextResponse.json(
        { success: false, error: 'No resume found for user' },
        { status: 404 }
      );
    }

    console.log(`📄 Found resume: ${resumeData.file_name} (${resumeData.file_type})`);

    // 2. Robust PDF/DOCX text extraction with proper decoding of stored bytes
    let resumeText = '';
    let textExtracted = false;
    try {
      const fileBuffer = normalizeToBuffer(resumeData.file_content);
      const isPdf = bufferLooksLikePdf(fileBuffer);
      console.log(`🔎 Detected format by header: ${isPdf ? 'PDF' : 'Unknown/Not PDF'} | DB mime: ${resumeData.file_type}`);

      // If it's actually a DOCX but mislabeled, try mammoth first
      if (!isPdf && (resumeData.file_type?.includes('document') || resumeData.file_name?.endsWith('.docx'))) {
        try {
          const docxRes = await mammoth.extractRawText({ buffer: fileBuffer });
          if (docxRes.value && docxRes.value.trim().length > 50) {
            resumeText = docxRes.value.trim();
          }
        } catch {}
      }

      // If still empty, try pdf path (even if header check failed as last resort)
      if (!resumeText) {
        resumeText = await extractResumeText(fileBuffer, resumeData.file_type);
      }

      // If extraction still failed, salvage printable text as a last resort
      if (!resumeText || resumeText.trim().length < 50) {
        const salvaged = salvagePrintableText(fileBuffer);
        if (salvaged.length > 200) {
          console.log('🛟 Using salvaged printable text fallback');
          resumeText = salvaged;
        }
      }
      textExtracted = (resumeText?.length || 0) > 100; // heuristic
    console.log(`📝 Text extraction: ${textExtracted ? 'SUCCESS' : 'LIMITED'} (${resumeText.length} characters)`);
    } catch (decodeErr: any) {
      console.warn('⚠️ Resume decode/extract error:', decodeErr.message);
      resumeText = '';
      textExtracted = false;
    }

    // 3. Get comprehensive user profile data from all tables, including parsed resume data
    const [userProfileData, workAuthData, jobCriteriaData, experienceEdData, skillsData, languagesData, appPrefsData, parsedResumeData] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('work_authorization').select('*').eq('user_id', userId).single(),
      supabase.from('job_search_criteria').select('*').eq('user_id', userId).single(),
      supabase.from('experience_education').select('*').eq('user_id', userId).single(),
      supabase.from('skills_certifications').select('*').eq('user_id', userId).single(),
      supabase.from('languages').select('*').eq('user_id', userId),
      supabase.from('application_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('parsed_resumes').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single()
    ]);

    // Combine all profile data
    const existingProfile = {
      basicInfo: userProfileData.data || {},
      workAuth: workAuthData.data || {},
      jobCriteria: jobCriteriaData.data || {},
      experienceEd: experienceEdData.data || {},
      skills: skillsData.data || {},
      languages: languagesData.data || [],
      appPrefs: appPrefsData.data || {}
    };

    console.log(`📊 Profile data fetched:`, {
      hasBasicInfo: !!userProfileData.data,
      hasWorkAuth: !!workAuthData.data,
      hasJobCriteria: !!jobCriteriaData.data,
      hasSkills: !!skillsData.data,
      languageCount: languagesData.data?.length || 0,
      hasParsedResume: !!parsedResumeData.data
    });

    // 4. Get parsed resume data from parsed_resumes table and optionally augment with AI
    let structuredResumeData = parsedResumeData.data?.resume_data || {};
    if ((!structuredResumeData || Object.keys(structuredResumeData).length === 0) && (resumeText?.length || 0) > 500) {
      console.log('🧠 Parsing resume text with AI to build structured data...');
      const aiParsed = await extractStructuredResumeWithAI(resumeText);
      structuredResumeData = mergeParsedResume(structuredResumeData, aiParsed);
    }

    console.log(`📊 Parsed resume data available: ${Object.keys(structuredResumeData).length > 0 ? 'YES' : 'NO'}`);
    if (Object.keys(structuredResumeData).length > 0) {
      console.log(`📊 Parsed resume sections:`, Object.keys(structuredResumeData));
    }

    // 5. Generate factual structured profile
    const factualProfile = await generateFactualProfile(
      resumeText, 
      resumeData.file_name, 
      existingProfile || {},
      structuredResumeData
    );

    // 6. Update user profile with factual structured profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        gpt_essay: factualProfile,
        gpt_essay_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('❌ Error updating user profile:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    console.log('✅ Factual profile updated successfully');

    return NextResponse.json({
      success: true,
      message: textExtracted 
        ? 'Factual profile updated successfully using resume content and user data'
        : 'Factual profile updated successfully using available profile data (resume text extraction was limited)',
      profileWordCount: factualProfile.split(' ').length,
      textExtracted: textExtracted,
      extractedTextLength: resumeText.length,
      parsedDataAvailable: Object.keys(structuredResumeData).length > 0
    });

  } catch (error: any) {
    console.error('❌ Error in essay update:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Factual Profile Generator API',
    description: 'Creates comprehensive factual profiles using resume content and user data',
    features: [
      'Factual structured profile generation (not essay format)',
      'Uses parsed resume data, raw text, and user profile information',
      'Includes work experience, education, skills, projects, and leadership',
      'Shows specific dates, companies, schools, and achievements',
      'Organized in clear sections with bullet points',
      'Never invents information - uses only provided data'
    ]
  });
}
