import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

const config = getConfig();

// Schema for updating a saved job
const UpdateJobSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(['saved', 'applied', 'interviewing', 'rejected', 'accepted']).optional(),
  applicationDate: z.string().optional(),
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
 * PATCH /api/saved-jobs/[id]
 * Updates a saved job (notes, status, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserFromAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = UpdateJobSchema.parse(body);

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // Build update object
    const updateData: any = {};
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.applicationDate !== undefined) {
      updateData.application_date = validated.applicationDate;
    }

    // Update the saved job
    const { data: updatedJob, error } = await supabase
      .from('saved_jobs')
      .update(updateData)
      .eq('id', jobId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating saved job:', error);
      return NextResponse.json(
        { error: 'Failed to update job' },
        { status: 500 }
      );
    }

    if (!updatedJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: 'Job updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/saved-jobs/[id]:', error);

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
 * GET /api/saved-jobs/[id]
 * Get details of a specific saved job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserFromAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    const { data: savedJob, error } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !savedJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: savedJob,
    });
  } catch (error) {
    console.error('Error in GET /api/saved-jobs/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
