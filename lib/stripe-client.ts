import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

// Client-side Stripe instance (singleton pattern)
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Redirect to Stripe checkout using session URL
// Note: Modern Stripe Checkout uses URLs instead of redirectToCheckout
export async function redirectToCheckout(sessionUrl: string): Promise<void> {
  // For modern Stripe Checkout, we simply redirect to the session URL
  window.location.href = sessionUrl;
}

