import { Injectable, Logger } from '@nestjs/common';

export interface SlidingWindowResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // key → sorted list of request timestamps (ms)
  private readonly windows = new Map<string, number[]>();

  // Scheduled sweep runs every 5 minutes to evict expired entries
  private readonly sweepIntervalMs = 300_000;

  constructor() {
    setInterval(() => this.sweep(), this.sweepIntervalMs).unref();
  }

  check(key: string, limit: number, windowMs: number): SlidingWindowResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.windows.get(key) ?? [];

    // Evict timestamps that have fallen outside the current window
    timestamps = timestamps.filter((t) => t > windowStart);

    const count = timestamps.length;
    const resetAt = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

    if (count >= limit) {
      const oldestInWindow = timestamps[0];
      const retryAfterMs = oldestInWindow + windowMs - now;

      this.windows.set(key, timestamps);

      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(retryAfterMs, 0),
      };
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);

    return {
      allowed: true,
      limit,
      remaining: limit - timestamps.length,
      resetAt,
      retryAfterMs: 0,
    };
  }

  resetKey(key: string): void {
    this.windows.delete(key);
  }

  getKeyStats(key: string, windowMs: number): { count: number; oldestMs: number | null } {
    const now = Date.now();
    const timestamps = (this.windows.get(key) ?? []).filter(
      (t) => t > now - windowMs,
    );
    return {
      count: timestamps.length,
      oldestMs: timestamps.length > 0 ? timestamps[0] : null,
    };
  }

  private sweep(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, timestamps] of this.windows) {
      // Use the largest plausible window (1 hour) as the sweep horizon
      const active = timestamps.filter((t) => t > now - 3_600_000);
      if (active.length === 0) {
        this.windows.delete(key);
        evicted++;
      } else {
        this.windows.set(key, active);
      }
    }

    if (evicted > 0) {
      this.logger.debug(`Swept ${evicted} expired rate-limit buckets`);
    }
  }
}
