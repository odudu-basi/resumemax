import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '@/src/lib/env';
import { getUserSubscription, getUserUsage, canPerformAction } from '@/src/lib/subscription';

const config = getConfig();

export async function GET(request: NextRequest) {
  try {
    // Get user ID from Authorization header or query params
    const authHeader = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId && !authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // If we have an auth header, verify it with Supabase
    let verifiedUserId = userId;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createClient(config.supabase.url!, config.supabase.anonKey!);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
      
      verifiedUserId = user.id;
    }

    if (!verifiedUserId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Get subscription info and usage
    const [subscription, usage] = await Promise.all([
      getUserSubscription(verifiedUserId),
      getUserUsage(verifiedUserId),
    ]);

    // Check permissions for different actions
    const [canAnalyze, canCreate, canDownload, canCoverLetter, canTailor, canAiTailor] = await Promise.all([
      canPerformAction(verifiedUserId, 'resume_analysis'),
      canPerformAction(verifiedUserId, 'resume_creation'),
      canPerformAction(verifiedUserId, 'resume_download'),
      canPerformAction(verifiedUserId, 'cover_letter_analysis'),
      canPerformAction(verifiedUserId, 'resume_tailoring'),
      canPerformAction(verifiedUserId, 'ai_section_tailoring'),
    ]);

    return NextResponse.json({
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        isActive: subscription.isActive,
        currentPeriodEnd: subscription.currentPeriodEnd,
        limits: subscription.limits,
      },
      usage,
      permissions: {
        resumeAnalysis: {
          canPerform: canAnalyze.canPerform,
          reason: canAnalyze.reason,
        },
        resumeCreation: {
          canPerform: canCreate.canPerform,
          reason: canCreate.reason,
        },
        resumeDownload: {
          canPerform: canDownload.canPerform,
          reason: canDownload.reason,
        },
        coverLetterAnalysis: {
          canPerform: canCoverLetter.canPerform,
          reason: canCoverLetter.reason,
        },
        resumeTailoring: {
          canPerform: canTailor.canPerform,
          reason: canTailor.reason,
        },
        aiSectionTailoring: {
          canPerform: canAiTailor.canPerform,
          reason: canAiTailor.reason,
        },
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}
