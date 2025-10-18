import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Validation schema for the request
const GenerateSummaryRequestSchema = z.object({
  personalInfo: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    state: z.string(),
  }),
  experiences: z.array(z.object({
    id: z.string(),
    company: z.string(),
    position: z.string(),
    location: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    current: z.boolean(),
    description: z.string(),
  })),
  education: z.array(z.object({
    id: z.string(),
    school: z.string(),
    degree: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    current: z.boolean(),
  })),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })),
  skills: z.array(z.string()),
});

// Response schema
const GenerateSummaryResponseSchema = z.object({
  summary: z.string().min(1),
});

// Initialize OpenAI client
const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate professional summary using OpenAI based on all user data
 */
async function generateProfessionalSummary(userData: z.infer<typeof GenerateSummaryRequestSchema>): Promise<string> {
  const { personalInfo, experiences, education, projects, skills } = userData;

  // Analyze the user's data to extract key information
  const totalYearsExperience = calculateYearsOfExperience(experiences);
  const primarySkills = skills.slice(0, 8); // Top skills
  const latestRole = experiences.length > 0 ? experiences[0] : null;
  const highestEducation = education.length > 0 ? education[0] : null;
  const keyProjects = projects.slice(0, 3); // Top projects

  const systemPrompt = `You are a professional resume writer specializing in creating compelling professional summaries. Your task is to write a concise, impactful professional summary (2-4 sentences) that highlights the candidate's key qualifications, experience, and value proposition.

CRITICAL RULES:
1. Keep it concise (2-4 sentences, 50-80 words)
2. Start with years of experience and primary role/expertise
3. Highlight key skills and technologies relevant to their field
4. Include measurable achievements or impact when available
5. End with career objective or value proposition
6. Use active voice and strong action words
7. Make it ATS-friendly with relevant keywords
8. NO asterisks, bullet points, or special formatting
9. Write in FIRST PERSON using "I" statements - make it personal and direct
10. Focus on what makes them unique and valuable

Guidelines:
- For technical roles: Emphasize technologies, methodologies, and technical achievements
- For business roles: Focus on leadership, results, and business impact
- For entry-level: Emphasize education, skills, and potential
- For senior roles: Highlight leadership, strategic thinking, and major accomplishments
- Use "I am", "I have", "I bring", "I specialize in", etc.`;

  const userPrompt = `Generate a professional summary for this candidate:

PERSONAL INFO:
- Name: ${personalInfo.name}
- Location: ${personalInfo.state}

EXPERIENCE (${totalYearsExperience} years total):
${experiences.map(exp => 
  `- ${exp.position} at ${exp.company} (${exp.startDate} - ${exp.current ? 'Present' : exp.endDate})
   ${exp.description ? `Achievements: ${exp.description.substring(0, 200)}...` : ''}`
).join('\n')}

EDUCATION:
${education.map(edu => 
  `- ${edu.degree} from ${edu.school} (${edu.startDate} - ${edu.current ? 'Present' : edu.endDate})`
).join('\n')}

KEY PROJECTS:
${keyProjects.map(proj => 
  `- ${proj.name}: ${proj.description.substring(0, 150)}...`
).join('\n')}

SKILLS:
${primarySkills.join(', ')}

Write a compelling professional summary in FIRST PERSON that captures their expertise, experience, and value proposition. Focus on their strongest qualifications and what makes them stand out. Use "I am", "I have", "I bring", "I specialize in", etc.

Professional Summary:`;

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
      max_tokens: 300,
      temperature: 0.3, // Lower temperature for more consistent, professional output
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Clean the response
    const cleanedSummary = response
      .trim()
      .replace(/^\*+\s*/, '') // Remove leading asterisks
      .replace(/\*+$/, '') // Remove trailing asterisks
      .replace(/\*+/g, '') // Remove any remaining asterisks
      .replace(/^Professional Summary:\s*/i, '') // Remove "Professional Summary:" prefix if present
      .trim();

    return cleanedSummary;
  } catch (error) {
    console.error('OpenAI summary generation error:', error);
    throw new Error('Failed to generate professional summary');
  }
}

/**
 * Calculate total years of experience from experience array
 */
function calculateYearsOfExperience(experiences: any[]): number {
  if (experiences.length === 0) return 0;

  let totalMonths = 0;
  const currentDate = new Date();

  experiences.forEach(exp => {
    const startDate = new Date(exp.startDate);
    const endDate = exp.current ? currentDate : new Date(exp.endDate);
    
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    totalMonths += Math.max(0, months);
  });

  return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
}

/**
 * POST /api/generate-summary
 * Generates a professional summary based on all user resume data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = GenerateSummaryRequestSchema.parse(body);

    // Check if user has enough data to generate a meaningful summary
    if (validatedData.experiences.length === 0 && validatedData.education.length === 0 && validatedData.skills.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Insufficient data to generate summary. Please add at least some experience, education, or skills first.' 
        },
        { status: 400 }
      );
    }

    // Generate professional summary with AI
    const summary = await generateProfessionalSummary(validatedData);

    // Validate the generated summary
    const validatedResponse = GenerateSummaryResponseSchema.parse({ summary });

    return NextResponse.json({
      success: true,
      summary: validatedResponse.summary,
      message: 'Professional summary generated successfully'
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    
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
 * GET /api/generate-summary
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax Professional Summary Generator API',
    version: '1.0',
    description: 'AI-powered professional summary generation based on complete resume data',
    endpoints: {
      POST: {
        description: 'Generate a professional summary from resume data',
        parameters: {
          personalInfo: 'Personal information object',
          experiences: 'Array of work experiences',
          education: 'Array of education entries',
          projects: 'Array of projects',
          skills: 'Array of skills'
        },
        response: {
          summary: 'Generated professional summary (2-4 sentences)'
        }
      }
    },
    features: [
      'Analyzes complete resume data',
      'Calculates years of experience',
      'Identifies key skills and achievements',
      'Creates ATS-optimized summary',
      'Tailored to career level and industry'
    ],
    requirements: [
      'At least one of: experience, education, or skills must be provided',
      'More data = better, more personalized summary'
    ],
    runtime: 'nodejs'
  });
}
