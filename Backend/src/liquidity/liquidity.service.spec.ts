import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { MarketResolverService } from '../markets/market-resolver.service';
import { LiquidityService } from './liquidity.service';

describe('LiquidityService', () => {
  let service: LiquidityService;
  let marketResolver: MarketResolverService;

  const cacheMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const baseMarket = {
    id: 'market-1',
    title: 'Flight delay over 2 hours',
    deadline: new Date('2030-01-01T00:00:00.000Z'),
    totalYesStake: 4_000_000_000_000_000_000n,
    totalNoStake: 2_000_000_000_000_000_000n,
    status: 'active' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheMock.get.mockResolvedValue(undefined);
    cacheMock.set.mockResolvedValue(undefined);
    cacheMock.del.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityService,
        MarketResolverService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheMock,
        },
      ],
    }).compile();

    service = module.get<LiquidityService>(LiquidityService);
    marketResolver = module.get<MarketResolverService>(MarketResolverService);
    marketResolver.registerMarket(baseMarket);
  });

  it('tracks LP positions and supports add/remove lifecycle', async () => {
    const position = await service.addLiquidity(
      'user-1',
      'market-1',
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      10,
      true,
      0.58,
    );

    expect(position.marketId).toBe('market-1');
    expect(position.autoManage).toBe(true);
    expect(position.targetYesRatio).toBe(0.58);
    expect(position.shares).toBeGreaterThan(0);

    const removal = await service.removeLiquidity('user-1', 'market-1', 3);
    expect(Number.parseFloat(removal.withdrawnEth)).toBeGreaterThan(0);
    expect(Number.parseFloat(removal.claimedFeesEth)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(removal.claimedRewardsEth)).toBeGreaterThanOrEqual(0);
  });

  it('accrues rewards and fees for open LP positions', async () => {
    await service.addLiquidity(
      'user-2',
      'market-1',
      '0x66f820a414680B5bcda5eECA5dea238543F42054',
      5,
    );

    const internals = service as unknown as {
      positions: Map<string, { lastAccrualAt: Date }>;
    };
    const key = 'user-2:market-1';
    const position = internals.positions.get(key);
    if (!position) {
      throw new Error('Expected test position to exist');
    }

    position.lastAccrualAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const positions = await service.getUserPositions('user-2');
    expect(positions).toHaveLength(1);
    expect(Number.parseFloat(positions[0].rewardsAccruedEth)).toBeGreaterThan(0);
    expect(Number.parseFloat(positions[0].feesAccruedEth)).toBeGreaterThan(0);
  });

  it('provides liquidity analytics and automation support', async () => {
    await service.addLiquidity(
      'user-3',
      'market-1',
      '0x66f820a414680B5bcda5eECA5dea238543F42054',
      8,
      true,
      0.2,
    );

    const result = await service.runAutomation('user-3');
    expect(result).toHaveLength(1);
    expect(['REBALANCED', 'SKIPPED']).toContain(result[0].action);

    const analytics = await service.getLiquidityAnalytics();
    expect(analytics.totalProviders).toBe(1);
    expect(analytics.totalTrackedMarkets).toBeGreaterThanOrEqual(1);
    expect(Number.parseFloat(analytics.totalLiquidityEth)).toBeGreaterThan(0);
    expect(analytics.marketBreakdown).toHaveLength(1);
  });

  it('rejects invalid wallet addresses', async () => {
    await expect(
      service.addLiquidity('user-4', 'market-1', 'not-an-address', 1),
    ).rejects.toThrow('Invalid wallet address');
  });
});
