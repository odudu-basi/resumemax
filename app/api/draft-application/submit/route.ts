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
 * Update draft with user edits and mark as reviewed
 * PUT /api/draft-application/submit
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      draftId,
      formFields, // Updated form fields with user edits
      userNotes
    } = body;

    if (!draftId || !formFields) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update draft with user edits
    const { data, error } = await supabase
      .from('draft_applications')
      .update({
        form_fields: formFields,
        user_notes: userNotes,
        status: 'reviewed',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', draftId)
      .select()
      .single();

    if (error) {
      console.error('Error updating draft:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Draft ${draftId} marked as reviewed and ready for submission`);

    return NextResponse.json({
      success: true,
      draft: data,
      message: 'Draft updated and marked as reviewed'
    });

  } catch (error: any) {
    console.error('Error updating draft:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Submit reviewed application
 * POST /api/draft-application/submit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      draftId,
      userId
    } = body;

    if (!draftId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get draft data
    const { data: draft, error: fetchError } = await supabase
      .from('draft_applications')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    console.log(`\n🚀 SUBMITTING REVIEWED APPLICATION`);
    console.log(`   Job: ${draft.job_title} at ${draft.company_name}`);
    console.log(`   Fields to fill: ${draft.form_fields.length}`);

    // Call intelligent-apply with reviewed data
    const applyResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/intelligent-apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: draft.job_url,
          userId: userId,
          options: {
            submitForm: true,
            useReviewedData: true,
            reviewedData: {
              formFields: draft.form_fields
            }
          }
        })
      }
    );

    const applyResult = await applyResponse.json();

    if (!applyResponse.ok) {
      throw new Error(applyResult.error || 'Failed to submit application');
    }

    // Update draft status to submitted
    await supabase
      .from('draft_applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submission_session_id: applyResult.sessionId
      })
      .eq('id', draftId);

    console.log(`✅ Application submitted successfully!`);

    return NextResponse.json({
      success: true,
      sessionId: applyResult.sessionId,
      message: 'Application submitted successfully'
    });

  } catch (error: any) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
