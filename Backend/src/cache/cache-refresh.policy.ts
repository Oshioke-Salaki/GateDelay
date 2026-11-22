/**
 * Cache refresh policy for market-domain writes.
 *
 * Every cached read in the market domain is keyed through `CacheKeys`, and
 * every write that can make one of those reads stale emits a
 * `CacheRefreshEvent`. `CACHE_REFRESH_POLICY` is the single table mapping each
 * event to what it evicts, so "which caches does a resolution touch?" has one
 * answer instead of being scattered across services.
 *
 * Refresh semantics
 * -----------------
 * - Invalidate, don't rewrite. A write evicts the affected keys and the next
 *   read repopulates them from the source of truth. Rewriting in place would
 *   need the writer to know how every reader shapes its response.
 * - Evict after the write commits. Evicting first leaves a window where a
 *   concurrent read repopulates the old value; evicting after bounds staleness
 *   to the read that raced the write, and that is further bounded by the TTLs
 *   below.
 * - Best effort. A failed eviction is logged and swallowed; it must never fail
 *   the write that triggered it. The TTL is the backstop.
 * - Precise where the key is knowable, prefix where it isn't. Per-market keys
 *   are deleted exactly; lists and searches are keyed by their query, so the
 *   whole prefix goes.
 * - Multi-instance lag. Redis (L2) is shared, but each process keeps its own
 *   L1 map that another instance's eviction cannot reach. `CacheService` caps
 *   L1 entries at 30s, so peers converge within that window.
 */

/** Market-domain cache keys. Build keys only through these helpers. */
export const CacheKeys = {
  /** GET /api/markets pages — includes live price/volume, hence the short TTL. */
  marketsListPrefix: 'markets:list:',
  marketsList: (page: number, limit: number) => `markets:list:${page}:${limit}`,

  /** Full category tree, including each node's `marketIds`. */
  categoryTree: 'categories:tree',

  /** Market IDs resolved for a category (optionally with descendants). */
  categoryMarketsPrefix: 'categories:markets:',
  categoryMarkets: (categoryId: string, includeChildren: boolean) =>
    `categories:markets:${categoryId}:${includeChildren ? 'deep' : 'flat'}`,

  /** Latest active metadata version for one market. */
  metadata: (marketId: string) => `metadata:market:${marketId}`,
  /** Full version history for one market. */
  metadataVersions: (marketId: string) => `metadata:versions:${marketId}`,
  /** Metadata search results, keyed by the serialized search DTO. */
  metadataSearchPrefix: 'metadata:search:',
  metadataSearch: (query: unknown) =>
    `metadata:search:${JSON.stringify(query)}`,

  /** Owned by LiquidityService; both aggregate every market's stakes/status. */
  liquidityReport: 'liquidity:report',
  liquidityLpAnalytics: 'liquidity:lp-analytics',
} as const;

/** TTLs (ms) for the keys above. Short enough to cap staleness if an eviction is lost. */
export const CacheTtl = {
  marketsList: 15_000,
  categoryTree: 5 * 60_000,
  categoryMarkets: 60_000,
  metadata: 5 * 60_000,
  metadataSearch: 60_000,
} as const;

export type CacheRefreshEvent =
  /** A market was registered or its terms/stakes changed. */
  | { type: 'market.updated'; marketId: string }
  /** A market reached a terminal outcome. */
  | { type: 'market.resolved'; marketId: string }
  /** A market was assigned to (or moved between) categories. */
  | {
      type: 'market.category_changed';
      marketId: string;
      categoryId: string;
      previousCategoryId?: string;
    }
  /** A category was created, renamed, re-parented or deleted. */
  | { type: 'category.updated'; categoryId: string }
  /** Market metadata was created, versioned or deactivated. */
  | { type: 'market.metadata_edited'; marketId: string };

export type CacheRefreshEventType = CacheRefreshEvent['type'];

/** What a single event evicts: exact keys and key prefixes. */
export interface CacheRefreshPlan {
  keys: string[];
  prefixes: string[];
}

type PolicyRule<T extends CacheRefreshEventType> = {
  description: string;
  plan: (event: Extract<CacheRefreshEvent, { type: T }>) => CacheRefreshPlan;
};

export const CACHE_REFRESH_POLICY: {
  [T in CacheRefreshEventType]: PolicyRule<T>;
} = {
  'market.updated': {
    description:
      'Market list pages and liquidity aggregates reflect stakes and terms.',
    plan: () => ({
      keys: [CacheKeys.liquidityReport, CacheKeys.liquidityLpAnalytics],
      prefixes: [CacheKeys.marketsListPrefix],
    }),
  },
  'market.resolved': {
    description:
      'Resolution changes status/outcome: market list pages and liquidity ' +
      'aggregates (active count, depth, health) go stale.',
    plan: () => ({
      keys: [CacheKeys.liquidityReport, CacheKeys.liquidityLpAnalytics],
      prefixes: [CacheKeys.marketsListPrefix],
    }),
  },
  'market.category_changed': {
    description:
      'The tree embeds marketIds, and deep category lookups aggregate ' +
      'descendants, so every ancestor of both categories is affected — ' +
      'evict all category market lookups rather than walking the tree.',
    plan: () => ({
      keys: [CacheKeys.categoryTree],
      prefixes: [CacheKeys.categoryMarketsPrefix],
    }),
  },
  'category.updated': {
    description:
      'Structural changes re-shape the tree and re-home children, which ' +
      'changes which markets a deep lookup reaches.',
    plan: () => ({
      keys: [CacheKeys.categoryTree],
      prefixes: [CacheKeys.categoryMarketsPrefix],
    }),
  },
  'market.metadata_edited': {
    description:
      "The market's latest version and history change; any search page may " +
      'include it (or stop including it on deactivation / category change).',
    plan: (event) => ({
      keys: [
        CacheKeys.metadata(event.marketId),
        CacheKeys.metadataVersions(event.marketId),
      ],
      prefixes: [CacheKeys.metadataSearchPrefix],
    }),
  },
};

/** Resolve an event to its eviction plan. */
export function planCacheRefresh(event: CacheRefreshEvent): CacheRefreshPlan {
  // The mapped type can't correlate `event.type` with `event` across a union,
  // so widen the rule's parameter; the table itself is still checked per event.
  const rule = CACHE_REFRESH_POLICY[
    event.type
  ] as PolicyRule<CacheRefreshEventType>;
  return rule.plan(event);
}
