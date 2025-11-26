import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

const config = getConfig();

// Schema for saving a job
const SaveJobSchema = z.object({
  jobTitle: z.string(),
  companyName: z.string(),
  jobUrl: z.string().url(),
  jobDescription: z.string().optional(),
  jobLocation: z.string().optional(),
  salaryRange: z.string().optional(),
  matchScore: z.number().min(0).max(100).optional(),
  matchReasons: z.array(z.string()).optional(),
  source: z.string().optional(),
  postedDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['saved', 'applied', 'interviewing', 'rejected', 'accepted']).optional(),
});

// Get user from authorization header
async function getUserFromAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error verifying user:', error);
    return null;
  }
}

/**
 * GET /api/saved-jobs
 * Retrieves all saved jobs for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('saved_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status && ['saved', 'applied', 'interviewing', 'rejected', 'accepted'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: savedJobs, error } = await query;

    if (error) {
      console.error('Error fetching saved jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch saved jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobs: savedJobs,
      count: savedJobs.length,
    });
  } catch (error) {
    console.error('Error in GET /api/saved-jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-jobs
 * Saves a new job for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = SaveJobSchema.parse(body);

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // Insert the saved job
    const { data: savedJob, error } = await supabase
      .from('saved_jobs')
      .insert({
        user_id: userId,
        job_title: validated.jobTitle,
        company_name: validated.companyName,
        job_url: validated.jobUrl,
        job_description: validated.jobDescription,
        job_location: validated.jobLocation,
        salary_range: validated.salaryRange,
        match_score: validated.matchScore,
        match_reasons: validated.matchReasons,
        source: validated.source,
        posted_date: validated.postedDate,
        notes: validated.notes,
        status: validated.status || 'saved',
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'This job has already been saved' },
          { status: 409 }
        );
      }

      console.error('Error saving job:', error);
      return NextResponse.json(
        { error: 'Failed to save job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: savedJob,
      message: 'Job saved successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/saved-jobs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-jobs
 * Deletes a saved job
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting saved job:', error);
      return NextResponse.json(
        { error: 'Failed to delete job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/saved-jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
