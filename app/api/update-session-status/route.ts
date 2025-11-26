import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, status, userId } = await request.json();

    if (!sessionId || !status) {
      return NextResponse.json(
        { success: false, error: 'Session ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['submitted', 'timeout', 'error', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be one of: submitted, timeout, error, cancelled' },
        { status: 400 }
      );
    }

    console.log(`🔄 Updating session ${sessionId} status to: ${status}`);

    // Update the session status and set closed_at timestamp
    const updateData: any = {
      status: status,
      closed_at: new Date().toISOString()
    };

    // Build the query
    let query = supabase
      .from('auto_apply_sessions')
      .update(updateData)
      .eq('id', sessionId);

    // If userId is provided, add it as an additional filter for security
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.select('*').single();

    if (error) {
      console.error('❌ Error updating session status:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update session status', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`✅ Session ${sessionId} status updated to: ${status}`);

    return NextResponse.json({
      success: true,
      message: `Session status updated to ${status}`,
      session: data
    });

  } catch (error: any) {
    console.error('❌ Error in update-session-status API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Update Session Status API',
    description: 'Updates the status of auto-apply sessions',
    supportedStatuses: ['submitted', 'timeout', 'error', 'cancelled'],
    usage: {
      method: 'POST',
      body: {
        sessionId: 'string (required)',
        status: 'string (required) - one of: submitted, timeout, error, cancelled',
        userId: 'string (optional) - for additional security'
      }
    }
  });
}
