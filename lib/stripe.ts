import Stripe from 'stripe';

// Lazy-initialized Stripe instance to avoid build-time errors
let _stripe: Stripe | null = null;

// Server-side Stripe instance (lazy initialization)
export function getStripeServer(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Top-up amount presets (in dollars)
export const TOP_UP_PRESETS = [10, 25, 50, 100, 250, 500] as const;

// Minimum and maximum top-up amounts (in dollars)
export const MIN_TOP_UP_AMOUNT = 5;
export const MAX_TOP_UP_AMOUNT = 10000;

// Convert dollars to cents for Stripe
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Convert cents to dollars
export function centsToDollars(cents: number): number {
  return cents / 100;
}

// Format amount for display
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Validate top-up amount
export function validateTopUpAmount(amount: number): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }
  if (amount < MIN_TOP_UP_AMOUNT) {
    return { valid: false, error: `Minimum top-up amount is ${formatAmount(MIN_TOP_UP_AMOUNT)}` };
  }
  if (amount > MAX_TOP_UP_AMOUNT) {
    return { valid: false, error: `Maximum top-up amount is ${formatAmount(MAX_TOP_UP_AMOUNT)}` };
  }
  return { valid: true };
}

