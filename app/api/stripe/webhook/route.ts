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
  'price_1SLoMAGfV3OgrONkMEAyWnAG': 'basic', // $7/month
  'price_1SLoMuGfV3OgrONkCc9AOPqX': 'unlimited', // $15/month
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
    // Verify webhook signature for security
    if (!config.stripe.webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured in environment variables');
      console.error('⚠️ Webhooks will not work without this! Get it from Stripe Dashboard → Webhooks');
      // Fallback to parsing for development, but log warning
      event = JSON.parse(body);
      console.warn('⚠️ WARNING: Processing webhook without signature verification (development mode)');
    } else {
      // Production: Verify signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        config.stripe.webhookSecret
      );
      console.log('✅ Webhook signature verified successfully');
    }

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
        try {
          await handleCheckoutCompleted(session);
        } catch (error) {
          console.error('❌ Error handling checkout.session.completed:', error);
          throw error;
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('📋 Processing subscription event:', event.type, subscription.id);
        try {
          await handleSubscriptionUpdated(subscription);
        } catch (error) {
          console.error(`❌ Error handling ${event.type}:`, error);
          throw error;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('🗑️ Processing subscription deleted:', subscription.id);
        try {
          await handleSubscriptionDeleted(subscription);
        } catch (error) {
          console.error('❌ Error handling customer.subscription.deleted:', error);
          throw error;
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💰 Processing payment succeeded:', invoice.id);
        try {
          await handlePaymentSucceeded(invoice);
        } catch (error) {
          console.error('❌ Error handling invoice.payment_succeeded:', error);
          throw error;
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💸 Processing payment failed:', invoice.id);
        try {
          await handlePaymentFailed(invoice);
        } catch (error) {
          console.error('❌ Error handling invoice.payment_failed:', error);
          throw error;
        }
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    console.error('❌ Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed', details: (error as Error).message },
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
  try {
    const priceId = subscription.items.data[0]?.price.id;
    const planName = PLAN_MAPPING[priceId as keyof typeof PLAN_MAPPING] || 'unknown';

    console.log('💾 Upserting subscription data:', {
      userId,
      subscriptionId: subscription.id,
      priceId,
      planName,
      status: subscription.status
    });

    // Validate required data
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!subscription.customer) {
      throw new Error('subscription.customer is required');
    }
    if (!priceId) {
      throw new Error('priceId is required');
    }

    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_name: planName,
      status: subscription.status,
      current_period_start: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000).toISOString() : null,
      current_period_end: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    };

    console.log('📝 Subscription data to upsert:', subscriptionData);

    // Use user_id as the conflict resolution field (primary key)
    const { error, data } = await supabase
      .from('user_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id',
      })
      .select();

    if (error) {
      console.error('❌ Supabase upsert error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        subscriptionData
      });
      throw error;
    }

    console.log('✅ Successfully upserted subscription for user:', userId);
    console.log('✅ Upserted data:', data);

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
  } catch (error) {
    console.error('❌ Error in upsertSubscription:', error);
    throw error;
  }
}
