import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/src/lib/env';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to check webhook configuration
 * Visit: https://your-domain.com/api/stripe/webhook-test
 */
export async function GET(request: NextRequest) {
  const config = getConfig();

  // Check Supabase connection
  let supabaseConnected = false;
  let subscriptionTableExists = false;

  try {
    const supabase = createClient(
      config.supabase.url!,
      config.supabase.serviceRoleKey!
    );

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('count')
      .limit(1);

    supabaseConnected = !error;
    subscriptionTableExists = !error;
  } catch (error) {
    console.error('Supabase test error:', error);
  }

  // Check recent subscription count
  let recentSubscriptionCount = 0;
  try {
    const supabase = createClient(
      config.supabase.url!,
      config.supabase.serviceRoleKey!
    );

    const { count } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

    recentSubscriptionCount = count || 0;
  } catch (error) {
    console.error('Count error:', error);
  }

  return NextResponse.json({
    status: 'Webhook configuration check',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,

    stripe: {
      hasSecretKey: !!config.stripe.secretKey,
      secretKeyPreview: config.stripe.secretKey?.substring(0, 7) + '...',
      hasWebhookSecret: !!config.stripe.webhookSecret,
      webhookSecretPreview: config.stripe.webhookSecret?.substring(0, 10) + '...',
      stripeEnabled: config.stripe.enabled,
    },

    supabase: {
      hasUrl: !!config.supabase.url,
      url: config.supabase.url,
      hasAnonKey: !!config.supabase.anonKey,
      hasServiceRoleKey: !!config.supabase.serviceRoleKey,
      serviceRoleKeyPreview: config.supabase.serviceRoleKey?.substring(0, 20) + '...',
      connected: supabaseConnected,
      subscriptionTableExists,
      recentSubscriptionsLast7Days: recentSubscriptionCount,
    },

    app: {
      url: config.app.url,
      env: config.app.env,
    },

    recommendations: [
      !config.stripe.webhookSecret && '⚠️ STRIPE_WEBHOOK_SECRET is missing - webhooks will fail!',
      !config.stripe.secretKey && '⚠️ STRIPE_SECRET_KEY is missing',
      !config.supabase.serviceRoleKey && '⚠️ SUPABASE_SERVICE_ROLE_KEY is missing - can\'t write to database',
      !supabaseConnected && '⚠️ Cannot connect to Supabase',
      !subscriptionTableExists && '⚠️ user_subscriptions table does not exist',
      recentSubscriptionCount === 0 && '⚠️ No subscriptions created in last 7 days - webhooks may not be working',
    ].filter(Boolean),

    nextSteps: [
      'Check Stripe Dashboard → Webhooks for failed events',
      'Check Vercel logs for webhook processing errors',
      'Verify STRIPE_WEBHOOK_SECRET matches Stripe Dashboard',
      'Test webhook with: stripe listen --forward-to localhost:3000/api/stripe/webhook',
    ],
  });
}
