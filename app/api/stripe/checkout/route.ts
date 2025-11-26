import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getConfig } from '@/src/lib/env';
import { createClient } from '@supabase/supabase-js';

const config = getConfig();
const stripe = new Stripe(config.stripe.secretKey!, {
  apiVersion: '2025-09-30.clover',
});

const supabase = createClient(
  config.supabase.url!,
  config.supabase.serviceRoleKey!
);

// Price ID mapping
const PRICE_IDS = {
  basic: 'price_1SLoMAGfV3OgrONkMEAyWnAG', // $7/month
  unlimited: 'price_1SLoMuGfV3OgrONkCc9AOPqX', // $15/month
} as const;

export async function POST(request: NextRequest) {
  try {
    const { plan, priceId: incomingPriceId, userId, userEmail, successUrl, cancelUrl, planName } = await request.json();

    // Validate input
    if (!userId || (!plan && !incomingPriceId)) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and either plan or priceId' },
        { status: 400 }
      );
    }

    // Determine priceId (support either explicit priceId or known plan mapping)
    let priceId = incomingPriceId as string | undefined;
    if (!priceId) {
      if (!PRICE_IDS[plan as keyof typeof PRICE_IDS]) {
        return NextResponse.json(
          { error: 'Invalid plan. Must be "basic" or "unlimited" or provide priceId' },
          { status: 400 }
        );
      }
      priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    }

    // Define price IDs that should get a 3-day free trial (Student monthly, Basic monthly on paywall)
    const TRIAL_PRICE_IDS = new Set<string>([
      // Paywall prices (already trial-enabled)
      'price_1SOBwYGfV3OgrONkSrpIhdBH', // Basic monthly (paywall)
      'price_1SOBxuGfV3OgrONkamx6GPzC', // Student monthly (paywall)
      // Pricing page prices (add trials here too)
      'price_1SLoMAGfV3OgrONkMEAyWnAG', // Basic (pricing page)
      'price_1SLoMuGfV3OgrONkCc9AOPqX', // Unlimited (pricing page)
    ]);

    // Make trial duration configurable (defaults to 3 days)
    const TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || 3);

    // Check if user already has a Stripe customer
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = existingSubscription?.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        // email optional (paywall path may omit)
        ...(userEmail ? { email: userEmail } : {}),
        metadata: {
          supabase_user_id: userId,
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${config.app.url}/dashboard?success=true`,
      cancel_url: cancelUrl || `${config.app.url}/pricing?canceled=true`,
      metadata: {
        userId,
        plan: plan || planName || 'unknown',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          plan: plan || planName || 'unknown',
        },
        ...(TRIAL_PRICE_IDS.has(priceId) ? { trial_period_days: TRIAL_DAYS } : {}),
      },
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
