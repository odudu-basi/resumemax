import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Check if user has connected their Gmail account
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

    // Fetch user's Gmail connection status
    const { data, error } = await supabase
      .from('user_profiles')
      .select('gmail_access_token, gmail_connected_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({
        connected: false,
        connectedAt: null
      });
    }

    return NextResponse.json({
      connected: !!data.gmail_access_token,
      connectedAt: data.gmail_connected_at
    });

  } catch (error: any) {
    console.error('Error checking Gmail status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
