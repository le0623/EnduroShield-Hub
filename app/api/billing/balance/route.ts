import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth';

// GET /api/billing/balance - Get current balance
export async function GET(request: NextRequest) {
  try {
    const { tenant } = await requireTenant(request);

    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { balance: true, totalSpent: true },
    });

    return NextResponse.json({
      balance: tenantData?.balance || 0,
      totalSpent: tenantData?.totalSpent || 0,
      hasInsufficientBalance: (tenantData?.balance || 0) <= 0,
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}

// POST /api/billing/balance - Add credits (top-up)
export async function POST(request: NextRequest) {
  try {
    const { tenant } = await requireTenant(request);
    const body = await request.json();
    const { amount, reference } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Update balance
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        balance: { increment: amount },
      },
    });

    // Create transaction record
    await prisma.billingTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'TOP_UP',
        amount: amount,
        description: `Added $${amount.toFixed(2)} credits`,
        status: 'COMPLETED',
        reference: reference || null,
      },
    });

    return NextResponse.json({
      balance: updatedTenant.balance,
      message: `Successfully added $${amount.toFixed(2)} credits`,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return NextResponse.json(
      { error: 'Failed to add credits' },
      { status: 500 }
    );
  }
}


