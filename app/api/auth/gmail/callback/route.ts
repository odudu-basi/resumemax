import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Handle Gmail OAuth2 callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/dashboard?gmail_auth=error&message=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?gmail_auth=error&message=Missing code or state', request.url)
      );
    }

    const userId = state;

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard?gmail_auth=error&message=Failed to get tokens', request.url)
      );
    }

    // Store tokens in database
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        gmail_access_token: tokens.access_token,
        gmail_refresh_token: tokens.refresh_token,
        gmail_connected_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error storing Gmail tokens:', updateError);
      return NextResponse.redirect(
        new URL('/dashboard?gmail_auth=error&message=Failed to store tokens', request.url)
      );
    }

    console.log('✅ Gmail OAuth tokens stored successfully for user:', userId);

    return NextResponse.redirect(
      new URL('/dashboard?gmail_auth=success', request.url)
    );

  } catch (error: any) {
    console.error('Error in Gmail OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?gmail_auth=error&message=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
