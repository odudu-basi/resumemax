import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';
import { supabase } from '@/src/lib/supabase';

// Force Node.js runtime
export const runtime = 'nodejs';

// Get configuration
const config = getConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== Resume Analysis API Called ===');

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Analyzing resume for user:', userId);

    // Fetch user's resume and parsed data from database
    const [resumeData, parsedResumeData] = await Promise.all([
      supabase
        .from('resumes')
        .select('file_name, file_content')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('parsed_resumes')
        .select('resume_data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    if (resumeData.error && resumeData.error.code !== 'PGRST116') {
      console.error('Error fetching resume:', resumeData.error);
      return NextResponse.json(
        { error: 'Failed to fetch resume data' },
        { status: 500 }
      );
    }

    if (!resumeData.data && (!parsedResumeData.data || parsedResumeData.error)) {
      return NextResponse.json(
        { error: 'No resume found for this user' },
        { status: 404 }
      );
    }

    // Use parsed resume data if available, otherwise indicate we have a file but no parsed data
    let resumeContent = '';
    
    if (parsedResumeData.data?.resume_data) {
      const parsed = parsedResumeData.data.resume_data;
      
      // Format the parsed resume data into a readable format
      resumeContent = `
RESUME ANALYSIS FOR INTERVIEW PREPARATION

## Personal Information
Name: ${parsed.personal_info?.name || 'Not specified'}
Email: ${parsed.personal_info?.email || 'Not specified'}
Phone: ${parsed.personal_info?.phone || 'Not specified'}
Location: ${parsed.personal_info?.location || 'Not specified'}

## Professional Summary
${parsed.summary || 'No summary provided'}

## Work Experience
${parsed.work_experience?.map((exp: any, index: number) => `
${index + 1}. ${exp.title || exp.position} at ${exp.company}
   Duration: ${exp.duration || `${exp.start_date || 'Unknown'} - ${exp.end_date || 'Present'}`}
   ${exp.description || exp.responsibilities?.join('. ') || 'No description provided'}
`).join('\n') || 'No work experience listed'}

## Education
${parsed.education?.map((edu: any, index: number) => `
${index + 1}. ${edu.degree} in ${edu.field || edu.major || 'Unspecified field'}
   Institution: ${edu.school || edu.institution}
   Year: ${edu.graduation_year || edu.end_date || 'Not specified'}
`).join('\n') || 'No education listed'}

## Technical Skills
${parsed.skills?.technical?.join(', ') || parsed.skills?.join(', ') || 'No technical skills listed'}

## Projects
${parsed.projects?.map((project: any, index: number) => `
${index + 1}. ${project.name || project.title}
   ${project.description}
   Technologies: ${project.technologies?.join(', ') || 'Not specified'}
`).join('\n') || 'No projects listed'}

## Certifications
${parsed.certifications?.map((cert: any, index: number) => `
${index + 1}. ${typeof cert === 'string' ? cert : cert.name || cert.title}
`).join('\n') || 'No certifications listed'}
      `.trim();
    } else if (resumeData.data?.file_name) {
      resumeContent = `Resume file available: ${resumeData.data.file_name}
      
Note: The resume file has been uploaded but detailed parsing is not available. The AI assistant will ask the candidate to walk through their background and experiences to gather the necessary information for interview preparation.`;
    }

    // Generate interview context using OpenAI
    console.log('Generating interview preparation context...');
    
    const analysisPrompt = `As an expert career coach and recruiter, analyze this resume and create a comprehensive interview preparation context. Focus on:

1. Key experiences that need deeper exploration
2. Potential questions to ask about each role/project
3. Skills and achievements that should be highlighted
4. Areas where the candidate should provide specific examples
5. Potential gaps or areas that need clarification

Resume Content:
${resumeContent}

Provide a structured analysis that will help an AI interviewer conduct a thorough, conversational interview with this candidate.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach and recruiter. Provide detailed, actionable interview preparation insights.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const analysis = completion.choices[0]?.message?.content || 'Unable to generate analysis';

    console.log('Resume analysis completed');

    return NextResponse.json({
      success: true,
      resumeContext: resumeContent,
      interviewPrep: analysis,
      hasDetailedResume: !!parsedResumeData.data?.resume_data,
      fileName: resumeData.data?.file_name || null
    });

  } catch (error) {
    console.error('=== Resume analysis error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze resume';
    console.log('Returning error response:', errorMessage);

    return NextResponse.json(
      {
        error: errorMessage,
        type: typeof error,
        constructor: error?.constructor?.name
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Resume analysis API endpoint',
    usage: 'POST with userId to analyze resume and generate interview context',
    features: ['Resume parsing', 'Interview preparation', 'AI analysis']
  });
}