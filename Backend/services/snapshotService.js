const MarketSnapshot = require('../models/MarketSnapshot');
const analyticsService = require('./analyticsService');
const tradeEngine = require('./tradeEngine');
const mongoose = require('mongoose');

class SnapshotService {
  /**
   * Capture current market state for a pair
   */
  async captureSnapshot(pair) {
    try {
      const metrics = await analyticsService.getMarketMetrics(pair, 24);
      
      // Extract top 10 bids and asks from tradeEngine's in-memory orderbook
      const bids = (tradeEngine.orderBook.Buy || [])
        .filter(o => o.pair === pair)
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        .slice(0, 10)
        .map(o => ({ price: o.price, amount: o.amount }));

      const asks = (tradeEngine.orderBook.Sell || [])
        .filter(o => o.pair === pair)
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        .slice(0, 10)
        .map(o => ({ price: o.price, amount: o.amount }));

      const snapshot = new MarketSnapshot({
        pair,
        price: metrics.close,
        volume24h: metrics.volume,
        high24h: metrics.high,
        low24h: metrics.low,
        orderBook: { bids, asks }
      });

      await snapshot.save();
      return snapshot;
    } catch (error) {
      console.error(`Failed to capture snapshot for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve snapshots for a pair within a time range
   */
  async getSnapshots(pair, limit = 100, skip = 0) {
    return await MarketSnapshot.find({ pair })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Compare two snapshots to see price/volume changes
   */
  async compareSnapshots(snapshotId1, snapshotId2) {
    const [s1, s2] = await Promise.all([
      MarketSnapshot.findById(snapshotId1),
      MarketSnapshot.findById(snapshotId2)
    ]);

    if (!s1 || !s2) throw new Error('One or both snapshots not found');

    const priceChange = parseFloat(s2.price) - parseFloat(s1.price);
    const volumeChange = parseFloat(s2.volume24h) - parseFloat(s1.volume24h);

    return {
      pair: s1.pair,
      period: {
        from: s1.timestamp,
        to: s2.timestamp
      },
      price: {
        from: s1.price,
        to: s2.price,
        change: priceChange.toString(),
        changePercent: ((priceChange / parseFloat(s1.price)) * 100).toFixed(2)
      },
      volume: {
        from: s1.volume24h,
        to: s2.volume24h,
        change: volumeChange.toString()
      }
    };
  }

  /**
   * Cleanup old snapshots to prevent DB bloat
   * @param {number} daysToKeep - Number of days to retain snapshots
   */
  async cleanupSnapshots(daysToKeep = 30) {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await MarketSnapshot.deleteMany({
      timestamp: { $lt: cutoff }
    });
    return result.deletedCount;
  }
}

module.exports = new SnapshotService();
