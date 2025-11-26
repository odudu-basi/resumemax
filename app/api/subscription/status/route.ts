import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's subscription status
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .rpc('get_user_subscription_status', { p_user_id: userId });

    if (subscriptionError) {
      console.error('Error fetching subscription status:', subscriptionError);
      return NextResponse.json({ error: 'Failed to fetch subscription status' }, { status: 500 });
    }

    // Check auto-apply credits
    const { data: creditsData, error: creditsError } = await supabase
      .rpc('check_auto_apply_credits', { p_user_id: userId });

    if (creditsError) {
      console.error('Error checking credits:', creditsError);
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }

    const subscription = subscriptionData?.[0] || null;
    const credits = creditsData?.[0] || null;

    return NextResponse.json({
      success: true,
      subscription,
      credits,
      hasActiveSubscription: !!subscription,
      canAutoApply: credits?.has_credits || false
    });

  } catch (error: any) {
    console.error('Error in subscription status API:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, jobId, jobTitle, companyName, jobUrl } = await request.json();

    if (!userId || !jobId) {
      return NextResponse.json({ error: 'User ID and Job ID are required' }, { status: 400 });
    }

    // Consume auto-apply credit
    const { data: consumeData, error: consumeError } = await supabase
      .rpc('consume_auto_apply_credit', {
        p_user_id: userId,
        p_job_id: jobId,
        p_job_title: jobTitle,
        p_company_name: companyName,
        p_job_url: jobUrl
      });

    if (consumeError) {
      console.error('Error consuming credit:', consumeError);
      return NextResponse.json({ error: 'Failed to consume credit' }, { status: 500 });
    }

    const result = consumeData?.[0];

    if (!result?.success) {
      return NextResponse.json({
        success: false,
        error: result?.message || 'Failed to consume credit',
        creditsRemaining: result?.credits_remaining || 0
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      creditsRemaining: result.credits_remaining
    });

  } catch (error: any) {
    console.error('Error consuming auto-apply credit:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}