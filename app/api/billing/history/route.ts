import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth';

// GET /api/billing/history - Get billing transaction history
export async function GET(request: NextRequest) {
  try {
    const { tenant } = await requireTenant(request);

    // Get recent transactions
    const transactions = await prisma.billingTransaction.findMany({
      where: {
        tenantId: tenant.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Format as invoices/history items
    const history = transactions.map((tx, index) => ({
      id: tx.id,
      name: tx.type === 'TOP_UP' 
        ? `Credit Top-up` 
        : tx.type === 'CHARGE'
        ? `Usage Charge`
        : tx.type === 'REFUND'
        ? `Refund`
        : `Adjustment`,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      reference: tx.reference,
      date: tx.createdAt.toISOString(),
      formattedDate: tx.createdAt.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      }),
    }));

    // Get monthly usage history for the last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyUsage = await prisma.tokenUsage.groupBy({
      by: ['date'],
      where: {
        tenantId: tenant.id,
        date: {
          gte: sixMonthsAgo,
        },
      },
      _sum: {
        cost: true,
        totalTokens: true,
        requestCount: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Aggregate by month
    const usageByMonth: Record<string, { 
      month: string; 
      cost: number; 
      tokens: number; 
      requests: number;
    }> = {};

    for (const usage of monthlyUsage) {
      const monthKey = new Date(usage.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (!usageByMonth[monthKey]) {
        usageByMonth[monthKey] = {
          month: monthKey,
          cost: 0,
          tokens: 0,
          requests: 0,
        };
      }
      usageByMonth[monthKey].cost += usage._sum.cost || 0;
      usageByMonth[monthKey].tokens += usage._sum.totalTokens || 0;
      usageByMonth[monthKey].requests += usage._sum.requestCount || 0;
    }

    return NextResponse.json({
      transactions: history,
      monthlyUsage: Object.values(usageByMonth),
    });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing history' },
      { status: 500 }
    );
  }
}


