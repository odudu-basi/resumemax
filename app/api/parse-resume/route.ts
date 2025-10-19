import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { extractTextFromFile } from '@/src/lib/extract';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Get configuration
const config = getConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Response schema for parsed resume data
const ParsedResumeSchema = z.object({
  personalInfo: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    state: z.string(),
  }),
  experiences: z.array(z.object({
    company: z.string(),
    position: z.string(),
    location: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    current: z.boolean(),
    description: z.string(),
  })),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    current: z.boolean(),
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  skills: z.array(z.string()),
  summary: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== Parse Resume API Called ===');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', file?.name, file?.type, file?.size);

    if (!file) {
      console.log('No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Starting text extraction...');
    // Extract text from the uploaded file
    const extractionResult = await extractTextFromFile(file);
    const resumeText = extractionResult.text;
    console.log('Text extraction completed, length:', resumeText.length);
    console.log('Word count:', extractionResult.metadata.wordCount);
    console.log('File type:', extractionResult.metadata.fileType);

    // AI prompt for parsing resume content
    const systemPrompt = `You are an expert resume parser. Extract structured information from the resume text and return it as JSON.

CRITICAL INSTRUCTIONS:
1. Extract ALL information accurately from the resume
2. For dates, use MM/YYYY format (e.g., "01/2023")
3. If information is missing, use empty strings or empty arrays
4. For current positions/education, set "current" to true and "endDate" to empty string
5. Split multi-line descriptions into bullet points separated by newlines
6. Extract skills as individual items in an array
7. Create a professional summary if one exists, otherwise leave empty
8. Output ONLY valid JSON - no markdown code blocks, no explanatory text, start directly with { and end with }

JSON Schema to follow:
{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com", 
    "phone": "Phone Number",
    "state": "State/Location"
  },
  "experiences": [
    {
      "company": "Company Name",
      "position": "Job Title", 
      "location": "City, State",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY", 
      "current": false,
      "description": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3"
    }
  ],
  "education": [
    {
      "school": "University Name",
      "degree": "Degree Name",
      "startDate": "MM/YYYY", 
      "endDate": "MM/YYYY",
      "current": false
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "• Project detail 1\\n• Project detail 2"
    }
  ],
  "skills": ["Skill1", "Skill2", "Skill3"],
  "summary": "Professional summary text"
}`;

    const userPrompt = `Parse this resume and extract all information into the specified JSON format:

${resumeText}

Return ONLY valid JSON with no additional text or formatting.`;

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
      temperature: 0.1, // Low temperature for consistent parsing
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse and validate the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON:', response);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate against schema
    const validatedData = ParsedResumeSchema.parse(parsedData);

    return NextResponse.json({
      success: true,
      data: validatedData,
      rawText: resumeText,
      metadata: extractionResult.metadata
    });

  } catch (error) {
    console.error('=== Resume parsing error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    
    if (error instanceof z.ZodError) {
      console.log('Zod validation error');
      return NextResponse.json(
        { 
          error: 'Invalid resume data format',
          details: error.issues.map((issue: any) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to parse resume';
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
    message: 'Resume parsing API endpoint',
    usage: 'POST with multipart/form-data containing a "file" field',
    supportedFormats: ['PDF', 'DOC', 'DOCX'],
    maxSize: '10MB'
  });
}
