import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and user ID are required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOC, or DOCX files only.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    console.log('Processing file upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId
    });

    // Convert file to buffer for database storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store file directly in database (resumes table)
    // Using service role client to bypass RLS policies
    const { error } = await (supabase as any)
      .from('resumes')
      .upsert({
        user_id: userId,
        title: file.name.replace(/\.[^/.]+$/, ''), // Use filename without extension as title
        file_name: file.name,
        file_content: buffer,
        file_size: file.size,
        file_type: file.type,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Database save error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      return NextResponse.json(
        { error: 'Failed to save resume to database', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Resume saved successfully to database');

    // Return success response (NO PARSING)
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: 'Resume uploaded successfully!',
      parsed: false
    });

  } catch (error: any) {
    console.error('Resume upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}