import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer, dollarsToCents, validateTopUpAmount } from '@/lib/stripe';
import { requireTenant } from '@/lib/auth';

// POST /api/billing/checkout - Create Stripe checkout session
export async function POST(request: NextRequest) {
  try {
    const { tenant, user } = await requireTenant(request);
    const body = await request.json();
    const { amount } = body;

    // Validate amount
    const validation = validateTopUpAmount(amount);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get the origin for redirect URLs (already includes subdomain, e.g., http://leonel.localhost:3000)
    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';

    // Create Stripe checkout session
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Account Balance Top-Up',
              description: `Add $${amount.toFixed(2)} credits to your account`,
            },
            unit_amount: dollarsToCents(amount),
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenantId: tenant.id,
        userId: user.id,
        amount: amount.toString(),
        type: 'TOP_UP',
      },
      success_url: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?canceled=true`,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

