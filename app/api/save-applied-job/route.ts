import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/src/lib/supabase';
import { z } from 'zod';

// Schema for validating applied job data
const AppliedJobSchema = z.object({
  userId: z.string().uuid(),
  jobUrl: z.string().url(),
  jobTitle: z.string(),
  companyName: z.string(),
  location: z.string().optional(),
  jobType: z.string().optional(),
  salaryRange: z.string().optional(),
  datePosted: z.string().optional(),
  jobDescription: z.string().optional(),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  sessionId: z.string().optional(),
  sessionUrl: z.string().optional(),
  sessionVideoUrl: z.string().optional(), // NEW: Video recording URL
  filledFields: z.record(z.string()).optional(), // NEW: Extracted form fields
  coverLetterGenerated: z.boolean().optional(),
  extractedAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body
    const validatedData = AppliedJobSchema.parse(body);

    console.log('💾 Saving applied job to database:', {
      userId: validatedData.userId,
      jobTitle: validatedData.jobTitle,
      company: validatedData.companyName,
    });

    const supabase = createSupabaseClient();

    // Insert the applied job record
    const { data, error } = await supabase
      .from('applied_jobs')
      .insert({
        user_id: validatedData.userId,
        job_url: validatedData.jobUrl,
        job_title: validatedData.jobTitle,
        company_name: validatedData.companyName,
        location: validatedData.location,
        job_type: validatedData.jobType,
        salary_range: validatedData.salaryRange,
        date_posted: validatedData.datePosted,
        job_description: validatedData.jobDescription,
        requirements: validatedData.requirements,
        benefits: validatedData.benefits,
        session_id: validatedData.sessionId,
        session_url: validatedData.sessionUrl,
        session_video_url: validatedData.sessionVideoUrl, // NEW
        filled_fields: validatedData.filledFields, // NEW
        cover_letter_generated: validatedData.coverLetterGenerated || false,
        extracted_at: validatedData.extractedAt,
        application_status: 'applied',
      })
      .select()
      .single();

    if (error) {
      // Check if it's a unique constraint violation (already applied)
      if (error.code === '23505') {
        console.log('⚠️  User has already applied to this job');
        return NextResponse.json(
          {
            success: false,
            error: 'You have already applied to this job',
            alreadyApplied: true,
          },
          { status: 409 }
        );
      }

      console.error('❌ Error saving applied job:', error);
      throw error;
    }

    console.log('✅ Applied job saved successfully:', data.id);

    return NextResponse.json({
      success: true,
      appliedJob: data,
      message: 'Job application saved successfully',
    });

  } catch (error: any) {
    console.error('❌ Error in save-applied-job API:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save applied job',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch user's applied jobs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('📋 Fetching applied jobs for user:', userId);

    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('applied_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching applied jobs:', error);
      throw error;
    }

    console.log(`✅ Found ${data.length} applied jobs`);

    return NextResponse.json({
      success: true,
      appliedJobs: data,
      count: data.length,
    });

  } catch (error: any) {
    console.error('❌ Error in GET applied jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch applied jobs',
      },
      { status: 500 }
    );
  }
}
