const Order = require('../models/Order');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const Big = require('big.js');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

class TradeAggregator {
  /**
   * Aggregate trades from MongoDB for a specific pair and interval
   * @param {string} pair - Trading pair
   * @param {string} interval - '1h', '1d', etc.
   * @param {number} limit - Number of buckets
   */
  async aggregateHistoricalTrades(pair, interval = '1h', limit = 24) {
    const format = this._getMongoDateFormat(interval);
    
    const pipeline = [
      {
        $match: {
          pair,
          status: { $in: ['Filled', 'Partial'] },
          filled: { $gt: '0' }
        }
      },
      {
        $addFields: {
          filledNum: { $toDouble: "$filled" },
          priceNum: { $toDouble: "$price" }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format, date: "$updatedAt" }
          },
          volume: { $sum: "$filledNum" },
          avgPrice: { $avg: "$priceNum" },
          high: { $max: "$priceNum" },
          low: { $min: "$priceNum" },
          count: { $sum: 1 },
          timestamp: { $first: "$updatedAt" }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: limit }
    ];

    return await Order.aggregate(pipeline);
  }

  /**
   * Update real-time statistics in Redis
   * @param {string} pair - Trading pair
   * @param {string} price - Execution price
   * @param {string} amount - Execution amount
   */
  async updateRealTimeStats(pair, price, amount) {
    const key = `stats:24h:${pair}`;
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Use Redis multi to update multiple fields atomically
    const multi = redis.multi();
    
    // Add volume
    multi.hincrbyfloat(key, 'volume', amount);
    // Set last price
    multi.hset(key, 'lastPrice', price);
    // Update high/low (requires lua script for atomicity, but simple hset for now)
    // We'll just store the raw data and let the getter handle high/low or use a sorted set
    
    // Store price in a sorted set for high/low over time
    const historyKey = `history:prices:${pair}`;
    multi.zadd(historyKey, timestamp, `${price}:${amount}:${timestamp}`);
    
    // Expire old price history (e.g., keep 24h)
    multi.zremrangebyscore(historyKey, 0, timestamp - 86400);
    
    await multi.exec();
    
    // Publish update for real-time subscribers
    await redis.publish(`trades:${pair}`, JSON.stringify({
      pair,
      price,
      amount,
      timestamp
    }));
  }

  /**
   * Collect trade data from external sources
   * @param {string} source - Source name (e.g., 'Binance', 'Chainlink')
   * @param {object} tradeData - Standardized trade data
   */
  async collectExternalTrades(source, tradeData) {
    const { pair, price, amount } = tradeData;
    console.log(`Collecting trade from ${source}: ${pair} ${amount}@${price}`);
    
    // For external trades, we might just want to update real-time stats
    // and maybe save to a separate collection if needed.
    await this.updateRealTimeStats(pair, price, amount);
    
    // Optionally log to a 'ExternalTrades' collection
    // await ExternalTrade.create({ source, ...tradeData });
  }

  /**
   * Get real-time stats from Redis
   */
  async getRealTimeStats(pair) {
    const stats = await redis.hgetall(`stats:24h:${pair}`);
    const historyKey = `history:prices:${pair}`;
    
    // Get high/low from sorted set
    const history = await redis.zrange(historyKey, 0, -1);
    const prices = history.map(h => parseFloat(h.split(':')[0]));
    
    if (prices.length > 0) {
      stats.high24h = Math.max(...prices).toString();
      stats.low24h = Math.min(...prices).toString();
    }

    return stats;
  }

  /**
   * Calculate summary statistics for a pair
   */
  async getTradeStatistics(pair) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const stats = await Order.aggregate([
      {
        $match: {
          pair,
          status: { $in: ['Filled', 'Partial'] },
          updatedAt: { $gte: oneDayAgo }
        }
      },
      {
        $group: {
          _id: "$pair",
          totalVolume: { $sum: { $toDouble: "$filled" } },
          avgTradeSize: { $avg: { $toDouble: "$filled" } },
          maxTradeSize: { $max: { $toDouble: "$filled" } },
          tradeCount: { $sum: 1 }
        }
      }
    ]);

    return stats[0] || {
      totalVolume: 0,
      avgTradeSize: 0,
      maxTradeSize: 0,
      tradeCount: 0
    };
  }

  _getMongoDateFormat(interval) {
    switch (interval) {
      case '1m': return "%Y-%m-%d %H:%M";
      case '5m': return "%Y-%m-%d %H:%M"; // Simplified
      case '1h': return "%Y-%m-%d %H:00";
      case '1d': return "%Y-%m-%d";
      default: return "%Y-%m-%d %H:00";
    }
  }
}

module.exports = new TradeAggregator();
