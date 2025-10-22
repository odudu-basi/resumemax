import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incrementUsage } from '@/src/lib/subscription';

// Force Node.js runtime
export const runtime = 'nodejs';

// Request validation schema
const IncrementUsageRequestSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['resume_analysis', 'resume_creation', 'resume_download', 'cover_letter_analysis', 'resume_tailoring', 'ai_section_tailoring']),
});

/**
 * POST /api/increment-usage
 * Increment usage count for a specific action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = IncrementUsageRequestSchema.parse(body);

    // Increment usage in the database
    await incrementUsage(validatedData.userId, validatedData.action);

    return NextResponse.json({
      success: true,
      message: 'Usage incremented successfully'
    });

  } catch (error) {
    console.error('Increment usage error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error',
          details: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to increment usage' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/increment-usage
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'Increment Usage API',
    version: '1.0.0',
    description: 'Increments usage count for subscription tracking',
  });
}
