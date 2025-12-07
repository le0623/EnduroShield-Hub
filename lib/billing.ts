import { prisma } from './prisma';

// OpenAI pricing per 1K tokens (as of 2024)
// https://openai.com/pricing
export const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0 },
  'text-embedding-ada-002': { prompt: 0.0001, completion: 0 },
};

// Default pricing for unknown models
const DEFAULT_PRICING = { prompt: 0.001, completion: 0.002 };

/**
 * Calculate cost based on token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  
  const promptCost = (promptTokens / 1000) * pricing.prompt;
  const completionCost = (completionTokens / 1000) * pricing.completion;
  
  return promptCost + completionCost;
}

/**
 * Track token usage for a tenant
 */
export async function trackTokenUsage(
  tenantId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  provider: string = 'OpenAI'
): Promise<{ cost: number; newBalance: number }> {
  const cost = calculateCost(model, promptTokens, completionTokens);
  const totalTokens = promptTokens + completionTokens;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update or create daily usage record
  await prisma.tokenUsage.upsert({
    where: {
      tenantId_date_model: {
        tenantId,
        date: today,
        model,
      },
    },
    update: {
      promptTokens: { increment: promptTokens },
      completionTokens: { increment: completionTokens },
      totalTokens: { increment: totalTokens },
      cost: { increment: cost },
      requestCount: { increment: 1 },
    },
    create: {
      tenantId,
      date: today,
      model,
      provider,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      requestCount: 1,
    },
  });

  // Deduct from tenant balance and update total spent
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      balance: { decrement: cost },
      totalSpent: { increment: cost },
    },
  });

  return { cost, newBalance: updatedTenant.balance };
}

/**
 * Check if tenant has sufficient balance
 */
export async function checkBalance(tenantId: string): Promise<{
  hasBalance: boolean;
  balance: number;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { balance: true },
  });

  const balance = tenant?.balance || 0;
  
  return {
    hasBalance: balance > 0,
    balance,
  };
}

/**
 * Get tenant's current balance
 */
export async function getBalance(tenantId: string): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { balance: true },
  });

  return tenant?.balance || 0;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(4)}`;
}


