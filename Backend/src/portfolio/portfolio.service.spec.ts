import type { PositionsService } from '../positions/positions.service';
import { PortfolioService } from './portfolio.service';

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
    const service = new PortfolioService(positionsService);

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
});
