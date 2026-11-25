import type { PositionsService } from '../positions/positions.service';
import type { CacheService } from '../cache/cache.service';
import { PortfolioService } from './portfolio.service';
import { PortfolioSnapshotScheduler } from './portfolio-snapshot.scheduler';
import { CacheKeys, CacheTtl } from '../cache/cache-refresh.policy';

function makeCache(): jest.Mocked<Pick<CacheService, 'get' | 'set' | 'del'>> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSnapshotModel(docs: object[] = []) {
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  };
  return {
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockReturnValue(query),
    _query: query,
  };
}

describe('PortfolioService', () => {
  it('recalculates account totals from the latest position state', async () => {
    const positions = [
      { marketId: '4', status: 'open', costBasis: '2', pnl: '0.5', realizedPnl: '0' },
    ];
    const positionsService = {
      getUserPositions: jest.fn(async () => positions),
      getUsersWithPositions: jest.fn(async () => []),
    } as unknown as PositionsService;
    const service = new PortfolioService(
      positionsService,
      makeCache() as unknown as CacheService,
      makeSnapshotModel() as any,
    );

    expect(await service.getPortfolio('user-1')).toMatchObject({
      totalCost: '2.000000000000000000',
      totalPnl: '0.500000000000000000',
      openCount: 1,
    });
  });

  describe('cache behaviour', () => {
    const positions = [{ marketId: '1', status: 'open', costBasis: '1', pnl: '0', realizedPnl: '0' }];
    const positionsService = {
      getUserPositions: jest.fn(async () => positions),
      getUsersWithPositions: jest.fn(async () => []),
    } as unknown as PositionsService;

    it('returns cached result on cache hit and skips recalculation', async () => {
      const cached = { totalCost: '1', totalPnl: '0', totalPnlPct: '0', openCount: 1, closedCount: 0, byMarket: {} };
      const cache = makeCache();
      cache.get.mockResolvedValue(cached as any);
      const service = new PortfolioService(
        positionsService,
        cache as unknown as CacheService,
        makeSnapshotModel() as any,
      );

      const result = await service.getPortfolio('user-1');

      expect(result).toBe(cached);
      expect((positionsService.getUserPositions as jest.Mock)).not.toHaveBeenCalled();
    });

    it('populates the cache on a miss', async () => {
      const cache = makeCache();
      const service = new PortfolioService(
        positionsService,
        cache as unknown as CacheService,
        makeSnapshotModel() as any,
      );

      await service.getPortfolio('user-2');

      expect(cache.set).toHaveBeenCalledWith(
        CacheKeys.portfolio('user-2'),
        expect.objectContaining({ totalCost: expect.any(String) }),
        CacheTtl.portfolio,
      );
    });

    it('invalidate() deletes the portfolio cache key for the user', async () => {
      const cache = makeCache();
      const service = new PortfolioService(
        positionsService,
        cache as unknown as CacheService,
        makeSnapshotModel() as any,
      );

      await service.invalidate('user-3');

      expect(cache.del).toHaveBeenCalledWith(CacheKeys.portfolio('user-3'));
    });
  });

  describe('snapshot persistence', () => {
    const positions = [{ marketId: '1', status: 'open', costBasis: '1', pnl: '0.1', realizedPnl: '0' }];
    const positionsService = {
      getUserPositions: jest.fn(async () => positions),
      getUsersWithPositions: jest.fn(async () => ['user-1', 'user-2']),
    } as unknown as PositionsService;

    it('recordSnapshot persists a document to the database', async () => {
      const model = makeSnapshotModel();
      const service = new PortfolioService(
        positionsService,
        makeCache() as unknown as CacheService,
        model as any,
      );

      await service.recordSnapshot('user-1');

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          totalCost: expect.any(String),
          totalPnl: expect.any(String),
          totalPnlPct: expect.any(String),
          timestamp: expect.any(Date),
        }),
      );
    });

    it('getHistory queries the database sorted by timestamp descending', async () => {
      const stored = [
        { userId: 'user-1', timestamp: new Date(), totalCost: '1', totalPnl: '0.1', totalPnlPct: '10' },
      ];
      const model = makeSnapshotModel(stored);
      const service = new PortfolioService(
        positionsService,
        makeCache() as unknown as CacheService,
        model as any,
      );

      const history = await service.getHistory('user-1');

      expect(model.find).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(model._query.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(history).toEqual(stored);
    });

    it('getHistory respects the limit parameter', async () => {
      const model = makeSnapshotModel();
      const service = new PortfolioService(
        positionsService,
        makeCache() as unknown as CacheService,
        model as any,
      );

      await service.getHistory('user-1', 50);

      expect(model._query.limit).toHaveBeenCalledWith(50);
    });
  });
});

describe('PortfolioSnapshotScheduler', () => {
  it('captureHourlySnapshots records a snapshot for every active user', async () => {
    const recordSnapshot = jest.fn().mockResolvedValue(undefined);
    const getActiveUserIds = jest.fn().mockResolvedValue(['u1', 'u2', 'u3']);
    const service = { recordSnapshot, getActiveUserIds } as unknown as PortfolioService;
    const scheduler = new PortfolioSnapshotScheduler(service);

    await scheduler.captureHourlySnapshots();

    expect(getActiveUserIds).toHaveBeenCalledTimes(1);
    expect(recordSnapshot).toHaveBeenCalledTimes(3);
    expect(recordSnapshot).toHaveBeenCalledWith('u1');
    expect(recordSnapshot).toHaveBeenCalledWith('u2');
    expect(recordSnapshot).toHaveBeenCalledWith('u3');
  });

  it('captureHourlySnapshots is a no-op when there are no active users', async () => {
    const recordSnapshot = jest.fn();
    const getActiveUserIds = jest.fn().mockResolvedValue([]);
    const service = { recordSnapshot, getActiveUserIds } as unknown as PortfolioService;
    const scheduler = new PortfolioSnapshotScheduler(service);

    await scheduler.captureHourlySnapshots();

    expect(recordSnapshot).not.toHaveBeenCalled();
  });

  it('captureHourlySnapshots continues when one user snapshot fails', async () => {
    const recordSnapshot = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce(undefined);
    const getActiveUserIds = jest.fn().mockResolvedValue(['u1', 'u2', 'u3']);
    const service = { recordSnapshot, getActiveUserIds } as unknown as PortfolioService;
    const scheduler = new PortfolioSnapshotScheduler(service);

    await expect(scheduler.captureHourlySnapshots()).resolves.not.toThrow();
    expect(recordSnapshot).toHaveBeenCalledTimes(3);
  });
});
