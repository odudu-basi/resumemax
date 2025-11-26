import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Get configuration
const config = getConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Request schema
const RefineRequestSchema = z.object({
  transcript: z.string().min(10, 'Transcript is too short'),
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== Refine Transcript API Called ===');
    const body = await request.json();

    // Validate request
    const validatedData = RefineRequestSchema.parse(body);
    const { transcript } = validatedData;

    console.log('Transcript length:', transcript.length);

    // Create AI prompt to analyze and refine the transcript
    const systemPrompt = `You are an expert resume writer and career coach. Your task is to analyze a voice transcript where someone is describing their professional background and refine it into a well-structured, professional format suitable for building a resume.

CRITICAL REQUIREMENTS:
1. Extract and organize information into clear sections: Experience, Education, Projects, and Skills
2. Maintain 100% truthfulness - do not add information not mentioned in the transcript
3. Transform casual speech into professional, polished resume language
4. Use bullet points for experiences and projects
5. Quantify achievements whenever numbers or metrics are mentioned
6. Use strong action verbs to start bullet points
7. Remove filler words, repetition, and conversational language
8. Preserve all important details about companies, positions, dates, technologies, achievements
9. If education is mentioned, extract degree, institution, and dates
10. Identify and list technical and soft skills mentioned

OUTPUT FORMAT:
Structure the refined content with clear section headers:

EXPERIENCE:
[Company Name] - [Position Title] ([Dates if mentioned])
• [Achievement/responsibility with metrics]
• [Achievement/responsibility with metrics]

EDUCATION:
[Degree] - [Institution] ([Dates if mentioned])
[Any relevant details like GPA, honors, relevant coursework]

PROJECTS:
[Project Name]
• [Description with technologies and outcomes]
• [Key achievements or features]

SKILLS:
[Comma-separated list of technical skills, tools, and relevant soft skills]

IMPORTANT:
- If a section has no information, omit it entirely
- Be concise but comprehensive
- Make the language professional and impactful
- Ensure bullet points are achievement-focused, not just task lists`;

    const userPrompt = `Please analyze this voice transcript and refine it into a professional, structured format suitable for creating a resume:

TRANSCRIPT:
${transcript}

Transform this into a well-organized, professional format with clear sections for Experience, Education, Projects, and Skills. Extract all relevant information and present it in polished resume language.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Low temperature for consistent, professional output
    });

    const refinedTranscript = completion.choices[0]?.message?.content;
    if (!refinedTranscript) {
      throw new Error('No response from OpenAI');
    }

    console.log('Transcript refined successfully');
    console.log('Refined length:', refinedTranscript.length);

    return NextResponse.json({
      success: true,
      refinedTranscript: refinedTranscript.trim(),
      originalTranscript: transcript,
    });

  } catch (error) {
    console.error('=== Transcript refinement error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);

    if (error instanceof z.ZodError) {
      console.log('Zod validation error');
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues.map((issue: any) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to refine transcript';
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
    message: 'Transcript refinement API endpoint',
    usage: 'POST with JSON body containing transcript',
    description: 'Analyzes voice transcript and refines it into structured resume content'
  });
}
