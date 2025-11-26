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
      systemPrompt = `You are an expert resume writer specializing in tailoring work experience descriptions for specific job roles. Your PRIMARY task is to deeply analyze how each piece of content relates to the target job description, then rewrite it to make the candidate highly favorable for that specific position.

TAILORING METHODOLOGY:
1. ANALYZE: For each bullet point, identify which aspects of the work relate to the target job's requirements
2. CONNECT: Find direct connections between the experience and the job description's responsibilities/requirements
3. REWRITE: Transform the content to emphasize those connections and demonstrate relevant competencies
4. OPTIMIZE: Use keywords and phrases from the job description to maximize ATS compatibility and recruiter appeal

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake achievements or responsibilities
2. NO asterisks (*) in the output
3. Maintain bullet point format with • symbols
4. STRICT LENGTH LIMIT: Each bullet point MUST be 1 line (75-95 characters), maximum 2 lines only in rare cases (110 characters absolute max)
5. Extract and highlight ONLY the most relevant aspects of each experience that align with the target job
6. Reframe accomplishments using terminology and concepts from the job description
7. Quantify impact wherever possible with specific metrics
8. Use strong action verbs that match the job's required competencies
9. Prioritize responsibilities and achievements that directly address the target role's needs
10. Remove any content that doesn't strengthen the candidate's fit for this specific position

TAILORING APPROACH:
- If job description mentions "scalability" → highlight scalability achievements
- If job requires "team leadership" → emphasize leadership and collaboration
- If job needs specific tech stack → foreground experience with those technologies
- Match the job's language and terminology throughout
- Demonstrate you solved problems similar to what the role will face

LENGTH ENFORCEMENT:
- Target 75-95 characters per bullet (ideal: 1 line)
- Rarely extend to 110 characters (2 lines) only for exceptional, highly relevant achievements
- Eliminate ALL filler words: "responsible for", "worked on", "helped with", "assisted in"
- Use concise abbreviations: "mgmt" (management), "dev" (development), "impl." (implemented)
- Every word must add value and relevance to the target role

Format: Return only the bullet points, one per line, starting with •`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Experience Description:
${content}

TASK: Carefully read the job description above. For EACH bullet point in the current experience:
1. Identify what aspects relate to the job requirements
2. Rewrite to emphasize those connections using job description keywords
3. Reframe to show how this experience makes the candidate ideal for THIS specific role
4. Remove anything that doesn't strengthen relevance to the target position

EXAMPLES OF EFFECTIVE TAILORING (75-95 characters):
• Led 8-person team to architect microservices platform, cutting response time by 45%
• Built CI/CD pipeline with Jenkins & Docker, reducing deploy time from 3hrs to 12min
• Optimized PostgreSQL queries and indexing, boosting app performance by 60%

RARE 2-LINE EXAMPLES (up to 110 characters max):
• Architected cloud infrastructure on AWS serving 2M+ users with 99.9% uptime, cutting costs 40% via auto-scaling

Make the candidate appear as the perfect fit for "${jobTitle}" by strategically rewriting their experience.`;

    } else if (type === 'summary') {
      systemPrompt = `You are an expert resume writer specializing in crafting professional summaries tailored for specific job roles. Your PRIMARY task is to analyze the candidate's background in relation to the target job, then rewrite the summary to position them as the ideal candidate for that specific role.

TAILORING METHODOLOGY:
1. ANALYZE: Read the job description to understand key requirements, desired skills, and role expectations
2. CONNECT: Identify which aspects of the candidate's background directly address these requirements
3. REWRITE: Craft a summary that leads with the most relevant qualifications for THIS specific job
4. OPTIMIZE: Use terminology and keywords from the job description to demonstrate perfect alignment

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake qualifications or experience
2. NO asterisks (*) in the output
3. Keep it concise (2-3 sentences, maximum 4 sentences for senior roles)
4. Lead with the most relevant qualifications for the target job
5. Mirror language and terminology from the job description
6. Quantify achievements and experience where possible
7. Emphasize skills and competencies the job explicitly requires
8. Use confident, professional language that matches the role's seniority level
9. Make it results-focused and impact-driven
10. Position the candidate as solving the exact problems this role will face

TAILORING APPROACH:
- If job seeks "full-stack developer" → lead with full-stack expertise and relevant tech stack
- If job requires "5+ years experience" → mention years prominently if candidate qualifies
- If job emphasizes "leadership" → highlight team leadership and mentorship
- If job needs specific domain (e.g., fintech, healthcare) → foreground domain experience
- Use exact keywords from required qualifications section

Format: Return a cohesive paragraph summary without bullet points.`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Professional Summary:
${content}

Context - User's Background:
- Skills: ${context.skills?.join(', ') || 'Not specified'}
- Experience Count: ${context.allExperiences?.length || 0} positions
- Projects Count: ${context.allProjects?.length || 0} projects

TASK: Carefully analyze the job description above. Then:
1. Identify the 3-5 most critical requirements for the "${jobTitle}" role
2. Find connections between those requirements and the candidate's background
3. Rewrite the summary to lead with the strongest connections to the job requirements
4. Use keywords and phrases from the job description throughout
5. Make the candidate sound like the perfect match for THIS specific position

Transform this summary to make the candidate highly favorable and relevant for the "${jobTitle}" role. The recruiter should immediately see this person as an ideal fit.`;

    } else if (type === 'project') {
      systemPrompt = `You are an expert resume writer specializing in tailoring project descriptions for specific job roles. Your PRIMARY task is to analyze each project in relation to the target job, then rewrite it to showcase the most relevant technical skills and outcomes that make the candidate ideal for that position.

TAILORING METHODOLOGY:
1. ANALYZE: Examine the job description to identify required technologies, methodologies, and technical competencies
2. CONNECT: Find which aspects of the project demonstrate those exact competencies
3. REWRITE: Transform project descriptions to foreground relevant technologies and outcomes
4. OPTIMIZE: Use technical keywords from the job description and emphasize results that match role expectations

CRITICAL REQUIREMENTS:
1. Be 100% truthful - do not add fake technologies or achievements
2. NO asterisks (*) in the output
3. Maintain bullet point format with • symbols
4. STRICT LENGTH LIMIT: Each bullet point MUST be 1 line (75-95 characters), maximum 2 lines only in rare cases (110 characters absolute max)
5. Prioritize mentioning technologies, frameworks, and tools explicitly required in the job description
6. Reframe technical accomplishments to align with the target role's technical challenges
7. Quantify impact with specific metrics wherever possible
8. Emphasize problem-solving approaches relevant to the target position
9. Use terminology and technical language from the job description
10. Remove any technical details that don't strengthen fit for this specific role

TAILORING APPROACH:
- If job requires React → prominently mention React and related ecosystem tools
- If job needs cloud experience → highlight AWS/Azure/GCP usage and outcomes
- If job emphasizes scalability → feature scalability achievements and metrics
- If job wants microservices → foreground microservices architecture experience
- Match the technical stack and methodologies mentioned in job requirements

LENGTH ENFORCEMENT:
- Target 75-95 characters per bullet (ideal: 1 line)
- Rarely extend to 110 characters (2 lines) only for highly relevant technical achievements
- Eliminate filler: "built a", "created a", "developed a", "worked on"
- Use standard tech abbreviations: "JS" (JavaScript), "DB" (database), "API" (keep as-is)
- Every word must demonstrate relevant technical competency

Format: Return only the bullet points, one per line, starting with •`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Project Description:
${content}

TASK: Carefully read the job description above. For EACH bullet point in the project:
1. Identify which technologies and outcomes align with job requirements
2. Rewrite to emphasize those technologies using job description keywords
3. Highlight technical achievements that demonstrate competencies needed for the role
4. Remove technical details that aren't relevant to THIS specific position

EXAMPLES OF EFFECTIVE TAILORING (75-95 characters):
• Built React dashboard with Redux & real-time WebSocket updates, boosting engagement 35%
• Developed Node.js REST API with MongoDB, processing 10K+ requests/min at <100ms
• Implemented OAuth 2.0 & JWT authentication system, securing 50K+ user accounts

RARE 2-LINE EXAMPLES (up to 110 characters max):
• Architected microservices platform using Docker & Kubernetes, scaling to 1M users with 99.9% uptime

Make the candidate's projects demonstrate they have the exact technical skills needed for "${jobTitle}".`;

    } else if (type === 'skills') {
      systemPrompt = `You are an expert resume writer specializing in tailoring skills lists for specific job roles. Your PRIMARY task is to analyze the job description to understand which skills are most critical, then reorder and optimize the candidate's skills list to maximize relevance for that specific position.

TAILORING METHODOLOGY:
1. ANALYZE: Extract required and preferred skills from the job description
2. CONNECT: Match the candidate's existing skills to job requirements
3. PRIORITIZE: Reorder skills to place the most relevant ones first
4. OPTIMIZE: Add highly relevant skills the candidate likely has based on their background, remove irrelevant ones

CRITICAL REQUIREMENTS:
1. Only include skills that are realistic given the candidate's background
2. NO asterisks (*) in the output
3. Place the most job-relevant skills at the beginning of the list
4. Use exact skill names as they appear in the job description when possible
5. Include both technical and soft skills as emphasized in the job description
6. Use industry-standard naming conventions (e.g., "JavaScript" not "Javascript")
7. Maintain 10-16 skills total (not too few, not overwhelming)
8. Group related skills logically (e.g., all frontend frameworks together)
9. Remove skills that don't strengthen candidacy for THIS specific role
10. Match skill terminology to job description language

TAILORING APPROACH:
- If job emphasizes "Python" → ensure Python is near the top, add related tools (Django, Flask, etc.)
- If job requires "leadership" → include leadership-related soft skills prominently
- If job needs cloud expertise → prioritize AWS/Azure/GCP and related services
- If job mentions specific frameworks → feature those frameworks early in the list
- Order: Job-critical skills first → highly relevant skills → supporting skills

Format: Return skills as a comma-separated list without bullet points.`;

      userPrompt = `Target Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Current Skills:
${content}

Context - User's Background:
- Experience: ${context.allExperiences?.map(exp => `${exp.position} at ${exp.company}`).join(', ') || 'Not specified'}
- Projects: ${context.allProjects?.map(proj => proj.name).join(', ') || 'Not specified'}

TASK: Read the job description carefully and identify the most important skills for the "${jobTitle}" role. Then:
1. Reorder the candidate's existing skills to put the most relevant ones first
2. Add any critical skills from the job description that the candidate likely possesses based on their background
3. Remove skills that don't strengthen their candidacy for this specific position
4. Use exact terminology from the job description where applicable
5. Ensure the final list makes the candidate appear perfectly matched for the role

The recruiter should immediately see the exact skills they're looking for at the top of the list.`;
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
      max_tokens: 1200,
      temperature: 0.2, // Very low temperature for precise, consistent tailoring
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

        // Check if line is too long (over 110 characters - strict limit)
        if (cleanLine.length > 110) {
          console.log(`Warning: Line too long (${cleanLine.length} chars): ${cleanLine.substring(0, 50)}...`);

          // Try to truncate intelligently at word boundaries
          const words = cleanLine.split(' ');
          let truncated = '';

          for (const word of words) {
            if ((truncated + ' ' + word).length <= 105) { // Leave room for ellipsis
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
