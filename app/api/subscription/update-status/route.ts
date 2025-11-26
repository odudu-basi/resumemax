import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const { userId, jobId, status, errorMessage } = await request.json();

    if (!userId || !jobId || !status) {
      return NextResponse.json({ 
        error: 'User ID, Job ID, and status are required' 
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['success', 'failed', 'pending'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be: success, failed, or pending' 
      }, { status: 400 });
    }

    // Update auto-apply status
    const { data: updateData, error: updateError } = await supabase
      .rpc('update_auto_apply_status', {
        p_user_id: userId,
        p_job_id: jobId,
        p_status: status,
        p_error_message: errorMessage || null
      });

    if (updateError) {
      console.error('Error updating auto-apply status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update auto-apply status' 
      }, { status: 500 });
    }

    if (!updateData) {
      return NextResponse.json({ 
        error: 'Auto-apply record not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-apply status updated successfully'
    });

  } catch (error: any) {
    console.error('Error in update auto-apply status API:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
