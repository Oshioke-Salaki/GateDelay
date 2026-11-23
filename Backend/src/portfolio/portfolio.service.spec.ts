import type { PositionsService } from '../positions/positions.service';
import type { CacheService } from '../cache/cache.service';
import { PortfolioService } from './portfolio.service';
import { CacheKeys, CacheTtl } from '../cache/cache-refresh.policy';

function makeCache(): jest.Mocked<Pick<CacheService, 'get' | 'set' | 'del'>> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PortfolioService', () => {
  it('recalculates account totals from the latest position state', async () => {
    const positions = [
      {
        marketId: '4',
        status: 'open',
        costBasis: '2',
        pnl: '0.5',
        realizedPnl: '0',
      },
    ];
    const positionsService = {
      getUserPositions: jest.fn(async () => positions),
    } as unknown as PositionsService;
    const service = new PortfolioService(positionsService, makeCache() as unknown as CacheService);

    expect(await service.getPortfolio('user-1')).toMatchObject({
      totalCost: '2.000000000000000000',
      totalPnl: '0.500000000000000000',
      openCount: 1,
    });

    positions[0] = {
      marketId: '4',
      status: 'closed',
      costBasis: '0',
      pnl: '0',
      realizedPnl: '0.25',
    };

    expect(await service.getPortfolio('user-1')).toMatchObject({
      totalCost: '0.000000000000000000',
      totalPnl: '0.250000000000000000',
      openCount: 0,
      closedCount: 1,
    });
  });

  describe('cache behaviour', () => {
    const positions = [{ marketId: '1', status: 'open', costBasis: '1', pnl: '0', realizedPnl: '0' }];
    const positionsService = {
      getUserPositions: jest.fn(async () => positions),
    } as unknown as PositionsService;

    it('returns cached result on cache hit and skips recalculation', async () => {
      const cached = { totalCost: '1', totalPnl: '0', totalPnlPct: '0', openCount: 1, closedCount: 0, byMarket: {} };
      const cache = makeCache();
      cache.get.mockResolvedValue(cached as any);
      const service = new PortfolioService(positionsService, cache as unknown as CacheService);

      const result = await service.getPortfolio('user-1');

      expect(result).toBe(cached);
      expect((positionsService.getUserPositions as jest.Mock)).not.toHaveBeenCalled();
    });

    it('populates the cache on a miss', async () => {
      const cache = makeCache();
      const service = new PortfolioService(positionsService, cache as unknown as CacheService);

      await service.getPortfolio('user-2');

      expect(cache.set).toHaveBeenCalledWith(
        CacheKeys.portfolio('user-2'),
        expect.objectContaining({ totalCost: expect.any(String) }),
        CacheTtl.portfolio,
      );
    });

    it('invalidate() deletes the portfolio cache key for the user', async () => {
      const cache = makeCache();
      const service = new PortfolioService(positionsService, cache as unknown as CacheService);

      await service.invalidate('user-3');

      expect(cache.del).toHaveBeenCalledWith(CacheKeys.portfolio('user-3'));
    });
  });
});
