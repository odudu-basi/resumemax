import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const runtime = 'nodejs';

// Stagehand API URL (Railway service)
const STAGEHAND_API_URL = process.env.STAGEHAND_API_URL || 'http://localhost:3001';

const CloudApplyRequestSchema = z.object({
  jobUrl: z.string().url(),
  userId: z.string(),
});

async function fetchUserProfileData(userId: string) {
  try {
    console.log('🔍 Fetching profile for:', userId);

    let userProfile = null;
    let workAuth = null;
    let skillsCerts = null;
    let languages:any[] = [];
    let educationEntries:any[] = [];
    let experienceEntries:any[] = [];
    let userResume = null;

    try {
      let { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
      if (error && error.code === '42703') {
        const result = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();
        data = result.data;
      }
      if (data) userProfile = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('work_authorization').select('*').eq('user_id', userId).single();
      if (data) workAuth = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('skills_certifications').select('*').eq('user_id', userId).single();
      if (data) skillsCerts = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('language_skills').select('*').eq('user_id', userId);
      if (data) languages = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('education_entries').select('*').eq('user_id', userId).order('start_year', { ascending: false });
      if (data) educationEntries = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('experience_entries').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (data) experienceEntries = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('user_resumes').select('*').eq('user_id', userId).single();
      if (data) userResume = data;
    } catch (e) {}

    let parsedResumeData = null;
    if (userProfile?.parsed_resume_data) {
      try {
        parsedResumeData = typeof userProfile.parsed_resume_data === 'string'
          ? JSON.parse(userProfile.parsed_resume_data)
          : userProfile.parsed_resume_data;
      } catch (e) {}
    }

    return {
      fullName: userProfile?.full_name || parsedResumeData?.personalInfo?.name || 'John Doe',
      email: userProfile?.email || parsedResumeData?.personalInfo?.email || 'user@example.com',
      phone: userProfile?.phone || parsedResumeData?.personalInfo?.phone || '555-1234',
      location: userProfile?.location || parsedResumeData?.personalInfo?.location || 'San Francisco',
      linkedinUrl: userProfile?.linkedin_url || parsedResumeData?.personalInfo?.linkedinUrl || null,
      workExperience: experienceEntries.length > 0 ? experienceEntries.map((exp: any) => ({
        title: exp.role || '',
        company: exp.company || '',
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` :
                 exp.start_date && exp.is_current ? `${exp.start_date} - Present` : exp.start_date || '',
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
      yearsOfExperience: parsedResumeData?.yearsOfExperience || experienceEntries.length.toString() || '3',
      
      // Resume file paths from user_resumes table
      resumeFile: userResume?.file_url || userProfile?.resume_file_path || userProfile?.resume_file || null,
      resumePath: userResume?.file_url || userProfile?.resume_file_path || null,
      resumeUrl: userResume?.file_url || userProfile?.resume_url || parsedResumeData?.resumeUrl || null,    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CloudApplyRequestSchema.parse(body);

    console.log('🚀 [Cloud-Apply] Fetching user profile...');
    const userProfile = await fetchUserProfileData(validatedData.userId);
    console.log('✅ Profile fetched:', userProfile.fullName);

    console.log('📡 Calling Stagehand API...');
    const response = await fetch(`${STAGEHAND_API_URL}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobUrl: validatedData.jobUrl,
        userProfile,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Stagehand API error:', result);
      throw new Error(result.error || 'Stagehand API request failed');
    }

    console.log('✅ Application submitted:', result);

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      sessionUrl: result.sessionUrl,
      message: result.message,
    });

  } catch (error: any) {
    console.error('❌ Error:', error);

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

    const response = await fetch(`${STAGEHAND_API_URL}/session/${sessionId}`);
    const result = await response.json();

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Session lookup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
