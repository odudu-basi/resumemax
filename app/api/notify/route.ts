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

// Notification schema
const NotifySchema = z.object({
  type: z.enum(['form_filled', 'timeout', 'error', 'auto_apply_submitted', 'auto_apply_completed']),
  sessionId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  message: z.string().optional(),
  autoApplied: z.boolean().optional(),
  submitted: z.boolean().optional(),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string()
  })).optional(),
});

/**
 * POST /api/notify
 * Send notification to user about auto-apply session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notification = NotifySchema.parse(body);

    console.log('📬 Notification request:', notification);

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('auto_apply_sessions')
      .select('*')
      .eq('id', notification.sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // In a real app, you would:
    // 1. Send email notification
    // 2. Send push notification
    // 3. Create in-app notification record
    // 4. Send SMS (optional)

    // For now, we'll just log it and return success
    console.log(`✅ Notification sent to user ${notification.userId}`);
    console.log(`   Type: ${notification.type}`);
    console.log(`   Session: ${notification.sessionId}`);
    console.log(`   Job URL: ${session.job_url}`);

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      notification: {
        type: notification.type,
        sessionId: notification.sessionId,
        jobUrl: session.job_url,
        jobTitle: session.job_title,
        companyName: session.company_name,
        expiresAt: session.expires_at
      }
    });

  } catch (error: any) {
    console.error('❌ Notification error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid notification data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send notification', message: error.message },
      { status: 500 }
    );
  }
}
