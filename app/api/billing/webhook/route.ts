import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// Disable body parsing for webhook (we need raw body for signature verification)
export const dynamic = 'force-dynamic';

// POST /api/billing/webhook - Handle Stripe webhook events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeServer();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const error = err as Error;
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutExpired(session);
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailed(paymentIntent);
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// Handle successful checkout
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { tenantId, amount, type } = session.metadata || {};

  if (!tenantId || !amount || type !== 'TOP_UP') {
    console.error('Invalid session metadata:', session.metadata);
    return;
  }

  const topUpAmount = parseFloat(amount);

  try {
    // Update tenant balance
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        balance: { increment: topUpAmount },
      },
    });

    // Create billing transaction record
    await prisma.billingTransaction.create({
      data: {
        tenantId,
        type: 'TOP_UP',
        amount: topUpAmount,
        description: `Added $${topUpAmount.toFixed(2)} credits via Stripe`,
        status: 'COMPLETED',
        reference: session.payment_intent as string || session.id,
      },
    });

    console.log(`Successfully added $${topUpAmount.toFixed(2)} to tenant ${tenantId}. New balance: $${updatedTenant.balance.toFixed(2)}`);
  } catch (error) {
    console.error('Error processing checkout completion:', error);
    throw error;
  }
}

// Handle expired checkout
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const { tenantId, amount } = session.metadata || {};

  if (!tenantId || !amount) {
    return;
  }

  try {
    // Create a failed transaction record for tracking
    await prisma.billingTransaction.create({
      data: {
        tenantId,
        type: 'TOP_UP',
        amount: parseFloat(amount),
        description: `Checkout session expired`,
        status: 'FAILED',
        reference: session.id,
      },
    });

    console.log(`Checkout session expired for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error handling checkout expiration:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { tenantId, amount } = paymentIntent.metadata || {};

  if (!tenantId || !amount) {
    return;
  }

  try {
    // Create a failed transaction record
    await prisma.billingTransaction.create({
      data: {
        tenantId,
        type: 'TOP_UP',
        amount: parseFloat(amount),
        description: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
        status: 'FAILED',
        reference: paymentIntent.id,
      },
    });

    console.log(`Payment failed for tenant ${tenantId}: ${paymentIntent.last_payment_error?.message}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

