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
    const { sessionId, userId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking submission status for session: ${sessionId}`);

    // Get the current session from database
    const { data: session, error: sessionError } = await supabase
      .from('auto_apply_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // If already submitted, return current status
    if (session.status === 'submitted') {
      return NextResponse.json({
        success: true,
        status: 'submitted',
        message: 'Session already marked as submitted',
        submittedAt: session.closed_at
      });
    }

    // For now, we'll rely on manual marking via the "Mark as Submitted" button
    // The localStorage approach requires the user to manually trigger the status update
    // This endpoint serves as a way to check current status and potentially update it

    return NextResponse.json({
      success: true,
      status: session.status,
      message: 'Session status checked',
      currentStatus: session.status
    });

  } catch (error: any) {
    console.error('❌ Error checking submission status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Check Submission Status API',
    description: 'Checks the submission status of auto-apply sessions',
    usage: {
      method: 'POST',
      body: {
        sessionId: 'string (required)',
        userId: 'string (optional) - for additional security'
      }
    }
  });
}
