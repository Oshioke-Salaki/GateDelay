const snapshotService = require('../services/snapshotService');
const MarketSnapshot = require('../models/MarketSnapshot');
const analyticsService = require('../services/analyticsService');
const tradeEngine = require('../services/tradeEngine');
const mongoose = require('mongoose');

jest.mock('../models/MarketSnapshot');
jest.mock('../services/analyticsService');
jest.mock('../services/tradeEngine');

describe('Snapshot Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should capture a market snapshot correctly', async () => {
    const pair = 'ETH-USDT';
    analyticsService.getMarketMetrics.mockResolvedValue({
      close: '2000',
      volume: '100',
      high: '2100',
      low: '1900'
    });

    tradeEngine.orderBook = {
      Buy: [{ pair, price: '1990', amount: '1' }],
      Sell: [{ pair, price: '2010', amount: '2' }]
    };

    MarketSnapshot.prototype.save = jest.fn().mockResolvedValue(true);

    const snapshot = await snapshotService.captureSnapshot(pair);

    expect(analyticsService.getMarketMetrics).toHaveBeenCalledWith(pair, 24);
    expect(MarketSnapshot).toHaveBeenCalled();
    // Verify snapshot fields were passed to constructor
    const callArgs = MarketSnapshot.mock.calls[0][0];
    expect(callArgs.pair).toBe(pair);
    expect(callArgs.price).toBe('2000');
    expect(callArgs.orderBook.bids[0].price).toBe('1990');
  });

  it('should compare two snapshots correctly', async () => {
    const s1 = {
      _id: 'id1',
      pair: 'ETH-USDT',
      price: '1000',
      volume24h: '100',
      timestamp: new Date('2023-01-01')
    };
    const s2 = {
      _id: 'id2',
      pair: 'ETH-USDT',
      price: '1100',
      volume24h: '150',
      timestamp: new Date('2023-01-02')
    };

    MarketSnapshot.findById = jest.fn()
      .mockImplementation((id) => Promise.resolve(id === 'id1' ? s1 : s2));

    const comparison = await snapshotService.compareSnapshots('id1', 'id2');

    expect(comparison.price.change).toBe('100');
    expect(comparison.price.changePercent).toBe('10.00');
    expect(comparison.volume.change).toBe('50');
  });

  it('should cleanup old snapshots', async () => {
    MarketSnapshot.deleteMany.mockResolvedValue({ deletedCount: 5 });

    const deleted = await snapshotService.cleanupSnapshots(30);

    expect(deleted).toBe(5);
    expect(MarketSnapshot.deleteMany).toHaveBeenCalled();
  });
});
