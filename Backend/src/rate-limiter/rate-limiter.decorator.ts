import { SetMetadata } from '@nestjs/common';
import { RateLimitTier, RATE_LIMIT_TIER_KEY } from './rate-limiter.config';

export const RateLimit = (tier: RateLimitTier) =>
  SetMetadata(RATE_LIMIT_TIER_KEY, tier);
