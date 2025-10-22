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
    console.error('❌ No webhook signature provided');
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
    
    console.log('✅ Received webhook event:', event.type, event.id);
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('🛒 Processing checkout completed:', session.id);
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('📋 Processing subscription updated:', subscription.id);
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('🗑️ Processing subscription deleted:', subscription.id);
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💰 Processing payment succeeded:', invoice.id);
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💸 Processing payment failed:', invoice.id);
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('🛒 Processing checkout completed:', session.id);

  // Get the subscription details - THIS IS THE FIX!
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    
    // Get userId from SUBSCRIPTION metadata, not session metadata
    const userId = subscription.metadata?.supabase_user_id;
    if (!userId) {
      console.error('❌ No supabase_user_id in subscription metadata');
      console.log('🔍 Available subscription metadata:', subscription.metadata);
      return;
    }

    console.log('✅ Found userId in subscription metadata:', userId);
    await upsertSubscription(subscription, userId);
  } else {
    console.error('❌ No subscription found in completed checkout session');
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('📋 Processing subscription updated:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('❌ No supabase_user_id in subscription metadata');
    console.log('🔍 Available subscription metadata:', subscription.metadata);
    return;
  }

  console.log('✅ Found userId in subscription metadata:', userId);
  await upsertSubscription(subscription, userId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Processing subscription deleted:', subscription.id);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }

  console.log('✅ Successfully canceled subscription:', subscription.id);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Processing payment succeeded:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
    
    const userId = subscription.metadata?.supabase_user_id;
    if (userId) {
      console.log('✅ Found userId for payment success:', userId);
      await upsertSubscription(subscription, userId);
    } else {
      console.error('❌ No supabase_user_id in subscription metadata for payment');
    }
  } else {
    console.error('❌ No subscription found for invoice:', invoice.id);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('💸 Processing payment failed:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId) {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (error) {
      console.error('❌ Error updating failed payment:', error);
      throw error;
    }

    console.log('✅ Successfully marked subscription as past_due:', subscriptionId);
  }
}

async function upsertSubscription(subscription: Stripe.Subscription, userId: string) {
  const priceId = subscription.items.data[0]?.price.id;
  const planName = PLAN_MAPPING[priceId as keyof typeof PLAN_MAPPING] || 'unknown';

  console.log('💾 Upserting subscription data:', {
    userId,
    subscriptionId: subscription.id,
    priceId,
    planName,
    status: subscription.status
  });

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

  // FIX: Use user_id as the conflict resolution field (primary key)
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id',  // ← FIXED: Use user_id instead of stripe_subscription_id
    });

  if (error) {
    console.error('❌ Error upserting subscription:', error, subscriptionData);
    throw error;
  }

  console.log('✅ Successfully upserted subscription for user:', userId);
  
  // Verify the data was saved
  const { data: savedData, error: verifyError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (verifyError) {
    console.error('❌ Error verifying saved subscription:', verifyError);
  } else {
    console.log('✅ Verified saved subscription data:', savedData);
  }
}
