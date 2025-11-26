import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const runtime = 'nodejs';

/**
 * Save draft application data for user review
 * POST /api/draft-application/save
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      jobTitle,
      companyName,
      jobUrl,
      jobDescription,
      formFields, // Array of { fieldId, label, type, value, aiGenerated, options }
      userNotes
    } = body;

    // Validation
    if (!userId || !jobTitle || !companyName || !jobUrl || !formFields) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if draft already exists for this job
    const { data: existingDraft } = await supabase
      .from('draft_applications')
      .select('id')
      .eq('user_id', userId)
      .eq('job_url', jobUrl)
      .single();

    let result;

    if (existingDraft) {
      // Update existing draft
      result = await supabase
        .from('draft_applications')
        .update({
          job_title: jobTitle,
          company_name: companyName,
          job_description: jobDescription,
          form_fields: formFields,
          user_notes: userNotes,
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDraft.id)
        .select()
        .single();

      console.log(`✅ Updated draft application for ${jobTitle} at ${companyName}`);
    } else {
      // Create new draft
      result = await supabase
        .from('draft_applications')
        .insert({
          user_id: userId,
          job_title: jobTitle,
          company_name: companyName,
          job_url: jobUrl,
          job_description: jobDescription,
          form_fields: formFields,
          user_notes: userNotes,
          status: 'draft'
        })
        .select()
        .single();

      console.log(`✅ Created new draft application for ${jobTitle} at ${companyName}`);
    }

    if (result.error) {
      console.error('Error saving draft:', result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      draft: result.data,
      message: 'Draft application saved successfully'
    });

  } catch (error: any) {
    console.error('Error in save draft application:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get draft applications for a user
 * GET /api/draft-application/save?userId={userId}&status={status}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'draft';

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('draft_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching drafts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      drafts: data || []
    });

  } catch (error: any) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
