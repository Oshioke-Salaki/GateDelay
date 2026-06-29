jest.mock('../models/Order');
jest.mock('ioredis');

describe('Trade Aggregator Service', () => {
  let mockRedis;
  let tradeAggregator;
  let Order;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    mockRedis = {
      multi: jest.fn().mockReturnThis(),
      hincrbyfloat: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
      publish: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({ volume: '100', lastPrice: '2000' }),
      zrange: jest.fn().mockResolvedValue(['2000:1:123', '2100:1:124'])
    };
    
    const Redis = require('ioredis');
    Redis.mockImplementation(() => mockRedis);
    
    tradeAggregator = require('../services/tradeAggregator');
    Order = require('../models/Order');
  });

  it('should update real-time stats in Redis', async () => {
    await tradeAggregator.updateRealTimeStats('ETH-USDT', '2000', '1.5');
    
    expect(mockRedis.multi).toHaveBeenCalled();
    expect(mockRedis.hincrbyfloat).toHaveBeenCalledWith('stats:24h:ETH-USDT', 'volume', '1.5');
    expect(mockRedis.hset).toHaveBeenCalledWith('stats:24h:ETH-USDT', 'lastPrice', '2000');
    expect(mockRedis.exec).toHaveBeenCalled();
    expect(mockRedis.publish).toHaveBeenCalled();
  });

  it('should get real-time stats including high/low', async () => {
    const stats = await tradeAggregator.getRealTimeStats('ETH-USDT');
    
    expect(stats.volume).toBe('100');
    expect(stats.lastPrice).toBe('2000');
    expect(stats.high24h).toBe('2100');
    expect(stats.low24h).toBe('2000');
  });

  it('should call MongoDB aggregate for historical trades', async () => {
    Order.aggregate.mockResolvedValue([{ _id: '2023-01-01', volume: 100 }]);
    
    const data = await tradeAggregator.aggregateHistoricalTrades('ETH-USDT', '1h', 10);
    
    expect(Order.aggregate).toHaveBeenCalled();
    expect(data[0].volume).toBe(100);
  });
});
