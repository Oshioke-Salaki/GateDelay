import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import {
  CACHE_REFRESH_POLICY,
  CacheRefreshEvent,
  CacheRefreshEventType,
  planCacheRefresh,
} from './cache-refresh.policy';

/**
 * Applies `CACHE_REFRESH_POLICY` after market-domain writes.
 *
 * Callers invoke `refresh()` once the write has committed. It never throws:
 * a cache outage must not turn a successful write into a failed request, and
 * the TTLs in the policy cap how long a missed eviction can serve stale data.
 */
@Injectable()
export class CacheRefreshService {
  private readonly logger = new Logger(CacheRefreshService.name);
  private readonly counts = new Map<CacheRefreshEventType, number>();
  private failures = 0;

  constructor(private readonly cache: CacheService) {}

  async refresh(event: CacheRefreshEvent): Promise<void> {
    this.counts.set(event.type, (this.counts.get(event.type) ?? 0) + 1);
    const { keys, prefixes } = planCacheRefresh(event);

    const results = await Promise.allSettled([
      ...keys.map((key) => this.cache.del(key)),
      ...prefixes.map((prefix) => this.cache.invalidatePattern(prefix)),
    ]);

    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length) {
      this.failures += failed.length;
      this.logger.warn(
        `Cache refresh for ${event.type} had ${failed.length} failed eviction(s): ` +
          failed.map((r) => String(r.reason)).join('; '),
      );
    }
  }

  /** Policy table plus per-event counters, for the cache admin endpoint. */
  describe() {
    return {
      events: Object.entries(CACHE_REFRESH_POLICY).map(([type, rule]) => ({
        type,
        description: rule.description,
        triggered: this.counts.get(type as CacheRefreshEventType) ?? 0,
      })),
      failedEvictions: this.failures,
    };
  }
}
