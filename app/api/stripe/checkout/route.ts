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
  basic: 'price_1SJGF6GfV3OgrONkHsG1SRpl', // $4/month
  unlimited: 'price_1SFol1GfV3OgrONkCw68vdG1', // $9.99/month
} as const;

export async function POST(request: NextRequest) {
  try {
    const { plan, userId, userEmail } = await request.json();

    // Validate input
    if (!plan || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: plan, userId, userEmail' },
        { status: 400 }
      );
    }

    if (!PRICE_IDS[plan as keyof typeof PRICE_IDS]) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "basic" or "unlimited"' },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];

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
        email: userEmail,
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
      success_url: `${config.app.url}/dashboard?success=true`,
      cancel_url: `${config.app.url}/pricing?canceled=true`,
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          plan,
        },
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
