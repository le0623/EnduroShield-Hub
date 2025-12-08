import { prisma } from './prisma';
import { requireTenant, getCurrentUser } from './auth';

// Billing data types
export interface BillingOverview {
  balance: number;
  totalSpent: number;
  currentMonth: {
    cost: number;
    tokens: number;
    requests: number;
    costChange: number;
    tokenChange: number;
    requestChange: number;
    estimatedMonthEnd: number;
  };
  usageByModel: Array<{
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    requestCount: number;
  }>;
  usageByProvider: Array<{
    provider: string;
    totalTokens: number;
    cost: number;
    requestCount: number;
    models: string[];
  }>;
}

export interface BillingHistory {
  transactions: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    amount: number;
    status: string;
    reference: string | null;
    date: string;
    formattedDate: string;
  }>;
  monthlyUsage: Array<{
    month: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

export interface Balance {
  balance: number;
  totalSpent: number;
  hasInsufficientBalance: boolean;
}

// API Client functions for data fetching
export const api = {
  // User related queries
  async getCurrentUser() {
    return await getCurrentUser();
  },

  // Tenant related queries
  async getCurrentTenant() {
    const { tenant } = await requireTenant();
    return tenant;
  },

  async getTenantUsers() {
    const { tenant } = await requireTenant();
    
    const users = await prisma.user.findMany({
      where: {
        tenants: {
          some: {
            tenantId: tenant.id,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        createdAt: true,
        tenants: {
          where: {
            tenantId: tenant.id,
          },
          select: {
            role: true,
            isOwner: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(user => ({
      ...user,
      role: user.tenants[0]?.role,
      isOwner: user.tenants[0]?.isOwner,
    }));
  },

  async getUserStats() {
    const { tenant } = await requireTenant();
    
    const userCount = await prisma.tenantMember.count({
      where: {
        tenantId: tenant.id,
      },
    });

    const recentUsers = await prisma.tenantMember.count({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    return {
      totalUsers: userCount,
      recentUsers,
    };
  },

  // Example: Add more API functions as needed
  async getDashboardData() {
    const { user, tenant } = await requireTenant();
    const userStats = await this.getUserStats();

    return {
      user,
      tenant,
      stats: userStats,
    };
  },

  // Billing related queries (client-side fetch)
  async getBillingOverview(): Promise<BillingOverview> {
    const response = await fetch('/api/billing');
    if (!response.ok) {
      throw new Error('Failed to fetch billing data');
    }
    return response.json();
  },

  async getBillingHistory(): Promise<BillingHistory> {
    const response = await fetch('/api/billing/history');
    if (!response.ok) {
      throw new Error('Failed to fetch billing history');
    }
    return response.json();
  },

  async getBalance(): Promise<Balance> {
    const response = await fetch('/api/billing/balance');
    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }
    return response.json();
  },

  async addCredits(amount: number, reference?: string): Promise<{ balance: number; message: string }> {
    const response = await fetch('/api/billing/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reference }),
    });
    if (!response.ok) {
      throw new Error('Failed to add credits');
    }
    return response.json();
  },

  async createCheckoutSession(amount: number): Promise<{ sessionId: string; url: string }> {
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create checkout session');
    }
    return response.json();
  },
};
