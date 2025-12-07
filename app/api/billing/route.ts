import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth';

// GET /api/billing - Get billing overview and usage stats
export async function GET(request: NextRequest) {
  try {
    const { tenant } = await requireTenant(request);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Get current month's token usage aggregated by model
    const monthlyUsage = await prisma.tokenUsage.findMany({
      where: {
        tenantId: tenant.id,
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
    });

    // Aggregate by model
    const usageByModel: Record<string, { 
      model: string; 
      provider: string;
      promptTokens: number; 
      completionTokens: number;
      totalTokens: number;
      cost: number; 
      requestCount: number;
    }> = {};

    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    for (const usage of monthlyUsage) {
      if (!usageByModel[usage.model]) {
        usageByModel[usage.model] = {
          model: usage.model,
          provider: usage.provider,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          requestCount: 0,
        };
      }
      usageByModel[usage.model].promptTokens += usage.promptTokens;
      usageByModel[usage.model].completionTokens += usage.completionTokens;
      usageByModel[usage.model].totalTokens += usage.totalTokens;
      usageByModel[usage.model].cost += usage.cost;
      usageByModel[usage.model].requestCount += usage.requestCount;
      
      totalCost += usage.cost;
      totalTokens += usage.totalTokens;
      totalRequests += usage.requestCount;
    }

    // Aggregate by provider
    const usageByProvider: Record<string, {
      provider: string;
      totalTokens: number;
      cost: number;
      requestCount: number;
      models: string[];
    }> = {};

    for (const modelUsage of Object.values(usageByModel)) {
      if (!usageByProvider[modelUsage.provider]) {
        usageByProvider[modelUsage.provider] = {
          provider: modelUsage.provider,
          totalTokens: 0,
          cost: 0,
          requestCount: 0,
          models: [],
        };
      }
      usageByProvider[modelUsage.provider].totalTokens += modelUsage.totalTokens;
      usageByProvider[modelUsage.provider].cost += modelUsage.cost;
      usageByProvider[modelUsage.provider].requestCount += modelUsage.requestCount;
      if (!usageByProvider[modelUsage.provider].models.includes(modelUsage.model)) {
        usageByProvider[modelUsage.provider].models.push(modelUsage.model);
      }
    }

    // Get previous month stats for comparison
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthUsage = await prisma.tokenUsage.aggregate({
      where: {
        tenantId: tenant.id,
        date: {
          gte: firstDayOfLastMonth,
          lte: lastDayOfLastMonth,
        },
      },
      _sum: {
        cost: true,
        totalTokens: true,
        requestCount: true,
      },
    });

    const lastMonthCost = lastMonthUsage._sum.cost || 0;
    const lastMonthTokens = lastMonthUsage._sum.totalTokens || 0;
    const lastMonthRequests = lastMonthUsage._sum.requestCount || 0;

    // Calculate percentage changes
    const costChange = lastMonthCost > 0 
      ? ((totalCost - lastMonthCost) / lastMonthCost) * 100 
      : totalCost > 0 ? 100 : 0;
    
    const tokenChange = lastMonthTokens > 0 
      ? ((totalTokens - lastMonthTokens) / lastMonthTokens) * 100 
      : totalTokens > 0 ? 100 : 0;
    
    const requestChange = lastMonthRequests > 0 
      ? ((totalRequests - lastMonthRequests) / lastMonthRequests) * 100 
      : totalRequests > 0 ? 100 : 0;

    // Estimate end of month cost (based on daily average)
    const daysInMonth = lastDayOfMonth.getDate();
    const daysPassed = now.getDate();
    const estimatedMonthEnd = daysPassed > 0 
      ? (totalCost / daysPassed) * daysInMonth 
      : 0;

    // Get tenant balance
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { balance: true, totalSpent: true },
    });

    return NextResponse.json({
      balance: tenantData?.balance || 0,
      totalSpent: tenantData?.totalSpent || 0,
      currentMonth: {
        cost: totalCost,
        tokens: totalTokens,
        requests: totalRequests,
        costChange: Math.round(costChange),
        tokenChange: Math.round(tokenChange),
        requestChange: Math.round(requestChange),
        estimatedMonthEnd,
      },
      usageByModel: Object.values(usageByModel),
      usageByProvider: Object.values(usageByProvider),
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}


