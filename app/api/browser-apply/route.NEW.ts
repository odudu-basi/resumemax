/**
 * UPDATED Browser Apply Route - Queue-based Architecture
 *
 * This route now submits jobs to a Redis queue instead of direct processing.
 * Benefits:
 * - Better scalability with background workers
 * - Graceful handling of high load
 * - Retry logic with exponential backoff
 * - API key authentication for internal service
 */

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

// Configuration
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8000';
const BROWSER_SERVICE_API_KEY = process.env.BROWSER_SERVICE_API_KEY || '';

// Request schema
const BrowserApplyRequestSchema = z.object({
  jobUrl: z.string().url(),
  userId: z.string(),
  sessionId: z.string().optional(),
  headless: z.boolean().default(true),
  timeout: z.number().default(300),
});

type BrowserApplyRequest = z.infer<typeof BrowserApplyRequestSchema>;

/**
 * Fetch comprehensive user profile data from database
 * (Keep your existing fetchUserProfileData function here - unchanged)
 */
async function fetchUserProfileData(userId: string) {
  // ... [Copy your existing implementation from the current route.ts]
  // This function remains the same
  try {
    console.log('🔍 [Browser-Apply] Fetching comprehensive user profile for userId:', userId);

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

    // Fetch from user_profiles table
    try {
      let { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === '42703') {
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
      }
    } catch (error) {
      console.warn('⚠️ [Browser-Apply] Could not fetch resume');
    }

    // ... Continue with other data fetches from your existing implementation

    // Return consolidated data
    return {
      userProfile,
      resume,
      workAuth,
      jobCriteria,
      experienceEducation,
      skillsCerts,
      languages,
      appPreferences,
      demographics,
      educationEntries,
      experienceEntries,
    };
  } catch (error) {
    console.error('Error fetching user profile data:', error);
    throw error;
  }
}

/**
 * Submit job with retry logic
 */
async function submitJobWithRetry(
  payload: any,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`📞 [Browser-Apply] Calling browser service (attempt ${attempt + 1}/${maxRetries})`);

      const response = await fetch(`${BROWSER_SERVICE_URL}/jobs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': BROWSER_SERVICE_API_KEY,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Browser service returned ${response.status}: ${errorText}`);
      }

      return await response.json();

    } catch (error: any) {
      lastError = error;
      console.warn(
        `⚠️ [Browser-Apply] Attempt ${attempt + 1} failed:`,
        error.message
      );

      // Don't retry on authentication errors
      if (error.message.includes('401')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`⏳ [Browser-Apply] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to submit job after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * POST /api/browser-apply
 *
 * Submit a browser automation job to the queue
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📥 [Browser-Apply] Received request');

    // Parse and validate request
    const body = await request.json();
    const validatedData = BrowserApplyRequestSchema.parse(body);

    console.log('✅ [Browser-Apply] Request validated:', {
      userId: validatedData.userId,
      jobUrl: validatedData.jobUrl,
    });

    // Generate session ID if not provided
    const sessionId = validatedData.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Fetch user profile data
    console.log('🔍 [Browser-Apply] Fetching user profile data...');
    const userData = await fetchUserProfileData(validatedData.userId);

    console.log('✅ [Browser-Apply] User profile data fetched successfully');

    // Prepare payload for browser service
    const jobPayload = {
      user_id: validatedData.userId,
      job_url: validatedData.jobUrl,
      session_id: sessionId,
      user_profile: userData.userProfile || {},
      resume_data: userData.resume || {},
      additional_params: {
        work_auth: userData.workAuth,
        job_criteria: userData.jobCriteria,
        experience_education: userData.experienceEducation,
        skills_certs: userData.skillsCerts,
        languages: userData.languages,
        app_preferences: userData.appPreferences,
        demographics: userData.demographics,
        education_entries: userData.educationEntries,
        experience_entries: userData.experienceEntries,
        headless: validatedData.headless,
        timeout: validatedData.timeout,
      },
    };

    // Submit job to queue with retry logic
    console.log('🚀 [Browser-Apply] Submitting job to queue...');
    const jobResponse = await submitJobWithRetry(jobPayload);

    console.log('✅ [Browser-Apply] Job submitted to queue:', {
      job_id: jobResponse.job_id,
      status: jobResponse.status,
      queue_position: jobResponse.queue_position,
    });

    // Create initial session record in database
    try {
      await supabase.from('auto_apply_sessions').insert({
        id: sessionId,
        user_id: validatedData.userId,
        job_url: validatedData.jobUrl,
        job_id: jobResponse.job_id, // Store RQ job ID
        status: 'queued',
        queue_position: jobResponse.queue_position,
        created_at: new Date().toISOString(),
      });

      console.log('✅ [Browser-Apply] Session record created in database');
    } catch (dbError: any) {
      console.error('⚠️ [Browser-Apply] Failed to create session record:', dbError.message);
      // Don't fail the request if DB insert fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      session_id: sessionId,
      job_id: jobResponse.job_id,
      status: jobResponse.status,
      message: jobResponse.message,
      queue_position: jobResponse.queue_position,
    }, { status: 202 }); // 202 Accepted - job is queued

  } catch (error: any) {
    console.error('❌ [Browser-Apply] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/browser-apply?session_id=xxx
 *
 * Check the status of a browser automation job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id parameter is required' },
        { status: 400 }
      );
    }

    // Get session from database to find job_id
    const { data: session, error: dbError } = await supabase
      .from('auto_apply_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (dbError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Query job status from browser service
    if (session.job_id) {
      try {
        const response = await fetch(`${BROWSER_SERVICE_URL}/jobs/${session.job_id}`, {
          headers: {
            'X-API-Key': BROWSER_SERVICE_API_KEY,
          },
        });

        if (response.ok) {
          const jobStatus = await response.json();

          // Update session in database if status changed
          if (jobStatus.status !== session.status) {
            await supabase
              .from('auto_apply_sessions')
              .update({
                status: jobStatus.status,
                result: jobStatus.result,
                error: jobStatus.error,
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionId);
          }

          return NextResponse.json({
            session_id: sessionId,
            job_id: session.job_id,
            status: jobStatus.status,
            result: jobStatus.result,
            error: jobStatus.error,
            created_at: jobStatus.created_at,
            started_at: jobStatus.started_at,
            ended_at: jobStatus.ended_at,
          });
        }
      } catch (serviceError: any) {
        console.error('Error querying browser service:', serviceError);
      }
    }

    // Fallback to database status
    return NextResponse.json({
      session_id: sessionId,
      job_id: session.job_id,
      status: session.status,
      result: session.result,
      error: session.error,
    });

  } catch (error: any) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
