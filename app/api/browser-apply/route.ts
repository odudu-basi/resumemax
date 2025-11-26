import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Force Node.js runtime
export const runtime = 'nodejs';

// Configuration
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PYTHON_SERVICE_API_KEY = process.env.PYTHON_SERVICE_API_KEY || '';

// Request schema validation - simplified to just require jobUrl and userId
// All other data will be fetched from the database
const BrowserApplyRequestSchema = z.object({
  jobUrl: z.string().url(),
  userId: z.string(),
  sessionId: z.string().optional(),

  // Configuration
  headless: z.boolean().default(true),
  timeout: z.number().default(300),
});

type BrowserApplyRequest = z.infer<typeof BrowserApplyRequestSchema>;

/**
 * Fetch comprehensive user profile data from database
 */
async function fetchUserProfileData(userId: string) {
  try {
    console.log('🔍 [Browser-Apply] Fetching comprehensive user profile for userId:', userId);
    
    // Initialize variables for all data sources
    let userProfile = null;
    let resume = null;
    let workAuth = null;
    let jobCriteria = null;
    let experienceEducation = null;
    let skillsCerts = null;
    let languages = [];
    let appPreferences = null;
    let demographics = null;
    let educationEntries = [];
    let experienceEntries = [];
    
    // Fetch from user_profiles table (basic info + parsed_resume_data)
    // Try both id and user_id to handle different schema versions
    try {
      let { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // If id column doesn't exist, try user_id
      if (error && error.code === '42703') {
        console.log('🔄 [Browser-Apply] Trying user_id column instead of id');
        const result = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        data = result.data;
        error = result.error;
      }
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
      } else {
        userProfile = data;
        console.log('✅ [Browser-Apply] User profile fetched:', !!userProfile);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch user profile');
    }

    // Fetch from resumes table
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching resume:', error);
      } else {
        resume = data;
        console.log('✅ [Browser-Apply] Resume fetched:', !!resume);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch resume');
    }

    // Fetch from work_authorization table
    try {
      const { data, error } = await supabase
        .from('work_authorization')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching work authorization:', error);
      } else {
        workAuth = data;
        console.log('✅ [Browser-Apply] Work authorization fetched:', !!workAuth);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch work authorization');
    }

    // Fetch from job_search_criteria table
    try {
      const { data, error } = await supabase
        .from('job_search_criteria')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching job search criteria:', error);
      } else {
        jobCriteria = data;
        console.log('✅ [Browser-Apply] Job criteria fetched:', !!jobCriteria);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch job criteria');
    }

    // Fetch from experience_education table
    try {
      const { data, error } = await supabase
        .from('experience_education')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching experience education:', error);
      } else {
        experienceEducation = data;
        console.log('✅ [Browser-Apply] Experience education fetched:', !!experienceEducation);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch experience education');
    }

    // Fetch from skills_certifications table
    try {
      const { data, error } = await supabase
        .from('skills_certifications')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching skills certifications:', error);
      } else {
        skillsCerts = data;
        console.log('✅ [Browser-Apply] Skills certifications fetched:', !!skillsCerts);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch skills certifications');
    }

    // Fetch from language_skills table (multiple records)
    try {
      const { data, error } = await supabase
        .from('language_skills')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching language skills:', error);
      } else {
        languages = data || [];
        console.log('✅ [Browser-Apply] Language skills fetched:', languages.length, 'languages');
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch language skills');
    }

    // Fetch from application_preferences table
    try {
      const { data, error } = await supabase
        .from('application_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching application preferences:', error);
      } else {
        appPreferences = data;
        console.log('✅ [Browser-Apply] Application preferences fetched:', !!appPreferences);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch application preferences');
    }

    // Fetch from user_demographics table
    try {
      const { data, error } = await supabase
        .from('user_demographics')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user demographics:', error);
      } else {
        demographics = data;
        console.log('✅ [Browser-Apply] Demographics fetched:', !!demographics);
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch demographics');
    }

    // Fetch from education_entries table (multiple records)
    try {
      const { data, error } = await supabase
        .from('education_entries')
        .select('*')
        .eq('user_id', userId)
        .order('start_year', { ascending: false });
      
      if (error) {
        console.error('Error fetching education entries:', error);
      } else {
        educationEntries = data || [];
        console.log('✅ [Browser-Apply] Education entries fetched:', educationEntries.length, 'entries');
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch education entries');
    }

    // Fetch from experience_entries table (multiple records)
    try {
      const { data, error } = await supabase
        .from('experience_entries')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching experience entries:', error);
      } else {
        experienceEntries = data || [];
        console.log('✅ [Browser-Apply] Experience entries fetched:', experienceEntries.length, 'entries');
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch experience entries');
    }

    // Parse the structured resume data if available
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

    // Build comprehensive profile object using ALL available data sources
    const profile = {
      // Basic info - prioritize user_profiles, then parsed resume, then fallbacks
      fullName: userProfile?.full_name || parsedResumeData?.personalInfo?.name || 'John Doe',
      email: userProfile?.email || parsedResumeData?.personalInfo?.email || 'user@example.com',
      phone: userProfile?.phone || parsedResumeData?.personalInfo?.phone || '(555) 123-4567',
      location: userProfile?.location || parsedResumeData?.personalInfo?.location || jobCriteria?.preferred_locations?.[0] || 'San Francisco, CA',
      
      // Professional info
      linkedinUrl: userProfile?.linkedin_url || parsedResumeData?.personalInfo?.linkedinUrl || parsedResumeData?.personalInfo?.linkedIn || null,
      portfolioUrl: userProfile?.portfolio_url || parsedResumeData?.personalInfo?.portfolioUrl || null,
      
      // Work experience - prioritize experience_entries, then parsed resume, then fallback
      workExperience: experienceEntries.length > 0 ? experienceEntries.map((exp: any) => ({
        title: exp.role || '',
        company: exp.company || '',
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : 
                 exp.start_date && exp.is_current ? `${exp.start_date} - Present` : 
                 exp.start_date || '',
        description: exp.description || '',
        achievements: [],
        technologies: []
      })) : parsedResumeData?.experience?.map((exp: any) => ({
        title: exp.title || '',
        company: exp.company || '',
        duration: exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : 
                 exp.startDate ? `${exp.startDate} - Present` : '',
        description: exp.description || '',
        achievements: exp.achievements || [],
        technologies: exp.technologies || []
      })) || [
        {
          title: 'Software Engineer',
          company: 'Tech Company',
          duration: '2022 - Present',
          description: 'Developing web applications and software solutions',
          achievements: ['Built scalable applications', 'Collaborated with cross-functional teams'],
          technologies: ['JavaScript', 'React', 'Node.js']
        }
      ],
      
      // Education - prioritize education_entries, then parsed resume, then fallback
      education: educationEntries.length > 0 ? educationEntries.map((edu: any) => ({
        degree: edu.degree || '',
        field: edu.major || '',
        school: edu.school || '',
        year: edu.end_year || edu.start_year || '',
        gpa: null
      })) : parsedResumeData?.education?.map((edu: any) => ({
        degree: edu.degree || '',
        field: edu.field || '',
        school: edu.institution || edu.school || '',
        year: edu.graduationDate || '',
        gpa: edu.gpa || null
      })) || [
        {
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          school: 'University of Technology',
          year: '2020',
          gpa: null
        }
      ],
      
      // Skills - prioritize skills_certifications table, then parsed resume, then fallback
      skills: {
        technical: skillsCerts?.technical_skills || parsedResumeData?.skills?.technical || ['JavaScript', 'Python', 'React', 'Node.js'],
        languages: parsedResumeData?.skills?.languages || ['JavaScript', 'Python'],
        frameworks: parsedResumeData?.skills?.frameworks || ['React', 'Express.js'],
        tools: skillsCerts?.software_tools || parsedResumeData?.skills?.tools || ['Git', 'Docker', 'AWS'],
        soft: parsedResumeData?.skills?.soft || ['Communication', 'Problem Solving', 'Team Collaboration']
      },
      
      // Projects from parsed resume
      projects: parsedResumeData?.projects || [],
      
      // Certifications - prioritize skills_certifications table, then parsed resume
      certifications: skillsCerts?.certifications?.map((cert: string) => ({
        name: cert,
        issuer: 'Professional Organization',
        date: new Date().getFullYear().toString(),
        url: null
      })) || parsedResumeData?.certifications || [],
      
      // Career info - use parsed resume data or derive from experience
      yearsOfExperience: parsedResumeData?.yearsOfExperience || (experienceEntries.length > 0 ? experienceEntries.length.toString() : '3'),
      careerLevel: parsedResumeData?.careerLevel || (experienceEntries.length > 2 ? 'Senior' : 'Mid-level'),
      careerHighlights: parsedResumeData?.careerHighlights || skillsCerts?.key_strengths || [
        'Developed scalable web applications',
        'Led cross-functional project teams',
        'Improved system performance by 40%'
      ],
      
      // Resume data - extract text from content if it's an object
      resumeText: resume?.content ? 
        (typeof resume.content === 'string' ? resume.content : 
         typeof resume.content === 'object' && resume.content.text ? resume.content.text : 
         JSON.stringify(resume.content)) : null,
      resumeUrl: resume?.file_url || null,
      resumeFileName: resume?.file_name || null,
      
      // Cover letter - could be generated based on job criteria
      coverLetter: null,
      
      // Demographic data from user_demographics table
      gender: demographics?.gender || null,
      ethnicity: demographics?.race || null,
      veteranStatus: demographics?.veteran_status || workAuth?.veteran_status || null,
      disabilityStatus: demographics?.disability_status || workAuth?.disability_status || null,
      
      // Work authorization info
      workAuthorized: workAuth?.work_authorized || true,
      requiresSponsorship: workAuth?.visa_sponsorship_required || false,
      workArrangement: workAuth?.work_arrangement || 'flexible',
      
      // Job search preferences
      desiredJobTitles: jobCriteria?.desired_job_titles || [],
      targetIndustries: jobCriteria?.target_industries || [],
      preferredLocations: jobCriteria?.preferred_locations || [],
      minSalary: jobCriteria?.min_salary || null,
      jobType: jobCriteria?.job_type || 'full-time',
      startAvailability: jobCriteria?.start_availability || 'flexible',
      
      // Application preferences
      autoApplyEnabled: appPreferences?.auto_apply_enabled || false,
      applicationsPerWeek: appPreferences?.applications_per_week || 10,
      blacklistedCompanies: appPreferences?.blacklisted_companies || [],
      
      // Language skills
      languageSkills: languages.map((lang: any) => ({
        language: lang.language,
        proficiency: lang.proficiency_level
      })) || []
    };

    return profile;
  } catch (error) {
    console.error('Error fetching user profile data:', error);
    throw error;
  }
}

/**
 * POST /api/browser-apply
 *
 * Initiates a browser-use agent to apply to a job
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw text first to debug
    const text = await request.text();
    console.log('📥 [Browser-Apply] Raw request body:', text);

    if (!text || text.trim() === '') {
      console.error('❌ [Browser-Apply] Empty request body received');
      return NextResponse.json(
        { success: false, error: 'Request body is empty' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError: any) {
      console.error('❌ [Browser-Apply] JSON parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request
    const validatedData = BrowserApplyRequestSchema.parse(body);

    console.log('🚀 [Browser-Apply] Starting application for:', validatedData.jobUrl);
    console.log('📊 [Browser-Apply] Fetching comprehensive user profile data...');

    // Fetch comprehensive user profile data from database
    const userProfile = await fetchUserProfileData(validatedData.userId);
    
    console.log('✅ [Browser-Apply] User profile data fetched successfully');
    console.log('👤 [Browser-Apply] Profile summary:', {
      name: userProfile.fullName,
      email: userProfile.email,
      experienceCount: userProfile.workExperience?.length || 0,
      educationCount: userProfile.education?.length || 0,
      skillsCount: userProfile.skills?.technical?.length || 0,
      hasResume: !!userProfile.resumeText || !!userProfile.resumeUrl
    });

    // Convert to snake_case for Python service with comprehensive profile data
    const pythonPayload = {
      session_id: validatedData.sessionId,
      job_url: validatedData.jobUrl,
      user_id: validatedData.userId,
      
      // Basic info
      full_name: userProfile.fullName,
      email: userProfile.email,
      phone: userProfile.phone,
      location: userProfile.location,
      
      // Professional info
      linkedin_url: userProfile.linkedinUrl,
      portfolio_url: userProfile.portfolioUrl,
      
      // Resume data
      resume_text: userProfile.resumeText,
      resume_url: userProfile.resumeUrl,
      resume_file_name: userProfile.resumeFileName,
      
      // Structured data
      work_experience: userProfile.workExperience,
      education: userProfile.education,
      skills: userProfile.skills,
      projects: userProfile.projects,
      certifications: userProfile.certifications,
      
      // Career info
      years_of_experience: userProfile.yearsOfExperience,
      career_level: userProfile.careerLevel,
      career_highlights: userProfile.careerHighlights,
      
      // Generated content
      cover_letter: userProfile.coverLetter,
      
      // Demographic data (optional)
      gender: userProfile.gender,
      ethnicity: userProfile.ethnicity,
      veteran_status: userProfile.veteranStatus,
      disability_status: userProfile.disabilityStatus,
      
      // Work authorization
      work_authorized: userProfile.workAuthorized,
      requires_sponsorship: userProfile.requiresSponsorship,
      work_arrangement: userProfile.workArrangement,
      
      // Job search preferences
      desired_job_titles: userProfile.desiredJobTitles,
      target_industries: userProfile.targetIndustries,
      preferred_locations: userProfile.preferredLocations,
      min_salary: userProfile.minSalary,
      job_type: userProfile.jobType,
      start_availability: userProfile.startAvailability,
      
      // Application preferences
      auto_apply_enabled: userProfile.autoApplyEnabled,
      applications_per_week: userProfile.applicationsPerWeek,
      blacklisted_companies: userProfile.blacklistedCompanies,
      
      // Language skills
      language_skills: userProfile.languageSkills,
      
      // Configuration
      headless: validatedData.headless,
      timeout: validatedData.timeout,
    };

    // Call Python service
    console.log('📞 [Browser-Apply] Calling Python service at:', PYTHON_SERVICE_URL);

    // Call Railway browser service to submit job
    const response = await fetch(`${PYTHON_SERVICE_URL}/jobs/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PYTHON_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        user_id: validatedData.userId,
        job_url: validatedData.jobUrl,
        user_profile: pythonPayload.userProfile || {},
        resume_data: pythonPayload.resumeData || {},
        session_id: sessionId,
        additional_params: {
          headless: validatedData.headless,
          timeout: validatedData.timeout,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Browser-Apply] Python service error:', errorText);
      throw new Error(`Python service returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    // Railway service returns: { job_id, status, message, queue_position }

    console.log('✅ [Browser-Apply] Job submitted to Railway:', {
      jobId: result.job_id,
      sessionId: sessionId,
      status: result.status,
      queuePosition: result.queue_position,
    });

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      jobId: result.job_id,
      status: result.status,
      queuePosition: result.queue_position,
      message: 'Job application submitted to queue successfully',
    });

  } catch (error: any) {
    console.error('❌ [Browser-Apply] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    const message = error?.cause?.code === 'ECONNREFUSED'
      ? 'Cannot reach Python service. Ensure it is running on http://localhost:8000 (try 127.0.0.1:8000)'
      : (error.message || 'Internal server error');

    return NextResponse.json(
      { success: false, error: message },
      { status: error?.cause?.code === 'ECONNREFUSED' ? 503 : 500 }
    );
  }
}

/**
 * GET /api/browser-apply?sessionId=xxx
 *
 * Check the status of a job application session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [Browser-Apply] Checking status for session:', sessionId);

    // Call Python service status endpoint
    const response = await fetch(`${PYTHON_SERVICE_URL}/status/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        );
      }

      const errorText = await response.text();
      throw new Error(`Python service returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      sessionId: result.session_id,
      status: result.status,
      progress: result.progress,
      error: result.error,
      result: result.result,
      actionLog: result.action_log || [],
    });

  } catch (error: any) {
    console.error('❌ [Browser-Apply] Status check error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
