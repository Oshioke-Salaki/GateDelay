const analyticsService = require('../services/analyticsService');
const Order = require('../models/Order');
const mongoose = require('mongoose');

jest.mock('../models/Order');

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate market metrics correctly', async () => {
    const mockOrders = [
      { price: '100', amount: '1', status: 'Filled', updatedAt: new Date(Date.now() - 10000) },
      { price: '110', amount: '2', status: 'Filled', updatedAt: new Date(Date.now() - 5000) },
      { price: '105', amount: '1.5', status: 'Filled', updatedAt: new Date() }
    ];

    Order.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockOrders)
    });

    const metrics = await analyticsService.getMarketMetrics('ETH-USDT', 24);

    expect(metrics.pair).toBe('ETH-USDT');
    expect(metrics.volume).toBe('4.5');
    expect(metrics.high).toBe('110');
    expect(metrics.low).toBe('100');
    expect(metrics.close).toBe('105');
    expect(metrics.tradeCount).toBe(3);
  });

  it('should generate trend analysis', async () => {
    const mockOrders = Array(20).fill(0).map((_, i) => ({
      price: (100 + i).toString(),
      status: 'Filled',
      updatedAt: new Date()
    }));

    Order.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockOrders)
      })
    });

    const trends = await analyticsService.getTrendAnalysis('ETH-USDT');
    expect(trends.pair).toBe('ETH-USDT');
    expect(trends.sma10).toBeGreaterThan(0);
    expect(trends.trend).toBeDefined();
  });

  it('should export data in JSON format', async () => {
    Order.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([])
    });

    const data = await analyticsService.exportAnalyticsData('ETH-USDT', 'json');
    const parsed = JSON.parse(data);
    expect(parsed.pair).toBe('ETH-USDT');
    expect(parsed.metrics).toBeDefined();
    expect(parsed.history).toBeDefined();
  });
});
