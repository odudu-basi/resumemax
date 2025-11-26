import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/src/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Get resume from database (resumes table)
    const { data, error } = await (supabase as any)
      .from('resumes')
      .select('file_name, file_content, file_type, file_size')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No resume found for this user' },
          { status: 404 }
        );
      }
      
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve resume' },
        { status: 500 }
      );
    }

    if (!data.file_content) {
      return NextResponse.json(
        { error: 'Resume file content not found' },
        { status: 404 }
      );
    }

    // Convert buffer back to file
    const fileBuffer = Buffer.from(data.file_content);

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': data.file_type,
        'Content-Disposition': `attachment; filename="${data.file_name}"`,
        'Content-Length': data.file_size.toString(),
      },
    });

  } catch (error: any) {
    console.error('Resume download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
