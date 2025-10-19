import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';
import { createSupabaseClient } from '@/src/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { jobTitle, jobDescription, resumeText, analysisResults, fileName } = await request.json();

    // Validate required fields
    if (!jobTitle || !resumeText || !analysisResults) {
      return NextResponse.json(
        { error: 'Missing required fields: jobTitle, resumeText, and analysisResults are required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    // Try to get user from session if available
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const supabaseClient = createSupabaseClient();
        const { data: { user }, error } = await supabaseClient.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
        }
      } catch (error) {
        console.warn('Could not authenticate user, proceeding without user ID:', error);
      }
    }

    // If no user is authenticated, we can still save the analysis but without user association
    // This allows the feature to work even when users aren't logged in

    try {
      // First, create or find a resume record
      let resumeId: string;
      
      if (userId) {
        // If user is authenticated, create a proper resume record
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .insert({
            user_id: userId,
            title: fileName || `Resume for ${jobTitle}`,
            content: { text: resumeText }
          })
          .select('id')
          .single();

        if (resumeError) {
          console.error('Error creating resume record:', resumeError);
          return NextResponse.json(
            { error: 'Failed to save resume data' },
            { status: 500 }
          );
        }

        resumeId = resumeData.id;

        // Create the analysis record
        const { error: analysisError } = await supabase
          .from('resume_analyses')
          .insert({
            resume_id: resumeId,
            user_id: userId,
            job_title: jobTitle,
            job_description: jobDescription,
            analysis_results: analysisResults
          });

        if (analysisError) {
          console.error('Error saving analysis:', analysisError);
          return NextResponse.json(
            { error: 'Failed to save analysis data' },
            { status: 500 }
          );
        }
      } else {
        // For non-authenticated users, we could either:
        // 1. Return an error asking them to sign up
        // 2. Save to a temporary storage
        // 3. Just return success without saving
        
        // For now, let's return a message indicating they need to sign up to save
        return NextResponse.json(
          { 
            message: 'Analysis completed successfully! Sign up to save your results and access them later.',
            requiresAuth: true 
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          message: 'Analysis saved successfully!',
          resumeId,
          saved: true 
        },
        { status: 200 }
      );

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error occurred while saving analysis' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Save analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
