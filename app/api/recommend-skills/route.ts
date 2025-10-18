import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Validation schema for the request
const RecommendSkillsRequestSchema = z.object({
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
  existingSkills: z.array(z.string()),
});

// Response schema
const RecommendSkillsResponseSchema = z.object({
  skills: z.array(z.string()),
});

// Initialize OpenAI client
const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate skill recommendations using OpenAI based on user's experience, education, and projects
 */
async function generateSkillRecommendations(userData: z.infer<typeof RecommendSkillsRequestSchema>): Promise<string[]> {
  const { experiences, education, projects, existingSkills } = userData;

  // Analyze the user's background to determine their field/industry
  const allRoles = experiences.map(exp => exp.position).join(', ');
  const allCompanies = experiences.map(exp => exp.company).join(', ');
  const allDegrees = education.map(edu => edu.degree).join(', ');
  const allProjects = projects.map(proj => `${proj.name}: ${proj.description}`).join('\n');
  const allDescriptions = experiences.map(exp => exp.description).join('\n');

  const systemPrompt = `You are a professional career advisor and skills analyst. Your task is to recommend relevant, in-demand skills based on a candidate's experience, education, and projects.

CRITICAL RULES:
1. Recommend 8-12 skills that are RELEVANT to their career path and industry
2. Focus on skills that are commonly required in their field
3. Include a mix of:
   - Technical skills (programming languages, tools, frameworks)
   - Soft skills (leadership, communication, project management)
   - Industry-specific skills (certifications, methodologies, platforms)
4. EXCLUDE skills they already have
5. Prioritize skills that would make them more competitive
6. Use standard industry terminology
7. Return ONLY skill names, no descriptions or explanations
8. Each skill should be 1-4 words maximum
9. Focus on skills that complement their existing experience
10. Consider both current trends and foundational skills in their field

Guidelines by Field:
- Tech/Engineering: Programming languages, frameworks, cloud platforms, DevOps tools
- Business/Management: Project management, analytics tools, leadership methodologies
- Design: Design software, prototyping tools, UX/UI principles
- Marketing: Analytics platforms, automation tools, content creation
- Data/Analytics: Programming languages, visualization tools, statistical methods
- General: Communication, problem-solving, teamwork, adaptability`;

  const userPrompt = `Analyze this candidate's background and recommend relevant skills they should add:

CURRENT ROLES/POSITIONS:
${allRoles || 'Not specified'}

COMPANIES:
${allCompanies || 'Not specified'}

EDUCATION:
${allDegrees || 'Not specified'}

WORK EXPERIENCE DETAILS:
${allDescriptions || 'No detailed experience provided'}

PROJECTS:
${allProjects || 'No projects provided'}

EXISTING SKILLS (DO NOT RECOMMEND THESE):
${existingSkills.length > 0 ? existingSkills.join(', ') : 'None listed'}

Based on this background, recommend 8-12 relevant skills that would enhance their profile and career prospects. Focus on skills that are commonly required in their industry and would make them more competitive.

Return only the skill names, one per line, no additional text:`;

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
      max_tokens: 400,
      temperature: 0.3, // Lower temperature for more consistent, relevant recommendations
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse skills from response
    const recommendedSkills = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-•*]\s*/, '').trim()) // Remove bullet points if any
      .filter(skill => skill.length > 0 && skill.length <= 50) // Reasonable length filter
      .filter(skill => !existingSkills.some(existing => 
        existing.toLowerCase() === skill.toLowerCase()
      )) // Ensure we don't recommend existing skills
      .slice(0, 12); // Limit to 12 recommendations

    return recommendedSkills;
  } catch (error) {
    console.error('OpenAI skill recommendations error:', error);
    throw new Error('Failed to generate skill recommendations');
  }
}

/**
 * POST /api/recommend-skills
 * Generates skill recommendations based on user's experience, education, and projects
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = RecommendSkillsRequestSchema.parse(body);

    // Check if user has enough data to generate meaningful recommendations
    const hasExperience = validatedData.experiences.length > 0;
    const hasEducation = validatedData.education.length > 0;
    const hasProjects = validatedData.projects.length > 0;

    if (!hasExperience && !hasEducation && !hasProjects) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Insufficient data to generate skill recommendations. Please add some experience, education, or projects first.' 
        },
        { status: 400 }
      );
    }

    // Generate skill recommendations with AI
    const skills = await generateSkillRecommendations(validatedData);

    // Validate the generated skills
    const validatedResponse = RecommendSkillsResponseSchema.parse({ skills });

    return NextResponse.json({
      success: true,
      skills: validatedResponse.skills,
      message: 'Skill recommendations generated successfully'
    });

  } catch (error) {
    console.error('Skill recommendations error:', error);
    
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
 * GET /api/recommend-skills
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax Skill Recommendations API',
    version: '1.0',
    description: 'AI-powered skill recommendations based on experience, education, and projects',
    endpoints: {
      POST: {
        description: 'Generate skill recommendations from resume data',
        parameters: {
          experiences: 'Array of work experiences',
          education: 'Array of education entries',
          projects: 'Array of projects',
          existingSkills: 'Array of current skills (to avoid duplicates)'
        },
        response: {
          skills: 'Array of recommended skill names'
        }
      }
    },
    features: [
      'Analyzes complete background',
      'Industry-specific recommendations',
      'Avoids duplicate skills',
      'Mix of technical and soft skills',
      'Current market trends consideration'
    ],
    skillTypes: [
      'Technical skills (programming, tools, frameworks)',
      'Soft skills (leadership, communication)',
      'Industry-specific skills (certifications, methodologies)',
      'Platform and tool proficiencies'
    ],
    runtime: 'nodejs'
  });
}
