import { NextRequest, NextResponse } from 'next/server';
import { generateGmailAuthUrl } from '@/src/lib/gmail-oauth';
import { createClient } from '@supabase/supabase-js';

/**
 * Initiate Gmail OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Verify user exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate OAuth URL
    const authUrl = generateGmailAuthUrl(userId);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);

  } catch (error: any) {
    console.error('Error initiating Gmail OAuth:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
