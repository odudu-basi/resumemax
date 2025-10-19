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
const AnalyzeRequestSchema = z.object({
  jobRole: z.string(),
  jobDescription: z.string().optional(),
  resumeText: z.string(),
});

// Response schema
const AnalysisResultSchema = z.object({
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

export async function POST(request: NextRequest) {
  try {
    console.log('=== Resume Analysis API Called ===');
    const body = await request.json();
    
    // Validate request
    const validatedData = AnalyzeRequestSchema.parse(body);
    const { jobRole, jobDescription, resumeText } = validatedData;

    console.log('Job role:', jobRole);
    console.log('Resume text length:', resumeText.length);

    // Create the analysis prompt
    const systemPrompt = `You are a professional ATS evaluator and recruitment expert. 
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

8. Output ONLY valid JSON. 
   - No markdown code blocks
   - No explanatory text before or after the JSON
   - No comments within the JSON
   - Start directly with { and end with }

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

GUIDANCE
Score honestly and critically, as if you were a recruiter screening hundreds of resumes for this role. 
Do not reward appearance; reward clarity, results, and relevance.`;

    const userPrompt = `INPUTS
- jobRole: ${jobRole}
- jobDescription: ${jobDescription || 'Not provided'}
- resumeText: 
${resumeText}

Analyze this resume and provide scores and recommendations.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      temperature: 0.1, // Low temperature for consistent analysis
    });

    const analysisResponse = completion.choices[0]?.message?.content;
    if (!analysisResponse) {
      throw new Error('No response from OpenAI');
    }

    // Clean and parse the JSON response
    let analysisData;
    let cleanedResponse = '';
    try {
      console.log('Raw OpenAI response:', analysisResponse);
      
      // Remove markdown code blocks if present
      cleanedResponse = analysisResponse.trim();
      
      // Remove ```json and ``` markers if they exist
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any leading/trailing text that's not JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('Cleaned response for parsing:', cleanedResponse);
      
      // Parse the cleaned JSON
      analysisData = JSON.parse(cleanedResponse.trim());
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON');
      console.error('Raw response:', analysisResponse);
      console.error('Cleaned response:', cleanedResponse);
      console.error('Parse error:', error);
      
      // Return a fallback response instead of throwing
      return NextResponse.json({
        error: 'AI response parsing failed',
        details: 'The AI returned an invalid response format. Please try again.',
        rawResponse: analysisResponse?.substring(0, 500) + '...' // Truncate for debugging
      }, { status: 500 });
    }

    // Validate against schema
    const validatedAnalysis = AnalysisResultSchema.parse(analysisData);

    console.log('Resume analysis completed successfully');
    console.log('Overall score:', validatedAnalysis.scores.overall);
    console.log('Percentile:', validatedAnalysis.estimatedPercentile);

    return NextResponse.json({
      success: true,
      analysis: validatedAnalysis,
      jobRole,
      jobDescription: jobDescription || null
    });

  } catch (error) {
    console.error('=== Resume analysis error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    
    if (error instanceof z.ZodError) {
      console.log('Zod validation error');
      return NextResponse.json(
        { 
          error: 'Invalid analysis data format',
          details: error.issues.map((issue: any) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

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
    usage: 'POST with JSON body containing jobRole, resumeText, and optional jobDescription',
    categories: ['ats', 'alignment', 'impact', 'polish', 'potential', 'overall']
  });
}
