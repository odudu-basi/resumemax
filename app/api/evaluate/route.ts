import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';
import { scoreToPercentile, scoreToGrade } from '@/src/lib/percentile';
import { extractTextFromFile, ExtractionError, isSupportedFileType } from '@/src/lib/extract';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';

// Validation schema for the request
const EvaluateRequestSchema = z.object({
  targetJobRole: z.string().min(1, 'Target job role is required'),
  jobDescription: z.string().optional(),
});

// Zod schema for OpenAI response validation
const OpenAIResponseSchema = z.object({
  scores: z.object({
    ats: z.number().min(1).max(100),
    alignment: z.number().min(1).max(100),
    impact: z.number().min(1).max(100),
    polish: z.number().min(1).max(100),
    potential: z.number().min(1).max(100),
    overall: z.number().min(1).max(100),
  }),
  estimatedPercentile: z.number().min(1).max(99),
  label: z.enum(["Excellent", "Strong", "Above Average", "Average", "Needs Improvement"]),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  recommendations: z.array(z.string()),
});

type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

// Initialize OpenAI client
const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Remove the old extractTextFromFile function as we're now using the one from the extract helper

/**
 * Analyze resume using OpenAI with the refined 6-category system
 */
async function analyzeResumeWithAI(
  resumeText: string,
  jobRole: string,
  jobDescription?: string
): Promise<OpenAIResponse> {
  const prompt = `You are a professional ATS evaluator and recruitment expert. 
Your task is to analyze a resume against a given jobRole (and optional jobDescription) 
and rate it using a recruiter-calibrated 6-category system. 
Be strict, factual, and consistent with real-world expectations.

---

CONTEXT & RULES

1. Evaluation Criteria (each scored 1–100):
   • ats: ATS-readiness (keywords, formatting, section labels, and parseability)
   • alignment: Relevance to the jobRole and jobDescription
   • impact: Strength of accomplishments (quantified results, measurable outcomes)
   • polish: Grammar, clarity, layout simplicity, and professionalism
   • potential: Estimated score if all recommendations are applied; cap at 95 if the candidate lacks major required skills
   • overall: Holistic assessment of resume strength for the role

2. Role & Industry Weighting
   - Technical roles → prioritize skills, tools, and measurable impact
   - Business/operations roles → prioritize achievements, leadership, clarity
   - Education/medical/creative → prioritize credentials, clarity, and relevance
   - Adjust alignment and impact emphasis accordingly.

3. Scoring Calibration
   - 90–100 → Exceptional (top 5%)
   - 80–89 → Strong (top 25%)
   - 70–79 → Average
   - 60–69 → Below average
   - <60 → Weak or misaligned
   - Be consistent and realistic. Average resumes should score ~70–75 overall.

4. ATS & Keyword Logic
   - Check for semantic keyword overlap with the jobRole and jobDescription.
   - Verify section clarity ("Experience", "Education", "Skills").
   - Penalize if critical keywords or certifications are missing or hidden in dense paragraphs.
   - Never reward keyword stuffing.

5. Bias & Normalization
   - Normalize scores relative to role seniority (junior vs. senior).
   - Do not inflate scores for verbosity or buzzwords.
   - Short, clear, relevant resumes should outperform long, unfocused ones.

6. Recommendations
   - Provide concise, role-specific, and actionable feedback.
   - Include specific examples: missing keywords, phrasing improvements, or section restructuring.
   - Offer at least 2 example bullet rewrites or measurable improvements.

7. Percentile Estimation
   - Estimate the applicant's standing among 1,000 similar applicants.
   - Use this heuristic mapping:
       <50 → 5–24th percentile
       50–59 → 25–39th
       60–69 → 40–59th
       70–79 → 60–74th
       80–89 → 75–89th
       90–94 → 90–97th
       95–100 → 98–99th
   - Clamp to 1–99. Label as:
       ≥90: "Excellent"
       75–89: "Strong"
       60–74: "Above Average"
       40–59: "Average"
       <40: "Needs Improvement"

8. Output strictly as JSON. 
   No prose outside the JSON object.

---

OUTPUT FORMAT

{
  "scores": {
    "ats": number,
    "alignment": number,
    "impact": number,
    "polish": number,
    "potential": number,
    "overall": number
  },
  "estimatedPercentile": number,
  "label": "Excellent | Strong | Above Average | Average | Needs Improvement",
  "strengths": [ "string" ],
  "improvements": [ "string" ],
  "recommendations": [
    "Specific, actionable suggestions and 1–2 sample bullet rewrites if applicable."
  ]
}

---

INPUTS
- jobRole: ${jobRole}
- jobDescription: ${jobDescription || 'Not provided'}
- resumeText: ${resumeText}

---

GUIDANCE
Score honestly and critically, as if you were a recruiter screening hundreds of resumes for this role. 
Do not reward appearance; reward clarity, results, and relevance.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional ATS evaluator and recruitment expert. Always respond with valid JSON only, no additional text or formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsedResponse = JSON.parse(cleanedResponse);

    // Validate the response with Zod
    const validatedResponse = OpenAIResponseSchema.parse(parsedResponse);
    
    return validatedResponse;
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid AI response format: ${error.issues.map(i => i.message).join(', ')}`);
    }
    throw new Error('Failed to analyze resume with AI');
  }
}

/**
 * POST /api/evaluate
 * Handles resume analysis requests
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('resume') as File;
    const targetJobRole = formData.get('targetJobRole') as string;
    const jobDescription = formData.get('jobDescription') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'Resume file is required' },
        { status: 400 }
      );
    }

    // Validate form data
    const validatedData = EvaluateRequestSchema.parse({
      targetJobRole,
      jobDescription: jobDescription || undefined,
    });

    // Validate file type
    if (!isSupportedFileType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOC, or DOCX files only.' },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = config.upload.maxFileSize; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Extract text from file using the helper
    const extractionResult = await extractTextFromFile(file);
    const resumeText = extractionResult.text;

    // Analyze resume with AI
    const startTime = Date.now();
    const aiAnalysis = await analyzeResumeWithAI(
      resumeText,
      validatedData.targetJobRole,
      validatedData.jobDescription
    );
    const processingTime = Date.now() - startTime;

    // Use the AI's estimated percentile, but also compute our own for comparison
    const computedPercentile = scoreToPercentile(aiAnalysis.scores.overall);
    const grade = scoreToGrade(aiAnalysis.scores.overall);

    // Create analysis result with the new format
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      success: true,
      analysisId,
      data: {
        scores: aiAnalysis.scores,
        estimatedPercentile: aiAnalysis.estimatedPercentile,
        computedPercentile, // Our computed percentile for comparison
        label: aiAnalysis.label,
        grade, // Letter grade based on overall score
        strengths: aiAnalysis.strengths,
        improvements: aiAnalysis.improvements,
        recommendations: aiAnalysis.recommendations,
        resumeText: resumeText,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          processingTime,
          analyzedAt: new Date().toISOString(),
          version: "2.0",
        }
      },
      message: 'Resume analysis completed successfully'
    };

    // In production, you would save this to a database
    // For now, we'll return it directly
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Resume analysis error:', error);
    
    if (error instanceof ExtractionError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.originalError?.message
        },
        { status: 400 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evaluate
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax Evaluation API',
    version: '2.0',
    description: 'AI-powered resume analysis with 6-category scoring system',
    endpoints: {
      POST: {
        description: 'Submit resume for comprehensive analysis',
        parameters: {
          resume: 'Resume file (PDF, DOC, DOCX)',
          targetJobRole: 'Target job role (required)',
          jobDescription: 'Job description (optional)'
        },
        response: {
          scores: {
            ats: 'ATS-readiness score (1-100)',
            alignment: 'Job relevance score (1-100)',
            impact: 'Achievement impact score (1-100)',
            polish: 'Professional polish score (1-100)',
            potential: 'Improvement potential score (1-100)',
            overall: 'Overall resume score (1-100)'
          },
          estimatedPercentile: 'Percentile ranking (1-99)',
          label: 'Performance label (Excellent/Strong/Above Average/Average/Needs Improvement)',
          strengths: 'Array of resume strengths',
          improvements: 'Array of improvement areas',
          recommendations: 'Array of specific actionable recommendations',
          resumeText: 'Extracted resume text'
        }
      }
    },
    supportedFormats: ['PDF', 'DOC', 'DOCX'],
    maxFileSize: '10MB',
    scoringSystem: {
      categories: 6,
      scale: '1-100',
      calibration: 'Recruiter-calibrated scoring',
      percentileMapping: 'AI-estimated percentile ranking'
    },
    runtime: 'nodejs'
  });
}
