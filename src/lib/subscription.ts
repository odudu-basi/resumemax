import { createClient } from '@supabase/supabase-js';
import { getConfig } from './env';
import type { UserSubscription, UsageTracking } from './supabase';

const config = getConfig();
const supabase = createClient(
  config.supabase.url!,
  config.supabase.serviceRoleKey!
);

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    resumeAnalyses: 3,
    resumeCreations: 3,
    resumeDownloads: 0, // No downloads for free users
    coverLetterAnalyses: 0,
    resumeTailoring: 3, // 3 free tailor sessions
    aiSectionTailoring: 2, // 2 AI section tailoring clicks
    templateAccess: false,
    prioritySupport: false,
  },
  basic: {
    resumeAnalyses: 25,
    resumeCreations: 25,
    resumeDownloads: 10, // 10 downloads per month
    coverLetterAnalyses: 0,
    resumeTailoring: 25, // 25 tailor sessions per month
    aiSectionTailoring: 12, // 12 AI section tailoring clicks
    templateAccess: false,
    prioritySupport: true,
  },
  unlimited: {
    resumeAnalyses: -1, // Unlimited
    resumeCreations: -1, // Unlimited
    resumeDownloads: -1, // Unlimited downloads
    coverLetterAnalyses: -1, // Unlimited
    resumeTailoring: -1, // Unlimited tailoring
    aiSectionTailoring: -1, // Unlimited AI section tailoring
    templateAccess: true,
    prioritySupport: true,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type ActionType = 'resume_analysis' | 'resume_creation' | 'resume_download' | 'cover_letter_analysis' | 'resume_tailoring' | 'ai_section_tailoring';

export interface SubscriptionInfo {
  planName: PlanName;
  status: string;
  isActive: boolean;
  currentPeriodEnd: Date | null;
  limits: typeof PLAN_LIMITS[PlanName];
}

export interface UsageInfo {
  resumeAnalyses: number;
  resumeCreations: number;
  resumeDownloads: number;
  coverLetterAnalyses: number;
  resumeTailoring: number;
  aiSectionTailoring: number;
}

/**
 * Get user's current subscription information
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo> {
  try {
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Default to free plan if no subscription
    const planName: PlanName = subscription?.plan_name as PlanName || 'free';
    const isActive = subscription?.status === 'active' && 
      (!subscription?.current_period_end || new Date(subscription.current_period_end) > new Date());

    return {
      planName: isActive ? planName : 'free',
      status: subscription?.status || 'free',
      isActive,
      currentPeriodEnd: subscription?.current_period_end ? new Date(subscription.current_period_end) : null,
      limits: PLAN_LIMITS[isActive ? planName : 'free'],
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    // Return free plan on error
    return {
      planName: 'free',
      status: 'free',
      isActive: false,
      currentPeriodEnd: null,
      limits: PLAN_LIMITS.free,
    };
  }
}

/**
 * Get user's current monthly usage
 */
export async function getUserUsage(userId: string): Promise<UsageInfo> {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const { data: usage, error } = await supabase
      .from('usage_tracking')
      .select('action_type, count')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .eq('year', currentYear);

    if (error) {
      throw error;
    }

    const usageMap: UsageInfo = {
      resumeAnalyses: 0,
      resumeCreations: 0,
      resumeDownloads: 0,
      coverLetterAnalyses: 0,
      resumeTailoring: 0,
      aiSectionTailoring: 0,
    };

    usage?.forEach((item) => {
      switch (item.action_type) {
        case 'resume_analysis':
          usageMap.resumeAnalyses = item.count;
          break;
        case 'resume_creation':
          usageMap.resumeCreations = item.count;
          break;
        case 'resume_download':
          usageMap.resumeDownloads = item.count;
          break;
        case 'cover_letter_analysis':
          usageMap.coverLetterAnalyses = item.count;
          break;
        case 'resume_tailoring':
          usageMap.resumeTailoring = item.count;
          break;
        case 'ai_section_tailoring':
          usageMap.aiSectionTailoring = item.count;
          break;
      }
    });

    return usageMap;
  } catch (error) {
    console.error('Error getting user usage:', error);
    return {
      resumeAnalyses: 0,
      resumeCreations: 0,
      resumeDownloads: 0,
      coverLetterAnalyses: 0,
      resumeTailoring: 0,
      aiSectionTailoring: 0,
    };
  }
}

/**
 * Check if user can perform an action
 */
export async function canPerformAction(
  userId: string,
  action: ActionType
): Promise<{ canPerform: boolean; reason?: string; usage?: UsageInfo; limits?: typeof PLAN_LIMITS[PlanName] }> {
  try {
    const [subscription, usage] = await Promise.all([
      getUserSubscription(userId),
      getUserUsage(userId),
    ]);

    let limit: number;
    let currentUsage: number;

    switch (action) {
      case 'resume_analysis':
        limit = subscription.limits.resumeAnalyses;
        currentUsage = usage.resumeAnalyses;
        break;
      case 'resume_creation':
        limit = subscription.limits.resumeCreations;
        currentUsage = usage.resumeCreations;
        break;
      case 'resume_download':
        limit = subscription.limits.resumeDownloads;
        currentUsage = usage.resumeDownloads;
        break;
      case 'cover_letter_analysis':
        limit = subscription.limits.coverLetterAnalyses;
        currentUsage = usage.coverLetterAnalyses;
        break;
      case 'resume_tailoring':
        limit = subscription.limits.resumeTailoring;
        currentUsage = usage.resumeTailoring;
        break;
      case 'ai_section_tailoring':
        limit = subscription.limits.aiSectionTailoring;
        currentUsage = usage.aiSectionTailoring;
        break;
      default:
        return { canPerform: false, reason: 'Invalid action type' };
    }

    // -1 means unlimited
    if (limit === -1) {
      return { canPerform: true, usage, limits: subscription.limits };
    }

    const canPerform = currentUsage < limit;
    const reason = canPerform 
      ? undefined 
      : `You've reached your monthly limit of ${limit} ${action.replace('_', ' ')}s. Upgrade your plan to continue.`;

    return {
      canPerform,
      reason,
      usage,
      limits: subscription.limits,
    };
  } catch (error) {
    console.error('Error checking action permission:', error);
    return {
      canPerform: false,
      reason: 'Error checking subscription status. Please try again.',
    };
  }
}

/**
 * Increment usage for an action
 */
export async function incrementUsage(userId: string, action: ActionType): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_usage', {
      user_uuid: userId,
      action: action,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error incrementing usage:', error);
    throw error;
  }
}

/**
 * Middleware function to check subscription and usage
 */
export async function withSubscriptionCheck(
  userId: string,
  action: ActionType,
  callback: () => Promise<any>
) {
  const check = await canPerformAction(userId, action);
  
  if (!check.canPerform) {
    throw new Error(check.reason || 'Action not allowed');
  }

  // Perform the action
  const result = await callback();

  // Increment usage after successful action
  await incrementUsage(userId, action);

  return result;
}

/**
 * Get upgrade URL for current user
 */
export function getUpgradeUrl(currentPlan: PlanName = 'free'): string {
  return '/pricing';
}

/**
 * Format plan name for display
 */
export function formatPlanName(planName: PlanName): string {
  switch (planName) {
    case 'free':
      return 'Free';
    case 'basic':
      return 'Basic';
    case 'unlimited':
      return 'Unlimited';
    default:
      return 'Unknown';
  }
}
