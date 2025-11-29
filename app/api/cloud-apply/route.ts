import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Stagehand } from '@browserbasehq/stagehand';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Force Node.js runtime
export const runtime = 'nodejs';

// Browserbase Configuration
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
  console.warn('⚠️ Browserbase credentials not configured');
}

// Request schema validation
const CloudApplyRequestSchema = z.object({
  jobUrl: z.string().url(),
  userId: z.string(),
});

type CloudApplyRequest = z.infer<typeof CloudApplyRequestSchema>;

/**
 * Fetch comprehensive user profile data from database
 */
async function fetchUserProfileData(userId: string) {
  try {
    console.log('🔍 [Cloud-Apply] Fetching comprehensive user profile for userId:', userId);

    let userProfile = null;
    let resume = null;
    let workAuth = null;
    let jobCriteria = null;
    let skillsCerts = null;
    let languages = [];
    let educationEntries = [];
    let experienceEntries = [];

    // Fetch user_profiles
    try {
      let { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
      if (error && error.code === '42703') {
        const result = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();
        data = result.data;
        error = result.error;
      }
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
      } else {
        userProfile = data;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch user profile');
    }

    // Fetch resumes
    try {
      const { data, error } = await supabase.from('resumes').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching resume:', error);
      } else {
        resume = data;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch resume');
    }

    // Fetch work_authorization
    try {
      const { data, error } = await supabase.from('work_authorization').select('*').eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching work authorization:', error);
      } else {
        workAuth = data;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch work authorization');
    }

    // Fetch job_search_criteria
    try {
      const { data, error } = await supabase.from('job_search_criteria').select('*').eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching job criteria:', error);
      } else {
        jobCriteria = data;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch job criteria');
    }

    // Fetch skills_certifications
    try {
      const { data, error } = await supabase.from('skills_certifications').select('*').eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching skills certifications:', error);
      } else {
        skillsCerts = data;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch skills certifications');
    }

    // Fetch language_skills
    try {
      const { data, error } = await supabase.from('language_skills').select('*').eq('user_id', userId);
      if (!error) {
        languages = data || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch language skills');
    }

    // Fetch education_entries
    try {
      const { data, error } = await supabase.from('education_entries').select('*').eq('user_id', userId).order('start_year', { ascending: false });
      if (!error) {
        educationEntries = data || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch education entries');
    }

    // Fetch experience_entries
    try {
      const { data, error } = await supabase.from('experience_entries').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (!error) {
        experienceEntries = data || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch experience entries');
    }

    // Parse resume data
    let parsedResumeData = null;
    if (userProfile?.parsed_resume_data) {
      try {
        parsedResumeData = typeof userProfile.parsed_resume_data === 'string'
          ? JSON.parse(userProfile.parsed_resume_data)
          : userProfile.parsed_resume_data;
      } catch (e) {
        console.warn('Failed to parse resume data:', e);
      }
    }

    // Build profile
    const profile = {
      fullName: userProfile?.full_name || parsedResumeData?.personalInfo?.name || 'John Doe',
      email: userProfile?.email || parsedResumeData?.personalInfo?.email || 'user@example.com',
      phone: userProfile?.phone || parsedResumeData?.personalInfo?.phone || '(555) 123-4567',
      location: userProfile?.location || parsedResumeData?.personalInfo?.location || 'San Francisco, CA',
      linkedinUrl: userProfile?.linkedin_url || parsedResumeData?.personalInfo?.linkedinUrl || null,
      portfolioUrl: userProfile?.portfolio_url || parsedResumeData?.personalInfo?.portfolioUrl || null,

      workExperience: experienceEntries.length > 0 ? experienceEntries.map((exp: any) => ({
        title: exp.role || '',
        company: exp.company || '',
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` :
                 exp.start_date && exp.is_current ? `${exp.start_date} - Present` :
                 exp.start_date || '',
        description: exp.description || ''
      })) : parsedResumeData?.experience || [],

      education: educationEntries.length > 0 ? educationEntries.map((edu: any) => ({
        degree: edu.degree || '',
        field: edu.major || '',
        school: edu.school || '',
        year: edu.end_year || edu.start_year || ''
      })) : parsedResumeData?.education || [],

      skills: {
        technical: skillsCerts?.technical_skills || parsedResumeData?.skills?.technical || [],
        languages: languages.map((lang: any) => `${lang.language} (${lang.proficiency_level})`),
      },

      workAuthorized: workAuth?.work_authorized || true,
      requiresSponsorship: workAuth?.visa_sponsorship_required || false,

      minSalary: jobCriteria?.min_salary || null,
      yearsOfExperience: parsedResumeData?.yearsOfExperience || experienceEntries.length.toString() || '3',
    };

    return profile;
  } catch (error) {
    console.error('Error fetching user profile data:', error);
    throw error;
  }
}

/**
 * POST /api/cloud-apply
 * Initiates a Browserbase + Stagehand session to apply to a job
 */
export async function POST(request: NextRequest) {
  let stagehand: any = null;

  try {
    const body = await request.json();
    const validatedData = CloudApplyRequestSchema.parse(body);

    console.log('🚀 [Cloud-Apply] Starting Browserbase application for:', validatedData.jobUrl);

    // Fetch user profile
    const userProfile = await fetchUserProfileData(validatedData.userId);
    console.log('✅ [Cloud-Apply] User profile fetched:', userProfile.fullName);

    // Initialize Stagehand with Browserbase
    console.log('🌐 [Cloud-Apply] Initializing Stagehand...');
    stagehand = new Stagehand({
      apiKey: BROWSERBASE_API_KEY,
      projectId: BROWSERBASE_PROJECT_ID,
      env: 'BROWSERBASE',
      verbose: 1,
      debugDom: true,
    });

    await stagehand.init();
    const sessionUrl = stagehand.browserbaseSessionURL || null;
    const sessionId = stagehand.browserbaseSessionID || null;
    console.log('📺 [Cloud-Apply] Session URL:', sessionUrl);

    // Navigate to job
    await stagehand.page.goto(validatedData.jobUrl);

    // Build AI instructions
    const firstName = userProfile.fullName.split(' ')[0];
    const lastName = userProfile.fullName.split(' ').slice(1).join(' ');

    const workExpText = userProfile.workExperience.map((exp: any, i: number) =>
      `${i + 1}. ${exp.title} at ${exp.company} (${exp.duration})`
    ).join('\n');

    const eduText = userProfile.education.map((edu: any, i: number) =>
      `${i + 1}. ${edu.degree} in ${edu.field} - ${edu.school} ${edu.year ? `(${edu.year})` : ''}`
    ).join('\n');

    const instructions = `Fill out this job application form completely.

CANDIDATE INFO:
- First Name: ${firstName}
- Last Name: ${lastName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}
${userProfile.linkedinUrl ? `- LinkedIn: ${userProfile.linkedinUrl}` : ''}
- Years Experience: ${userProfile.yearsOfExperience}

WORK EXPERIENCE:
${workExpText}

EDUCATION:
${eduText}

SKILLS: ${userProfile.skills.technical.join(', ')}

STEPS:
1. Click "Apply" or "Start Application" if present
2. Fill ALL form fields with the info above
3. For work authorization: Select "Yes, authorized to work"
4. For visa sponsorship: Select "No sponsorship required"
5. For "Why interested?" write 2-3 sentences about relevant experience
6. Click Next/Continue through all pages
7. Submit the application on the final page

Complete the application and submit it.`;

    console.log('🤖 [Cloud-Apply] Executing application...');
    await stagehand.act({ action: instructions });
    console.log('✅ [Cloud-Apply] Application completed');

    await stagehand.close();

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      sessionUrl: sessionUrl,
      message: 'Application submitted via Browserbase',
    });

  } catch (error: any) {
    console.error('❌ [Cloud-Apply] Error:', error);

    if (stagehand) {
      try {
        await stagehand.close();
      } catch (e) {
        console.error('Error closing stagehand:', e);
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cloud-apply?sessionId=xxx
 * Get the live session URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    const sessionUrl = `https://www.browserbase.com/sessions/${sessionId}`;

    return NextResponse.json({
      success: true,
      sessionId,
      sessionUrl,
    });

  } catch (error: any) {
    console.error('❌ [Cloud-Apply] Session lookup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
