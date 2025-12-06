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

// Cover letter can be either a string or an object with PDF data
const CoverLetterSchema = z.union([
  z.string(),
  z.object({
    fileName: z.string(),
    fileType: z.string(),
    contentBase64: z.string(),
  }),
]).optional().nullable();

const CloudApplyRequestSchema = z.object({
  jobUrl: z.string().url(),
  userId: z.string(),
  coverLetter: CoverLetterSchema,
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
      const { data } = await supabase.from('education_entries').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (data) educationEntries = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('experience_entries').select('*').eq('user_id', userId).order('start_date', { ascending: false });
      if (data) experienceEntries = data;
    } catch (e) {}

    try {
      const { data } = await supabase.from('user_resumes').select('file_name, file_type, file_size, file_content').eq('user_id', userId).single();
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
        position: exp.position || '',
        company: exp.company || '',
        location: exp.location || '',
        startDate: exp.start_date || '',
        endDate: exp.end_date || '',
        current: exp.current || false,
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` :
                 exp.start_date && exp.current ? `${exp.start_date} - Present` : exp.start_date || '',
        description: exp.description || ''
      })) : parsedResumeData?.experience || [],
      education: educationEntries.length > 0 ? educationEntries.map((edu: any) => ({
        school: edu.school || '',
        degree: edu.degree || '',
        startDate: edu.start_date || '',
        endDate: edu.end_date || '',
        current: edu.current || false,
        dateRange: edu.start_date && edu.end_date ? `${edu.start_date} - ${edu.end_date}` :
                   edu.start_date && edu.current ? `${edu.start_date} - Present` :
                   edu.end_date || edu.start_date || ''
      })) : parsedResumeData?.education || [],
      skills: {
        technical: skillsCerts?.technical_skills || parsedResumeData?.skills?.technical || [],
        languages: languages.map((lang: any) => `${lang.language} (${lang.proficiency_level})`),
      },
      workAuthorized: workAuth?.work_authorized || true,
      requiresSponsorship: workAuth?.visa_sponsorship_required || false,
      yearsOfExperience: parsedResumeData?.yearsOfExperience || experienceEntries.length.toString() || '3',

      // Work email credentials for login/signup (from @nuclei-mail.com)
      workEmail: userProfile?.work_email || null,
      workPassword: userProfile?.work_email_password || null,

      // Resume file from user_resumes table (binary content as base64)
      resumeFile: userResume?.file_content ? {
        fileName: userResume.file_name,
        fileType: userResume.file_type,
        fileSize: userResume.file_size,
        contentBase64: userResume.file_content.toString('base64')
      } : null,
      resumePath: null,
      resumeUrl: userProfile?.resume_url || parsedResumeData?.resumeUrl || null,    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 [Cloud-Apply] Received request body:', {
      jobUrl: body.jobUrl,
      userId: body.userId,
      hasCoverLetter: !!body.coverLetter,
      coverLetterType: body.coverLetter ? (typeof body.coverLetter === 'object' ? 'object' : 'string') : 'null'
    });
    
    const validatedData = CloudApplyRequestSchema.parse(body);
    const coverLetter = validatedData.coverLetter || null;
    
    console.log('✅ [Cloud-Apply] Validation successful');

    // Step 1: Check if user has credits before proceeding
    console.log('🔍 [Cloud-Apply] Checking credits for user:', validatedData.userId);
    const { data: creditData, error: creditError } = await supabase.rpc('check_auto_apply_credits', {
      p_user_id: validatedData.userId
    });

    if (creditError) {
      console.error('❌ Error checking credits:', creditError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify credits',
          needsUpgrade: true
        },
        { status: 403 }
      );
    }

    if (!creditData || creditData.length === 0 || !creditData[0].has_credits) {
      console.warn('⚠️ User has no credits remaining');
      return NextResponse.json(
        {
          success: false,
          error: 'No application credits remaining. Please upgrade your plan.',
          needsUpgrade: true,
          creditsRemaining: creditData?.[0]?.credits_remaining || 0,
          planName: creditData?.[0]?.plan_name || 'Free'
        },
        { status: 403 }
      );
    }

    console.log('✅ Credits available:', creditData[0].credits_remaining);

    console.log('🚀 [Cloud-Apply] Fetching user profile...');
    const userProfile = await fetchUserProfileData(validatedData.userId);
    console.log('✅ Profile fetched:', userProfile.fullName);
    console.log('📄 Resume file:', userProfile.resumeFile || 'NOT PROVIDED');

    console.log('📡 Calling Stagehand API...');
    const response = await fetch(`${STAGEHAND_API_URL}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobUrl: validatedData.jobUrl,
        userProfile,
        coverLetter: coverLetter,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Stagehand API error:', result);
      throw new Error(result.error || 'Stagehand API request failed');
    }

    console.log('✅ Application submitted:', result);

    // Step 2: Deduct credit after successful submission
    console.log('💳 [Cloud-Apply] Deducting credit for user:', validatedData.userId);
    const { data: deductData, error: deductError } = await supabase.rpc('consume_auto_apply_credit', {
      p_user_id: validatedData.userId,
      p_job_id: validatedData.jobUrl, // Using job URL as unique identifier
      p_job_url: validatedData.jobUrl,
      p_company_name: result.companyName || 'Unknown Company',
      p_job_title: result.jobTitle || 'Unknown Position'
    });

    if (deductError) {
      console.error('⚠️ Warning: Failed to deduct credit:', deductError);
      // Don't fail the request, just log the error
      // The application was successful, so we return success to the user
    } else if (deductData && deductData.length > 0 && deductData[0].success) {
      console.log('✅ Credit deducted successfully. Remaining:', deductData[0].credits_remaining);
    } else {
      console.warn('⚠️ Credit deduction returned non-success:', deductData?.[0]?.message);
    }

    // Fetch updated credit info to return to client
    const { data: updatedCredits } = await supabase.rpc('check_auto_apply_credits', {
      p_user_id: validatedData.userId
    });

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      sessionUrl: result.sessionUrl,
      message: result.message,
      creditsRemaining: updatedCredits?.[0]?.credits_remaining,
      creditsLimit: updatedCredits?.[0]?.credits_limit
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
