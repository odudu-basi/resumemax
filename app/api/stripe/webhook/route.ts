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

// Plan mapping from price IDs
const PLAN_MAPPING = {
  'price_1SJGF6GfV3OgrONkHsG1SRpl': 'basic', // $4/month
  'price_1SFol1GfV3OgrONkCw68vdG1': 'unlimited', // $9.99/month
} as const;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // For now, we'll skip webhook signature verification during development
    // In production, add your webhook secret to env variables
    event = JSON.parse(body);
    
    // TODO: Uncomment this when you have the webhook secret
    // event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   config.stripe.webhookSecret!
    // );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout completed:', session.id);

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Get the subscription details
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await upsertSubscription(subscription, userId);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription updated:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('No supabase_user_id in subscription metadata');
    return;
  }

  await upsertSubscription(subscription, userId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deleted:', subscription.id);

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing payment succeeded:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const userId = subscription.metadata?.supabase_user_id;
    if (userId) {
      await upsertSubscription(subscription, userId);
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing payment failed:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);
  }
}

async function upsertSubscription(subscription: Stripe.Subscription, userId: string) {
  const priceId = subscription.items.data[0]?.price.id;
  const planName = PLAN_MAPPING[priceId as keyof typeof PLAN_MAPPING] || 'unknown';

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_name: planName,
    status: subscription.status,
    current_period_start: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000).toISOString() : null,
    current_period_end: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('Error upserting subscription:', error);
    throw error;
  }

  console.log('Successfully upserted subscription for user:', userId);
}
