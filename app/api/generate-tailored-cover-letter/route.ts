import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseClient } from '@/src/lib/supabase';
import { jsPDF } from 'jspdf';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to generate PDF from cover letter text
function generateCoverLetterPDF(coverLetterText: string): string {
  const doc = new jsPDF({
    format: 'letter',
    unit: 'pt',
  });

  // Set margins and font
  const margin = 72; // 1 inch margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - (margin * 2);

  doc.setFont('times', 'normal');
  doc.setFontSize(12);

  // Add text with word wrap
  const lines = doc.splitTextToSize(coverLetterText, maxWidth);
  doc.text(lines, margin, margin);

  // Convert to base64
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  return pdfBase64;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, jobDescription, jobTitle, companyName, requirements } = await request.json();

    if (!userId || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, jobDescription' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching user profile for cover letter generation...');

    // Fetch user's complete profile and experience
    const supabase = createSupabaseClient();

    const [userProfileData, experienceData, educationData, skillsData] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('experience_entries').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
      supabase.from('education_entries').select('*').eq('user_id', userId).order('start_year', { ascending: false }),
      supabase.from('skills_certifications').select('*').eq('user_id', userId).single(),
    ]);

    const userProfile = userProfileData.data;
    const experiences = experienceData.data || [];
    const education = educationData.data || [];
    const skills = skillsData.data;

    console.log('✅ User profile fetched');

    // Build user experience context
    const experienceContext = experiences.map((exp: any) => {
      const duration = exp.is_current
        ? `${exp.start_date} - Present`
        : `${exp.start_date || 'N/A'} - ${exp.end_date || 'N/A'}`;

      return `**${exp.role || 'Role'}** at **${exp.company || 'Company'}** (${duration})
${exp.description || 'No description provided'}`;
    }).join('\n\n');

    const educationContext = education.map((edu: any) =>
      `${edu.degree || 'Degree'} in ${edu.major || 'Field'} from ${edu.school || 'School'} (${edu.end_year || edu.start_year || 'N/A'})`
    ).join('\n');

    const skillsContext = skills?.technical_skills?.join(', ') || 'Not specified';

    console.log('✍️ Generating cover letter with OpenAI...');

    // Generate cover letter using OpenAI
    const prompt = `You are a professional cover letter writer. Generate a truthful, compelling cover letter for this job application.

**CRITICAL RULES:**
1. ONLY use the user's ACTUAL experience listed below
2. DO NOT invent or exaggerate any experiences, skills, or achievements
3. Be specific and concrete - reference real projects/accomplishments from their experience
4. Keep it concise (250-350 words)
5. Match the tone to the company and role
6. Focus on relevant experience that aligns with job requirements

**Job Details:**
- Position: ${jobTitle || 'Not specified'}
- Company: ${companyName || 'Not specified'}
- Requirements: ${requirements || 'Not specified'}

**Job Description:**
${jobDescription}

**User's ACTUAL Experience:**
${experienceContext || 'No experience data available'}

**User's Education:**
${educationContext || 'Not specified'}

**User's Skills:**
${skillsContext}

**User Profile:**
- Name: ${userProfile?.full_name || 'Applicant'}
- Location: ${userProfile?.location || 'Not specified'}

Generate a professional cover letter that:
1. Opens with enthusiasm for the specific role and company
2. Highlights 2-3 REAL experiences/achievements that directly relate to the job requirements
3. Explains why they're a strong fit using ONLY truthful information
4. Closes with a call to action

Format:
Dear Hiring Manager,

[Opening paragraph expressing interest]

[Body paragraph highlighting relevant experience]

[Closing paragraph with call to action]

Sincerely,
${userProfile?.full_name || 'Applicant'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert cover letter writer who creates compelling, truthful cover letters that highlight real experience and achievements.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const coverLetterText = completion.choices[0].message.content;

    if (!coverLetterText) {
      throw new Error('Failed to generate cover letter');
    }

    console.log('✅ Cover letter generated successfully');
    console.log('📄 Converting to PDF...');

    // Generate PDF from cover letter text
    const coverLetterPDF = generateCoverLetterPDF(coverLetterText);

    console.log('✅ Cover letter PDF generated');

    return NextResponse.json({
      success: true,
      coverLetter: coverLetterText, // Plain text for display
      coverLetterPDF: {
        fileName: 'Cover_Letter.pdf',
        fileType: 'application/pdf',
        contentBase64: coverLetterPDF,
      },
      metadata: {
        jobTitle,
        companyName,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('❌ Error generating cover letter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate cover letter' },
      { status: 500 }
    );
  }
}
