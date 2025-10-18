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
const TailorRequestSchema = z.object({
  type: z.enum(['experience', 'summary', 'project', 'skills']),
  content: z.string(),
  jobTitle: z.string(),
  jobDescription: z.string().optional(),
  context: z.object({
    personalInfo: z.object({
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      state: z.string(),
    }),
    allExperiences: z.array(z.any()).optional(),
    allProjects: z.array(z.any()).optional(),
    skills: z.array(z.string()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== Tailor Content API Called ===');
    const body = await request.json();
    
    // Validate request
    const validatedData = TailorRequestSchema.parse(body);
    const { type, content, jobTitle, jobDescription, context } = validatedData;

    console.log('Tailoring type:', type);
    console.log('Job title:', jobTitle);
    console.log('Content length:', content.length);

    // Create type-specific prompts
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'experience') {
      systemPrompt = `You are an expert resume writer specializing in tailoring work experience descriptions for specific job roles. Your task is to rewrite experience descriptions to align with the target job while maintaining truthfulness.

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake achievements or responsibilities
2. NO asterisks (*) in the output
3. Maintain bullet point format with • symbols
4. STRICT LENGTH LIMIT: Each bullet point MUST be 1 line (80-100 characters max), very rarely 1.5 lines (120 characters absolute max)
5. Be extremely concise while preserving important information
6. Focus on results and quantifiable impact
7. Use ATS-friendly keywords from the job description
8. Emphasize relevant skills and achievements
9. Use strong action verbs
10. Include metrics and numbers where possible
11. Make it results-focused and impact-driven
12. Remove filler words and unnecessary details
13. Prioritize the most impactful achievements that fit the target role

LENGTH ENFORCEMENT:
- Count characters carefully - aim for 80-100 characters per bullet
- Only use 1.5 lines (up to 120 characters) for truly critical information
- Remove redundant words like "responsible for", "worked on", "helped with"
- Use abbreviations where appropriate (e.g., "mgmt" for management, "dev" for development)
- Combine related achievements into single, powerful statements

Format: Return only the bullet points, one per line, starting with •`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Experience Description:
${content}

Rewrite this experience description to be more relevant for the "${jobTitle}" role. Keep all information truthful but emphasize aspects most relevant to the target position.

EXAMPLES OF GOOD LENGTH (80-100 characters):
• Led team of 5 engineers to deliver microservices architecture, reducing latency by 40%
• Implemented CI/CD pipeline using Jenkins, decreasing deployment time from 2hrs to 15min
• Optimized SQL queries and database indexes, improving application performance by 60%

EXAMPLES OF ACCEPTABLE 1.5 LINES (up to 120 characters):
• Architected scalable e-commerce platform serving 1M+ users with 99.9% uptime using AWS, React, and Node.js

Focus on quantifiable results and impact while staying within character limits.`;

    } else if (type === 'summary') {
      systemPrompt = `You are an expert resume writer specializing in crafting professional summaries tailored for specific job roles.

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake qualifications or experience
2. NO asterisks (*) in the output
3. Keep it concise (2-4 sentences maximum)
4. Focus on relevant skills and achievements
5. Use ATS-friendly keywords from the job description
6. Highlight the most relevant qualifications for the target role
7. Make it results-focused and impact-driven
8. Use professional, confident language

Format: Return a cohesive paragraph summary without bullet points.`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Professional Summary:
${content}

Context - User's Background:
- Skills: ${context.skills?.join(', ') || 'Not specified'}
- Experience Count: ${context.allExperiences?.length || 0} positions
- Projects Count: ${context.allProjects?.length || 0} projects

Rewrite this professional summary to be more relevant for the "${jobTitle}" role. Keep all information truthful but emphasize aspects most relevant to the target position.`;

    } else if (type === 'project') {
      systemPrompt = `You are an expert resume writer specializing in tailoring project descriptions for specific job roles.

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake technologies or achievements
2. NO asterisks (*) in the output
3. Maintain bullet point format with • symbols
4. STRICT LENGTH LIMIT: Each bullet point MUST be 1 line (80-100 characters max), very rarely 1.5 lines (120 characters absolute max)
5. Be extremely concise while preserving important information
6. Focus on relevant technologies and outcomes
7. Use ATS-friendly keywords from the job description
8. Emphasize technical skills relevant to the target role
9. Include metrics and impact where possible
10. Highlight problem-solving and results
11. Remove filler words and unnecessary details
12. Prioritize the most relevant technical achievements

LENGTH ENFORCEMENT:
- Count characters carefully - aim for 80-100 characters per bullet
- Only use 1.5 lines (up to 120 characters) for truly critical information
- Remove redundant phrases like "built a", "created a", "developed a"
- Use tech abbreviations where standard (e.g., "JS" for JavaScript, "DB" for database)
- Combine related technical details into single, powerful statements
- Focus on impact and technologies most relevant to the target role

Format: Return only the bullet points, one per line, starting with •`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Project Description:
${content}

Rewrite this project description to be more relevant for the "${jobTitle}" role. Keep all information truthful but emphasize technologies, methodologies, and outcomes most relevant to the target position.

EXAMPLES OF GOOD LENGTH (80-100 characters):
• Built React dashboard with real-time analytics, increasing user engagement by 35%
• Developed REST API using Node.js and MongoDB, handling 10K+ requests per minute
• Implemented OAuth authentication and JWT tokens, securing 50K+ user accounts

EXAMPLES OF ACCEPTABLE 1.5 LINES (up to 120 characters):
• Created full-stack inventory mgmt system using Python/Django and PostgreSQL, reducing processing time by 70%

Focus on relevant technologies and measurable outcomes while staying within character limits.`;

    } else if (type === 'skills') {
      systemPrompt = `You are an expert resume writer specializing in tailoring skills lists for specific job roles.

CRITICAL REQUIREMENTS:
1. Only suggest skills that are commonly associated with the job title
2. NO asterisks (*) in the output
3. Prioritize the most relevant skills for the target role
4. Include both technical and soft skills as appropriate
5. Use industry-standard skill names
6. Focus on skills mentioned in the job description
7. Maintain a reasonable number of skills (8-15 total)
8. Order skills by relevance to the target role

Format: Return skills as a comma-separated list without bullet points.`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Skills:
${content}

Context - User's Background:
- Experience: ${context.allExperiences?.map(exp => `${exp.position} at ${exp.company}`).join(', ') || 'Not specified'}
- Projects: ${context.allProjects?.map(proj => proj.name).join(', ') || 'Not specified'}

Suggest a tailored skills list for the "${jobTitle}" role. Prioritize skills most relevant to this position while keeping the list realistic based on the user's background.`;
    }

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
      max_tokens: 1000,
      temperature: 0.3, // Low temperature for consistent, professional output
    });

    const tailoredContent = completion.choices[0]?.message?.content;
    if (!tailoredContent) {
      throw new Error('No response from OpenAI');
    }

    // Post-process content to ensure length compliance for bullet points
    let processedContent = tailoredContent.trim();
    
    if (type === 'experience' || type === 'project') {
      const lines = processedContent.split('\n').filter(line => line.trim());
      const processedLines = lines.map(line => {
        const cleanLine = line.trim();
        
        // Check if line is too long (over 120 characters)
        if (cleanLine.length > 120) {
          console.log(`Warning: Line too long (${cleanLine.length} chars): ${cleanLine.substring(0, 50)}...`);
          
          // Try to truncate intelligently at word boundaries
          const words = cleanLine.split(' ');
          let truncated = '';
          
          for (const word of words) {
            if ((truncated + ' ' + word).length <= 115) { // Leave room for ellipsis
              truncated += (truncated ? ' ' : '') + word;
            } else {
              break;
            }
          }
          
          return truncated + (truncated.length < cleanLine.length ? '...' : '');
        }
        
        return cleanLine;
      });
      
      processedContent = processedLines.join('\n');
    }

    console.log('Tailored content generated successfully');
    console.log('Content length validation completed');

    return NextResponse.json({
      success: true,
      tailoredContent: processedContent,
      originalContent: content,
      type,
      jobTitle
    });

  } catch (error) {
    console.error('=== Content tailoring error ===');
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

    const errorMessage = error instanceof Error ? error.message : 'Failed to tailor content';
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
    message: 'Content tailoring API endpoint',
    usage: 'POST with JSON body containing type, content, jobTitle, and context',
    supportedTypes: ['experience', 'summary', 'project', 'skills']
  });
}
