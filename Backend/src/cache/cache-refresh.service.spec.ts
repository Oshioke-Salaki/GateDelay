import { CacheRefreshService } from './cache-refresh.service';
import { CacheService } from './cache.service';
import {
  CACHE_REFRESH_POLICY,
  CacheKeys,
  planCacheRefresh,
} from './cache-refresh.policy';
import { MarketResolverService } from '../markets/market-resolver.service';

describe('cache refresh policy', () => {
  it('evicts market lists and liquidity aggregates on resolution', () => {
    expect(
      planCacheRefresh({ type: 'market.resolved', marketId: 'm1' }),
    ).toEqual({
      keys: [CacheKeys.liquidityReport, CacheKeys.liquidityLpAnalytics],
      prefixes: [CacheKeys.marketsListPrefix],
    });
  });

  it('evicts market lists and liquidity aggregates on market updates', () => {
    const plan = planCacheRefresh({ type: 'market.updated', marketId: 'm1' });
    expect(plan.keys).toContain(CacheKeys.liquidityReport);
    expect(plan.prefixes).toContain(CacheKeys.marketsListPrefix);
  });

  it('evicts the tree and every category lookup on category changes', () => {
    const expected = {
      keys: [CacheKeys.categoryTree],
      prefixes: [CacheKeys.categoryMarketsPrefix],
    };
    expect(
      planCacheRefresh({
        type: 'market.category_changed',
        marketId: 'm1',
        categoryId: 'c2',
        previousCategoryId: 'c1',
      }),
    ).toEqual(expected);
    expect(
      planCacheRefresh({ type: 'category.updated', categoryId: 'c1' }),
    ).toEqual(expected);
  });

  it('evicts only the edited market plus search pages on metadata edits', () => {
    expect(
      planCacheRefresh({ type: 'market.metadata_edited', marketId: 'm1' }),
    ).toEqual({
      keys: [CacheKeys.metadata('m1'), CacheKeys.metadataVersions('m1')],
      prefixes: [CacheKeys.metadataSearchPrefix],
    });
  });

  it('keeps list keys under the prefixes that evict them', () => {
    expect(CacheKeys.marketsList(2, 20)).toMatch(
      new RegExp(`^${CacheKeys.marketsListPrefix}`),
    );
    expect(CacheKeys.categoryMarkets('c1', true)).toMatch(
      new RegExp(`^${CacheKeys.categoryMarketsPrefix}`),
    );
    expect(CacheKeys.metadataSearch({ query: 'x' })).toMatch(
      new RegExp(`^${CacheKeys.metadataSearchPrefix}`),
    );
  });
});

describe('CacheRefreshService', () => {
  let cache: { del: jest.Mock; invalidatePattern: jest.Mock };
  let service: CacheRefreshService;

  beforeEach(() => {
    cache = {
      del: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };
    service = new CacheRefreshService(cache as unknown as CacheService);
  });

  it('applies the plan for the event', async () => {
    await service.refresh({ type: 'market.metadata_edited', marketId: 'm1' });

    expect(cache.del).toHaveBeenCalledWith(CacheKeys.metadata('m1'));
    expect(cache.del).toHaveBeenCalledWith(CacheKeys.metadataVersions('m1'));
    expect(cache.invalidatePattern).toHaveBeenCalledWith(
      CacheKeys.metadataSearchPrefix,
    );
  });

  it('swallows eviction failures and still attempts the rest', async () => {
    cache.del.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      service.refresh({ type: 'market.resolved', marketId: 'm1' }),
    ).resolves.toBeUndefined();

    expect(cache.del).toHaveBeenCalledTimes(2);
    expect(cache.invalidatePattern).toHaveBeenCalledTimes(1);
    expect(service.describe().failedEvictions).toBe(1);
  });

  it('describes every policy event with trigger counts', async () => {
    await service.refresh({ type: 'category.updated', categoryId: 'c1' });

    const { events } = service.describe();
    expect(events.map((e) => e.type)).toEqual(
      Object.keys(CACHE_REFRESH_POLICY),
    );
    expect(events.find((e) => e.type === 'category.updated')?.triggered).toBe(
      1,
    );
  });
});

describe('MarketResolverService cache refresh', () => {
  const market = {
    id: 'm1',
    title: 'Flight delay over 2 hours',
    deadline: new Date('2030-01-01T00:00:00.000Z'),
    totalYesStake: 1n,
    totalNoStake: 1n,
    status: 'active' as const,
  };

  let refresh: jest.Mock;
  let resolver: MarketResolverService;

  beforeEach(() => {
    refresh = jest.fn().mockResolvedValue(undefined);
    resolver = new MarketResolverService({
      refresh,
    } as unknown as CacheRefreshService);
  });

  it('refreshes on register and update', () => {
    resolver.registerMarket(market);
    resolver.updateMarket('m1', { totalYesStake: 5n });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenNthCalledWith(2, {
      type: 'market.updated',
      marketId: 'm1',
    });
    expect(resolver.getMarket('m1')?.totalYesStake).toBe(5n);
  });

  it('does not refresh when updating an unknown market', () => {
    expect(resolver.updateMarket('missing', { title: 'x' })).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes after a successful resolution', async () => {
    resolver.registerMarket(market);
    refresh.mockClear();

    const event = await resolver.resolveMarket('m1');

    expect(event).not.toBeNull();
    expect(refresh).toHaveBeenCalledWith({
      type: 'market.resolved',
      marketId: 'm1',
    });
  });
});
