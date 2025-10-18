import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jsPDF from 'jspdf';

// Force Node.js runtime
export const runtime = 'nodejs';

// Validation schema for the request
const GeneratePDFRequestSchema = z.object({
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
  summary: z.string(),
  sectionOrder: z.array(z.string()).optional(), // New field for section order
});

/**
 * Generate professional resume PDF using jsPDF
 */
function generateResumePDF(userData: z.infer<typeof GeneratePDFRequestSchema>): Buffer {
  const { personalInfo, experiences, education, projects, skills, summary, sectionOrder } = userData;
  
  // Default section order if not provided
  const defaultOrder = ["summary", "experience", "education", "projects", "skills"];
  const sectionsToRender = sectionOrder || defaultOrder;
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // PDF dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  let currentY = margin;

  // Helper function to add text with word wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + (lines.length * (fontSize * 0.4)); // Better line height
  };

  // Helper function to add bullet points with proper indentation
  const addBulletPoints = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
    doc.setFontSize(fontSize);
    const bulletIndent = 5; // Indentation for bullet points
    const textIndent = 8; // Additional indentation for text after bullet
    
    // Split text by bullet points or line breaks
    const lines = text.split(/[•\n]/).filter(line => line.trim());
    let currentY = y;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // Add bullet point
        doc.text('•', x + bulletIndent, currentY);
        
        // Add text with proper wrapping, indented after bullet
        const wrappedLines = doc.splitTextToSize(trimmedLine, maxWidth - textIndent - bulletIndent);
        doc.text(wrappedLines, x + bulletIndent + textIndent, currentY);
        
        // Update Y position
        currentY += wrappedLines.length * (fontSize * 0.4) + 1; // Reduced spacing between bullets
      }
    });
    
    return currentY;
  };

  // Helper function to check if we need a new page
  const checkNewPage = (requiredHeight: number): number => {
    if (currentY + requiredHeight > pageHeight - margin) {
      doc.addPage();
      return margin;
    }
    return currentY;
  };

  // Header - Name and Contact Info
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(personalInfo.name, margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contactInfo = `${personalInfo.email} | ${personalInfo.phone} | ${personalInfo.state}`;
  doc.text(contactInfo, margin, currentY);
  currentY += 8;

  // Add horizontal line
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Section rendering functions
  const renderSection = {
    summary: () => {
      if (summary.trim()) {
        currentY = checkNewPage(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PROFESSIONAL SUMMARY', margin, currentY);
        currentY += 4;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentY = addWrappedText(summary, margin, currentY, contentWidth, 10);
        currentY += 4;
      }
    },

    experience: () => {
      if (experiences.length > 0) {
        currentY = checkNewPage(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PROFESSIONAL EXPERIENCE', margin, currentY);
        currentY += 4;

        experiences.forEach((exp, index) => {
          currentY = checkNewPage(25);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`${exp.position}`, margin, currentY);
          
          doc.setFont('helvetica', 'normal');
          const dateRange = `${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}`;
          const companyAndDate = `${exp.company} | ${dateRange}`;
          const textWidth = doc.getTextWidth(companyAndDate);
          doc.text(companyAndDate, pageWidth - margin - textWidth, currentY);
          currentY += 5;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text(exp.location, margin, currentY);
          currentY += 5;

          if (exp.description.trim()) {
            doc.setFont('helvetica', 'normal');
            currentY = addBulletPoints(exp.description, margin, currentY, contentWidth, 10);
          }
          currentY += 3;
        });
      }
    },

    education: () => {
      if (education.length > 0) {
        currentY = checkNewPage(20);
        currentY += 2;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('EDUCATION', margin, currentY);
        currentY += 4;

        education.forEach((edu, index) => {
          currentY = checkNewPage(15);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(edu.degree, margin, currentY);
          
          const dateRange = `${edu.startDate} - ${edu.current ? 'Present' : edu.endDate}`;
          const textWidth = doc.getTextWidth(dateRange);
          doc.text(dateRange, pageWidth - margin - textWidth, currentY);
          currentY += 5;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(edu.school, margin, currentY);
          currentY += 6;
        });
      }
    },

    projects: () => {
      if (projects.length > 0) {
        currentY = checkNewPage(20);
        currentY += 2;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PROJECTS', margin, currentY);
        currentY += 4;

        projects.forEach((project, index) => {
          currentY = checkNewPage(20);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(project.name, margin, currentY);
          currentY += 4;

          if (project.description.trim()) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            currentY = addBulletPoints(project.description, margin, currentY, contentWidth, 10);
          }
          currentY += 3;
        });
      }
    },

    skills: () => {
      if (skills.length > 0) {
        currentY = checkNewPage(20);
        currentY += 2;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SKILLS', margin, currentY);
        currentY += 4;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const skillsText = skills.join(' • ');
        currentY = addWrappedText(skillsText, margin, currentY, contentWidth, 10);
        currentY += 2;
      }
    }
  };

  // Render sections in the specified order
  sectionsToRender.forEach(sectionId => {
    if (renderSection[sectionId as keyof typeof renderSection]) {
      renderSection[sectionId as keyof typeof renderSection]();
    }
  });

  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * POST /api/generate-pdf
 * Generates a professional resume PDF
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = GeneratePDFRequestSchema.parse(body);

    // Check if user has enough data to generate a meaningful resume
    const hasBasicInfo = validatedData.personalInfo.name.trim() && validatedData.personalInfo.email.trim();
    const hasContent = validatedData.experiences.length > 0 || validatedData.education.length > 0 || validatedData.skills.length > 0;

    if (!hasBasicInfo) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Please fill in at least your name and email to generate a PDF.' 
        },
        { status: 400 }
      );
    }

    if (!hasContent) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Please add some experience, education, or skills to generate a meaningful resume PDF.' 
        },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = generateResumePDF(validatedData);

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${validatedData.personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid resume data provided',
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
        error: 'Failed to generate PDF' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate-pdf
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'ResumeMax PDF Generation API',
    version: '1.0',
    description: 'Generate professional resume PDFs from resume data',
    endpoints: {
      POST: {
        description: 'Generate and download a professional resume PDF',
        parameters: {
          personalInfo: 'Personal information (name, email, phone, state)',
          experiences: 'Array of work experiences',
          education: 'Array of education entries',
          projects: 'Array of projects',
          skills: 'Array of skills',
          summary: 'Professional summary text'
        },
        response: {
          type: 'application/pdf',
          description: 'Professional resume PDF file'
        }
      }
    },
    features: [
      'Professional traditional layout',
      'ATS-friendly formatting',
      'Automatic page breaks',
      'Clean typography',
      'Proper spacing and margins'
    ],
    requirements: [
      'Name and email are required',
      'At least one of: experience, education, or skills must be provided'
    ],
    runtime: 'nodejs'
  });
}
