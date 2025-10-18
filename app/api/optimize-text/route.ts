import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Validation schema for the request
const OptimizeRequestSchema = z.object({
  type: z.enum(['experience', 'summary', 'project']),
  text: z.string().min(1, 'Text is required'),
  context: z.object({
    personalInfo: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      state: z.string().optional(),
    }).optional(),
    allExperiences: z.array(z.any()).optional(),
    allProjects: z.array(z.any()).optional(),
  }).optional(),
});

// Initialize OpenAI client
const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Optimize text using OpenAI for ATS and results
 */
async function optimizeTextWithAI(
  type: 'experience' | 'summary' | 'project',
  text: string,
  context?: any
): Promise<string> {
  let systemPrompt = "";
  let userPrompt = "";

  switch (type) {
    case 'experience':
      systemPrompt = `You are a professional resume optimization expert specializing in ATS (Applicant Tracking System) optimization and results-driven content. Your task is to optimize work experience descriptions to be more impactful and ATS-friendly.

CRITICAL RULES:
1. NEVER invent facts, numbers, or achievements that aren't in the original text
2. NEVER add asterisks (*) or any special characters to the output
3. Only enhance and restructure existing information
4. Focus on ATS optimization and impact
5. Use strong action verbs and quantifiable results where they already exist
6. Maintain truthfulness and accuracy at all costs

Guidelines:
- Start each bullet point with strong action verbs (Led, Developed, Implemented, Managed, etc.)
- Emphasize measurable results and achievements that are already mentioned
- Use industry-standard keywords and terminology
- Structure for ATS readability
- Keep bullet points concise but impactful
- Maintain the same factual content, just presented better`;

      userPrompt = `Optimize this work experience description for ATS and impact. Only enhance what's already there, don't invent new facts:

Original text:
${text}

Return only the optimized text with bullet points, no additional commentary.`;
      break;

    case 'summary':
      systemPrompt = `You are a professional resume optimization expert. Your task is to optimize professional summaries for ATS compatibility and maximum impact.

CRITICAL RULES:
1. NEVER invent facts, experiences, or qualifications not in the original text
2. NEVER add asterisks (*) or special characters
3. Only enhance and restructure existing information
4. Focus on ATS optimization and professional impact
5. Maintain truthfulness and accuracy at all costs

Guidelines:
- Create a compelling 2-4 sentence summary
- Use industry-relevant keywords naturally
- Highlight key strengths and experiences mentioned
- Structure for ATS readability
- Make it engaging for human readers
- Focus on value proposition and unique strengths`;

      userPrompt = `Optimize this professional summary for ATS and impact. Only enhance what's already there, don't add new qualifications or experiences:

Original text:
${text}

Return only the optimized summary text, no additional commentary.`;
      break;

    case 'project':
      systemPrompt = `You are a professional resume optimization expert specializing in project descriptions for ATS and impact optimization.

CRITICAL RULES:
1. NEVER invent technologies, features, or achievements not mentioned in the original
2. NEVER add asterisks (*) or special characters
3. Only enhance and restructure existing information
4. Focus on ATS optimization and technical impact
5. Maintain complete truthfulness and accuracy

Guidelines:
- Emphasize technical skills and technologies already mentioned
- Highlight measurable outcomes and achievements that exist in the original
- Use industry-standard terminology
- Structure for ATS readability
- Make technical accomplishments clear and impactful
- Focus on problem-solving and results`;

      userPrompt = `Optimize this project description for ATS and impact. Only enhance what's already mentioned, don't add new technologies or features:

Original text:
${text}

Return only the optimized project description, no additional commentary.`;
      break;
  }

  try {
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
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more consistent, factual output
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Clean the response to remove any asterisks or unwanted formatting
    const cleanedResponse = response
      .replace(/\*/g, '') // Remove all asterisks
      .replace(/^\s*[-•]\s*/gm, '• ') // Normalize bullet points
      .trim();

    return cleanedResponse;
  } catch (error) {
    console.error('OpenAI optimization error:', error);
    throw new Error('Failed to optimize text with AI');
  }
}

/**
 * POST /api/optimize-text
 * Optimizes resume text for ATS and impact
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = OptimizeRequestSchema.parse(body);

    // Optimize text with AI
    const optimizedText = await optimizeTextWithAI(
      validatedData.type,
      validatedData.text,
      validatedData.context
    );

    return NextResponse.json({
      success: true,
      optimizedText,
      message: 'Text optimized successfully'
    });

  } catch (error) {
    console.error('Text optimization error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error',
          details: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false,
          error: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/optimize-text
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax Text Optimization API',
    version: '1.0',
    description: 'AI-powered text optimization for ATS and impact',
    endpoints: {
      POST: {
        description: 'Optimize resume text for ATS and impact',
        parameters: {
          type: 'Type of text (experience, summary, project)',
          text: 'Text to optimize',
          context: 'Optional context for better optimization'
        },
        rules: [
          'Never invents facts or achievements',
          'No asterisks in output',
          'ATS-optimized formatting',
          'Truthful enhancement only'
        ]
      }
    },
    supportedTypes: ['experience', 'summary', 'project'],
    features: [
      'ATS optimization',
      'Impact enhancement',
      'Truthful content only',
      'Professional formatting'
    ],
    runtime: 'nodejs'
  });
}
