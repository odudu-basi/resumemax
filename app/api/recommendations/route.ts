import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Validation schema for the request
const RecommendationsRequestSchema = z.object({
  position: z.string().min(1, 'Position is required'),
  company: z.string().min(1, 'Company is required'),
  type: z.enum(['experience', 'project']).default('experience'),
  context: z.object({
    industry: z.string().optional(),
    seniority: z.string().optional(),
  }).optional(),
});

// Initialize OpenAI client
const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate role-based recommendations using OpenAI
 */
async function generateRecommendations(
  position: string,
  company: string,
  type: 'experience' | 'project',
  context?: any
): Promise<string[]> {
  let systemPrompt = "";
  let userPrompt = "";

  if (type === 'experience') {
    systemPrompt = `You are a professional resume writing expert specializing in creating impactful bullet points for work experience. Your task is to generate 3-4 realistic, role-appropriate bullet points that someone in this position would typically accomplish.

CRITICAL RULES:
1. Generate REALISTIC and COMMON responsibilities for this role
2. Use strong action verbs (Led, Developed, Implemented, Managed, etc.)
3. Include measurable outcomes where typical for the role
4. Make bullet points specific to the position and industry
5. Keep each bullet point concise and impactful - prefer 1 line when possible, 2 lines max
6. Focus on achievements and impact, not just duties
7. Use present tense for current roles, past tense for previous roles
8. NO asterisks or special characters
9. Make suggestions that are commonly expected for this role level
10. Be clear and direct while maintaining natural flow

Guidelines:
- Entry-level roles: Focus on learning, supporting, assisting, contributing
- Mid-level roles: Focus on leading projects, improving processes, mentoring
- Senior roles: Focus on strategy, leadership, major initiatives, team management
- Include industry-specific terminology and common KPIs
- Suggest realistic metrics based on role level and industry standards`;

    userPrompt = `Generate 3-4 realistic, CONCISE bullet points for someone working as a "${position}" at "${company}".

Focus on:
- Common responsibilities for this role
- Typical achievements and metrics for this position level
- Industry-appropriate language and terminology
- Realistic impact statements
- Keep each bullet point concise - prefer 1 line, allow 2 lines when needed

Return only the bullet points, each starting with "• " and no additional text.`;
  } else {
    systemPrompt = `You are a professional resume writing expert specializing in project descriptions. Your task is to generate realistic project bullet points that showcase technical skills and achievements.

CRITICAL RULES:
1. Generate REALISTIC project accomplishments
2. Focus on technical implementation and results
3. Include relevant technologies and methodologies
4. Show problem-solving and impact
5. Keep descriptions concise and impactful - prefer 1 line when possible, 2 lines max
6. NO asterisks or special characters
7. Make suggestions appropriate for the role level
8. Be clear and direct while maintaining natural flow

Guidelines:
- Include relevant tech stack and tools
- Show measurable outcomes where possible
- Highlight problem-solving approach
- Demonstrate technical depth appropriate for role level`;

    userPrompt = `Generate 3-4 realistic, CONCISE project bullet points for someone working as a "${position}" at "${company}".

Focus on:
- Technical achievements and implementations
- Relevant technologies for this role
- Measurable project outcomes
- Problem-solving and innovation
- Keep each bullet point concise - prefer 1 line, allow 2 lines when needed

Return only the bullet points, each starting with "• " and no additional text.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt + '\n\nIMPORTANT: Keep bullet points concise and impactful. Prefer 1 line when possible, but use 2 lines if needed for clarity.'
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 400, // Balanced for concise but complete responses
      temperature: 0.3, // Lower temperature for more focused responses
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse bullet points from response
    const bulletPoints = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('•'))
      .map(line => line.replace(/^\•\s*/, '').trim())
      .filter(line => line.length > 0);

    return bulletPoints.slice(0, 4); // Ensure max 4 bullet points
  } catch (error) {
    console.error('OpenAI recommendations error:', error);
    throw new Error('Failed to generate recommendations');
  }
}

/**
 * POST /api/recommendations
 * Generates role-based bullet point recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = RecommendationsRequestSchema.parse(body);

    // Generate recommendations with AI
    const recommendations = await generateRecommendations(
      validatedData.position,
      validatedData.company,
      validatedData.type,
      validatedData.context
    );

    return NextResponse.json({
      success: true,
      recommendations,
      message: 'Recommendations generated successfully'
    });

  } catch (error) {
    console.error('Recommendations generation error:', error);
    
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
 * GET /api/recommendations
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax Recommendations API',
    version: '1.0',
    description: 'AI-powered role-based bullet point recommendations',
    endpoints: {
      POST: {
        description: 'Generate bullet point recommendations for a role',
        parameters: {
          position: 'Job position/title (required)',
          company: 'Company name (required)',
          type: 'Type of recommendations (experience/project)',
          context: 'Optional context (industry, seniority)'
        },
        response: {
          recommendations: 'Array of bullet point suggestions'
        }
      }
    },
    supportedTypes: ['experience', 'project'],
    features: [
      'Role-specific recommendations',
      'Industry-appropriate language',
      'Realistic achievements',
      'Measurable outcomes'
    ],
    runtime: 'nodejs'
  });
}
