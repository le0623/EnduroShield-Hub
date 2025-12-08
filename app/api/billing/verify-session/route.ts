import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth';

// POST /api/billing/verify-session - Verify and process a Stripe checkout session
export async function POST(request: NextRequest) {
  try {
    const { tenant } = await requireTenant(request);
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Use the session ID as the unique reference to prevent duplicates
    const reference = sessionId;

    // First, check if this session has already been processed (quick check before hitting Stripe)
    const existingTransaction = await prisma.billingTransaction.findFirst({
      where: {
        tenantId: tenant.id,
        reference: reference,
        status: 'COMPLETED',
      },
    });

    if (existingTransaction) {
      // Already processed, return current balance
      const tenantData = await prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { balance: true },
      });

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        balance: tenantData?.balance || 0,
        amount: existingTransaction.amount,
        message: 'Payment was already processed',
      });
    }

    // Retrieve the checkout session from Stripe
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to this tenant
    if (session.metadata?.tenantId !== tenant.id) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed', status: session.payment_status },
        { status: 400 }
      );
    }

    const amount = parseFloat(session.metadata?.amount || '0');

    // Use a transaction to atomically create the record and update balance
    // This prevents race conditions where two requests process the same session
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Double-check inside transaction (with row-level lock effectively)
        const existingInTx = await tx.billingTransaction.findFirst({
          where: {
            tenantId: tenant.id,
            reference: reference,
          },
        });

        if (existingInTx) {
          // Already exists, return null to indicate no new processing needed
          return null;
        }

        // Create the transaction record first (this will fail if duplicate due to race)
        await tx.billingTransaction.create({
          data: {
            tenantId: tenant.id,
            type: 'TOP_UP',
            amount: amount,
            description: `Added $${amount.toFixed(2)} credits via Stripe`,
            status: 'COMPLETED',
            reference: reference,
          },
        });

        // Only update balance after successful transaction record creation
        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            balance: { increment: amount },
          },
        });

        return updatedTenant;
      });

      if (result === null) {
        // Transaction was already processed (found in double-check)
        const tenantData = await prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: { balance: true },
        });

        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          balance: tenantData?.balance || 0,
          amount: amount,
          message: 'Payment was already processed',
        });
      }

      return NextResponse.json({
        success: true,
        alreadyProcessed: false,
        balance: result.balance,
        amount: amount,
        message: `Successfully added $${amount.toFixed(2)} credits`,
      });
    } catch (txError: any) {
      // Handle unique constraint violation (race condition where another request won)
      if (txError?.code === 'P2002') {
        const tenantData = await prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: { balance: true },
        });

        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          balance: tenantData?.balance || 0,
          amount: amount,
          message: 'Payment was already processed',
        });
      }
      throw txError;
    }
  } catch (error) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment session' },
      { status: 500 }
    );
  }
}
