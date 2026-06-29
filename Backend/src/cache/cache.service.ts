import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

interface L1Entry {
  value: unknown;
  expiresAt: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  l1Hits: number;
  l2Hits: number;
  sets: number;
  invalidations: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly l1: Map<string, L1Entry> = new Map();
  private readonly l1MaxSize = 500;
  private readonly l1DefaultTtl = 30_000; // 30s in ms

  private readonly metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    sets: 0,
    invalidations: 0,
  };

  constructor(@Inject(CACHE_MANAGER) private readonly redis: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    // L1 check
    const l1Entry = this.l1.get(key);
    if (l1Entry) {
      if (Date.now() < l1Entry.expiresAt) {
        this.metrics.hits++;
        this.metrics.l1Hits++;
        return l1Entry.value as T;
      }
      this.l1.delete(key);
    }

    // L2 (Redis) check
    const value = await this.redis.get<T>(key);
    if (value !== null && value !== undefined) {
      this.metrics.hits++;
      this.metrics.l2Hits++;
      this.setL1(key, value, this.l1DefaultTtl);
      return value;
    }

    this.metrics.misses++;
    return null;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.metrics.sets++;
    this.setL1(key, value, Math.min(ttlMs, this.l1DefaultTtl));
    await this.redis.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    this.metrics.invalidations++;
    this.l1.delete(key);
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate L1 keys matching prefix pattern
    for (const key of this.l1.keys()) {
      if (key.startsWith(pattern)) {
        this.l1.delete(key);
        this.metrics.invalidations++;
      }
    }
    // Redis key-scan based invalidation
    try {
      const store = (this.redis as any).store;
      const client = store?.client ?? store?.getClient?.();
      if (client?.scan) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await client.scan(
            cursor,
            'MATCH',
            `*${pattern}*`,
            'COUNT',
            100,
          );
          cursor = nextCursor;
          if (keys.length) {
            await client.del(...keys);
            this.metrics.invalidations += keys.length;
          }
        } while (cursor !== '0');
      }
    } catch (err) {
      this.logger.warn(`Pattern invalidation failed for "${pattern}": ${err}`);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  async warm(entries: Array<{ key: string; factory: () => Promise<unknown>; ttlMs: number }>) {
    this.logger.log(`Warming ${entries.length} cache entries...`);
    await Promise.allSettled(
      entries.map(({ key, factory, ttlMs }) =>
        factory()
          .then((v) => this.set(key, v, ttlMs))
          .catch((err) => this.logger.warn(`Warm failed for ${key}: ${err}`)),
      ),
    );
    this.logger.log('Cache warming complete');
  }

  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? ((this.metrics.hits / total) * 100).toFixed(2) + '%' : '0%',
      l1Size: this.l1.size,
    };
  }

  private setL1(key: string, value: unknown, ttlMs: number) {
    if (this.l1.size >= this.l1MaxSize) {
      // Evict oldest entry
      const firstKey = this.l1.keys().next().value;
      if (firstKey) this.l1.delete(firstKey);
    }
    this.l1.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
