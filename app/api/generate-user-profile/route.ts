import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, forceRegenerate = false } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch complete user profile from database
    const { data: profileData, error: profileError } = await supabase
      .rpc('get_complete_user_profile', { target_user_id: userId });

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    if (!profileData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if GPT essay already exists (skip if force regenerate)
    if (profileData.basic_info?.gpt_essay && !forceRegenerate) {
      return NextResponse.json({ 
        success: true, 
        essay: profileData.basic_info.gpt_essay,
        message: 'Profile essay already exists'
      });
    }

    // Generate GPT essay based on all user data
    const gptPrompt = generateProfilePrompt(profileData);
    
    console.log(`🤖 ${forceRegenerate ? 'Regenerating' : 'Generating'} AI profile for user:`, userId);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert career counselor and professional profile writer. Your task is to create a comprehensive, compelling professional profile based on the user's onboarding information. 

Write in a professional, engaging tone that highlights the user's strengths, experience, and career aspirations. The profile should be 3-4 paragraphs long and serve as a master profile that can be adapted for different job applications.

Focus on:
- Professional summary and key strengths
- Relevant experience and education
- Technical skills and expertise areas
- Career goals and what they're seeking
- Unique value proposition

Make it compelling but truthful, based only on the provided information. Do not fabricate experiences or skills not mentioned in the data.`
        },
        {
          role: 'user',
          content: gptPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const generatedEssay = response.choices[0].message.content;

    if (!generatedEssay) {
      return NextResponse.json({ error: 'Failed to generate profile essay' }, { status: 500 });
    }

    // Save the generated essay to the database
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        gpt_essay: generatedEssay,
        gpt_essay_generated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error saving GPT essay:', updateError);
      return NextResponse.json({ error: 'Failed to save profile essay' }, { status: 500 });
    }

    console.log(`✅ AI profile ${forceRegenerate ? 'regenerated' : 'generated'} and saved for user:`, userId);

    return NextResponse.json({
      success: true,
      essay: generatedEssay,
      message: `Profile essay ${forceRegenerate ? 'regenerated' : 'generated'} successfully`
    });

  } catch (error: any) {
    console.error('Error generating user profile:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

function generateProfilePrompt(profileData: any): string {
  const basicInfo = profileData.basic_info || {};
  const workAuth = profileData.work_auth || {};
  const jobCriteria = profileData.job_criteria || {};
  const experience = profileData.experience || {};
  const skills = profileData.skills || {};
  const languages = profileData.languages || [];
  const appPrefs = profileData.app_prefs || {};

  return `Please create a comprehensive professional profile based on the following user information:

PERSONAL INFORMATION:
- Name: ${basicInfo.full_name || 'Not provided'}
- Preferred Name: ${basicInfo.preferred_name || 'Same as full name'}
- Location: ${basicInfo.location || 'Not specified'}
- LinkedIn: ${basicInfo.linkedin_url || 'Not provided'}
- Portfolio: ${basicInfo.portfolio_url || 'Not provided'}

WORK AUTHORIZATION & PREFERENCES:
- Work Authorization: ${workAuth.work_authorized ? 'Authorized to work in US' : 'Not authorized'}
- Visa Sponsorship: ${workAuth.visa_sponsorship_required ? 'Requires sponsorship' : 'No sponsorship needed'}
- Veteran Status: ${workAuth.veteran_status || 'Not specified'}
- Open to Relocation: ${workAuth.open_to_relocation || 'Not specified'}
- Work Arrangement Preference: ${workAuth.work_arrangement || 'Not specified'}
- Travel Willingness: ${workAuth.travel_willingness || 'Not specified'}

JOB SEARCH CRITERIA:
- Desired Job Titles: ${jobCriteria.desired_job_titles?.join(', ') || 'Not specified'}
- Target Industries: ${jobCriteria.target_industries?.join(', ') || 'Not specified'}
- Preferred Locations: ${jobCriteria.preferred_locations?.join(', ') || 'Not specified'}
- Minimum Salary: ${jobCriteria.min_salary ? `$${jobCriteria.min_salary.toLocaleString()}` : 'Not specified'}
- Job Type: ${jobCriteria.job_type || 'Not specified'}
- Start Availability: ${jobCriteria.start_availability || 'Not specified'}

EXPERIENCE & EDUCATION:
- Employment Status: ${experience.employment_status || 'Not specified'}
- Education Level: ${experience.education_level || 'Not specified'}
- Field of Study: ${experience.field_of_study || 'Not specified'}

SKILLS & EXPERTISE:
- Technical Skills: ${skills.technical_skills?.join(', ') || 'Not specified'}
- Software/Tools: ${skills.software_tools?.join(', ') || 'Not specified'}
- Certifications: ${skills.certifications?.join(', ') || 'Not specified'}
- Key Strengths: ${skills.key_strengths?.join(', ') || 'Not specified'}

LANGUAGES:
${languages?.length > 0 
  ? languages.map((lang: any) => `- ${lang.language}: ${lang.proficiency_level}`).join('\n')
  : '- Not specified'
}

APPLICATION PREFERENCES:
- Desired Application Volume: ${appPrefs.applications_per_week || 'Not specified'} applications per week
- Companies to Avoid: ${appPrefs.blacklisted_companies?.join(', ') || 'None specified'}

Based on this information, create a compelling professional profile that:
1. Summarizes their professional background and key qualifications
2. Highlights their technical skills and expertise areas
3. Mentions their career goals and job search preferences
4. Emphasizes their unique value proposition
5. Is written in a professional, engaging tone

The profile should be 3-4 paragraphs and serve as a master profile for job applications.`;
}

export async function GET() {
  return NextResponse.json({
    name: 'Generate User Profile API',
    description: 'Generates AI-powered professional profiles based on onboarding data',
    version: '1.0'
  });
}
