export type RateLimitTier =
  | 'auth'
  | 'standard'
  | 'elevated'
  | 'webhook'
  | 'admin';

export interface TierConfig {
  limit: number;
  windowMs: number;
  message: string;
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, TierConfig> = {
  // Strict — login/register/forgot-password to prevent brute-force
  auth: {
    limit: 10,
    windowMs: 60_000,
    message: 'Too many authentication attempts. Please try again in a minute.',
  },
  // Default for most authenticated API endpoints
  standard: {
    limit: 100,
    windowMs: 60_000,
    message: 'Rate limit exceeded. Please slow down your requests.',
  },
  // Read-heavy or lightweight endpoints (market data, status checks)
  elevated: {
    limit: 300,
    windowMs: 60_000,
    message: 'Rate limit exceeded.',
  },
  // Inbound webhook calls
  webhook: {
    limit: 50,
    windowMs: 60_000,
    message: 'Webhook rate limit exceeded.',
  },
  // Admin / internal tools — generous but not unlimited
  admin: {
    limit: 500,
    windowMs: 60_000,
    message: 'Admin rate limit exceeded.',
  },
};

export const RATE_LIMIT_TIER_KEY = 'rateLimitTier';
