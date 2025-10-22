import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

const config = getConfig();

/**
 * GET /api/analysis/[id]
 * Get analysis results by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      );
    }

    // Get user ID from Authorization header
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createClient(config.supabase.url!, config.supabase.anonKey!);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
      }
    }

    // Query parameter fallback for user ID
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    
    if (!userId && queryUserId) {
      userId = queryUserId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role key for database access
    const supabase = createClient(
      config.supabase.url!,
      config.supabase.serviceRoleKey!
    );

    // Fetch the analysis by ID and ensure it belongs to the user
    const { data: analysis, error } = await supabase
      .from('resume_analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch analysis' 
      },
      { status: 500 }
    );
  }
}
