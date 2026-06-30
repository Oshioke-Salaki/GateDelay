const mongoose = require('mongoose');
const Big = require('big.js');
const Order = require('../models/Order');
const Balance = require('../models/Balance');
const PriceHistory = require('../models/PriceHistory');

/**
 * MARKET SANITY CHECKER SERVICE
 * Automated sanity checks for market operations
 * Detects anomalies, validates states, and monitors for manipulation
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const SANITY_CONFIG = {
  PRICE_SPIKE_THRESHOLD: 20, // 20% price change triggers alert
  VOLUME_SPIKE_THRESHOLD: 500, // 500% volume increase triggers alert
  MIN_LIQUIDITY_DEPTH: 5, // Minimum orders in book
  WASH_TRADE_WINDOW_MS: 60000, // 1 minute window for wash trade detection
  WASH_TRADE_THRESHOLD: 3, // Same user buy/sell count threshold
  MANIPULATION_SCORE_THRESHOLD: 70, // 0-100 score, 70+ flags suspicious
  ORDER_CONCENTRATION_THRESHOLD: 0.3, // Single user > 30% of orders is suspicious
  SPREAD_ANOMALY_THRESHOLD: 0.1, // 10% spread is abnormal
};

// ─── Health Check Results Store ──────────────────────────────────────────────

const healthReports = [];
const MAX_REPORTS = 1000;
const alerts = [];
const MAX_ALERTS = 500;

function storeReport(report) {
  healthReports.push({ ...report, timestamp: new Date() });
  if (healthReports.length > MAX_REPORTS) {
    healthReports.shift();
  }
}

function storeAlert(alert) {
  alerts.push({ ...alert, timestamp: new Date() });
  if (alerts.length > MAX_ALERTS) {
    alerts.shift();
  }
  console.warn('[SANITY ALERT]', alert.message, alert);
}

// ─── Market Parameter Validation ─────────────────────────────────────────────

/**
 * Validate market parameters and state
 */
async function validateMarketState(pair) {
  const issues = [];
  const warnings = [];

  try {
    // Check order book depth
    const [buyOrders, sellOrders] = await Promise.all([
      Order.countDocuments({ pair, side: 'Buy', status: { $in: ['Pending', 'Partial'] } }),
      Order.countDocuments({ pair, side: 'Sell', status: { $in: ['Pending', 'Partial'] } }),
    ]);

    if (buyOrders < SANITY_CONFIG.MIN_LIQUIDITY_DEPTH) {
      issues.push({
        type: 'liquidity',
        severity: 'high',
        message: `Low buy-side liquidity: ${buyOrders} orders`,
        value: buyOrders,
      });
    }

    if (sellOrders < SANITY_CONFIG.MIN_LIQUIDITY_DEPTH) {
      issues.push({
        type: 'liquidity',
        severity: 'high',
        message: `Low sell-side liquidity: ${sellOrders} orders`,
        value: sellOrders,
      });
    }

    // Check spread
    const [lowestAsk, highestBid] = await Promise.all([
      Order.findOne({ pair, side: 'Sell', status: { $in: ['Pending', 'Partial'] } })
        .sort({ price: 1 })
        .select('price')
        .lean(),
      Order.findOne({ pair, side: 'Buy', status: { $in: ['Pending', 'Partial'] } })
        .sort({ price: -1 })
        .select('price')
        .lean(),
    ]);

    if (lowestAsk && highestBid) {
      const askBig = new Big(lowestAsk.price);
      const bidBig = new Big(highestBid.price);
      const spread = askBig.minus(bidBig).div(bidBig);

      if (spread.gt(SANITY_CONFIG.SPREAD_ANOMALY_THRESHOLD)) {
        warnings.push({
          type: 'spread',
          severity: 'medium',
          message: `Abnormal spread detected: ${spread.times(100).toFixed(2)}%`,
          value: spread.toString(),
        });
      }
    }

    // Check for locked orders (orders pending for too long)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleOrders = await Order.countDocuments({
      pair,
      status: 'Partial',
      timestamp: { $lt: oneDayAgo },
    });

    if (staleOrders > 0) {
      warnings.push({
        type: 'stale_orders',
        severity: 'low',
        message: `Found ${staleOrders} stale partial orders`,
        value: staleOrders,
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      stats: {
        buyOrders,
        sellOrders,
        staleOrders,
      },
    };
  } catch (err) {
    return {
      valid: false,
      issues: [{ type: 'error', severity: 'critical', message: err.message }],
      warnings: [],
    };
  }
}

// ─── Anomaly Detection ───────────────────────────────────────────────────────

/**
 * Detect anomalous trading patterns
 */
async function detectAnomalousPatterns(pair, timeWindowMs = 3600000) {
  const anomalies = [];
  const startTime = new Date(Date.now() - timeWindowMs);

  try {
    // Get recent trades
    const recentTrades = await Order.find({
      pair,
      status: 'Filled',
      timestamp: { $gte: startTime },
    })
      .sort({ timestamp: -1 })
      .lean();

    if (recentTrades.length === 0) {
      return { anomalies, stats: { tradeCount: 0 } };
    }

    // 1. Detect price spikes
    const priceAnomaly = detectPriceAnomaly(recentTrades);
    if (priceAnomaly) {
      anomalies.push(priceAnomaly);
    }

    // 2. Detect volume spikes
    const volumeAnomaly = detectVolumeAnomaly(recentTrades, pair);
    if (volumeAnomaly) {
      anomalies.push(volumeAnomaly);
    }

    // 3. Detect order concentration
    const concentrationAnomaly = detectOrderConcentration(recentTrades);
    if (concentrationAnomaly) {
      anomalies.push(concentrationAnomaly);
    }

    // 4. Detect rapid order cancellations
    const cancellationAnomaly = await detectSuspiciousCancellations(pair, startTime);
    if (cancellationAnomaly) {
      anomalies.push(cancellationAnomaly);
    }

    return {
      anomalies,
      stats: {
        tradeCount: recentTrades.length,
        timeWindow: timeWindowMs,
        anomalyCount: anomalies.length,
      },
    };
  } catch (err) {
    return {
      anomalies: [{ type: 'error', severity: 'high', message: err.message }],
      stats: {},
    };
  }
}

function detectPriceAnomaly(trades) {
  if (trades.length < 2) return null;

  const prices = trades.map((t) => new Big(t.price));
  const minPrice = prices.reduce((min, p) => (p.lt(min) ? p : min));
  const maxPrice = prices.reduce((max, p) => (p.gt(max) ? p : max));

  const priceChange = maxPrice.minus(minPrice).div(minPrice).times(100);

  if (priceChange.gt(SANITY_CONFIG.PRICE_SPIKE_THRESHOLD)) {
    return {
      type: 'price_spike',
      severity: 'high',
      message: `Abnormal price movement: ${priceChange.toFixed(2)}% change`,
      value: priceChange.toString(),
      minPrice: minPrice.toString(),
      maxPrice: maxPrice.toString(),
    };
  }

  return null;
}

async function detectVolumeAnomaly(recentTrades, pair) {
  // Compare recent volume to historical average
  try {
    const recentVolume = recentTrades.reduce(
      (sum, t) => sum.plus(new Big(t.amount)),
      new Big(0)
    );

    const historicalAvg = await getHistoricalAverageVolume(pair);

    if (historicalAvg && recentVolume.gt(historicalAvg.times(SANITY_CONFIG.VOLUME_SPIKE_THRESHOLD / 100))) {
      return {
        type: 'volume_spike',
        severity: 'medium',
        message: `Abnormal volume spike detected`,
        recentVolume: recentVolume.toString(),
        historicalAverage: historicalAvg.toString(),
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

function detectOrderConcentration(trades) {
  const userCounts = {};

  trades.forEach((trade) => {
    const userId = trade.userId.toString();
    userCounts[userId] = (userCounts[userId] || 0) + 1;
  });

  const totalTrades = trades.length;
  const topUser = Object.entries(userCounts).reduce(
    (max, [userId, count]) => (count > max.count ? { userId, count } : max),
    { userId: null, count: 0 }
  );

  const concentration = topUser.count / totalTrades;

  if (concentration > SANITY_CONFIG.ORDER_CONCENTRATION_THRESHOLD) {
    return {
      type: 'order_concentration',
      severity: 'high',
      message: `Single user accounts for ${(concentration * 100).toFixed(1)}% of trades`,
      userId: topUser.userId,
      concentration: concentration.toString(),
    };
  }

  return null;
}

async function detectSuspiciousCancellations(pair, startTime) {
  try {
    const cancelledCount = await Order.countDocuments({
      pair,
      status: 'Cancelled',
      timestamp: { $gte: startTime },
    });

    const totalCount = await Order.countDocuments({
      pair,
      timestamp: { $gte: startTime },
    });

    if (totalCount > 0) {
      const cancellationRate = cancelledCount / totalCount;

      if (cancellationRate > 0.5) {
        return {
          type: 'high_cancellation',
          severity: 'medium',
          message: `High order cancellation rate: ${(cancellationRate * 100).toFixed(1)}%`,
          cancelledCount,
          totalCount,
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

async function getHistoricalAverageVolume(pair) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const historicalTrades = await Order.find({
      pair,
      status: 'Filled',
      timestamp: { $gte: twoDaysAgo, $lt: oneDayAgo },
    }).lean();

    if (historicalTrades.length === 0) return null;

    const totalVolume = historicalTrades.reduce(
      (sum, t) => sum.plus(new Big(t.amount)),
      new Big(0)
    );

    return totalVolume;
  } catch (err) {
    return null;
  }
}

// ─── Price Manipulation Detection ────────────────────────────────────────────

/**
 * Check for price manipulation attempts
 */
async function detectManipulation(pair) {
  const manipulationScore = 0;
  const indicators = [];

  try {
    // 1. Wash trading detection
    const washTrades = await detectWashTrading(pair);
    if (washTrades.detected) {
      indicators.push({
        type: 'wash_trading',
        score: 40,
        details: washTrades,
      });
    }

    // 2. Spoofing detection (large orders placed and quickly cancelled)
    const spoofing = await detectSpoofing(pair);
    if (spoofing.detected) {
      indicators.push({
        type: 'spoofing',
        score: 35,
        details: spoofing,
      });
    }

    // 3. Layering detection
    const layering = await detectLayering(pair);
    if (layering.detected) {
      indicators.push({
        type: 'layering',
        score: 25,
        details: layering,
      });
    }

    const totalScore = indicators.reduce((sum, ind) => sum + ind.score, 0);
    const flagged = totalScore >= SANITY_CONFIG.MANIPULATION_SCORE_THRESHOLD;

    if (flagged) {
      storeAlert({
        type: 'manipulation',
        severity: 'critical',
        pair,
        message: `Price manipulation detected (score: ${totalScore})`,
        indicators,
      });
    }

    return {
      flagged,
      score: totalScore,
      indicators,
      threshold: SANITY_CONFIG.MANIPULATION_SCORE_THRESHOLD,
    };
  } catch (err) {
    return {
      flagged: false,
      score: 0,
      indicators: [],
      error: err.message,
    };
  }
}

async function detectWashTrading(pair) {
  const windowStart = new Date(Date.now() - SANITY_CONFIG.WASH_TRADE_WINDOW_MS);

  const suspiciousUsers = await Order.aggregate([
    {
      $match: {
        pair,
        status: 'Filled',
        timestamp: { $gte: windowStart },
      },
    },
    {
      $group: {
        _id: '$userId',
        buyCount: { $sum: { $cond: [{ $eq: ['$side', 'Buy'] }, 1, 0] } },
        sellCount: { $sum: { $cond: [{ $eq: ['$side', 'Sell'] }, 1, 0] } },
      },
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ['$buyCount', SANITY_CONFIG.WASH_TRADE_THRESHOLD] },
            { $gte: ['$sellCount', SANITY_CONFIG.WASH_TRADE_THRESHOLD] },
          ],
        },
      },
    },
  ]);

  return {
    detected: suspiciousUsers.length > 0,
    count: suspiciousUsers.length,
    users: suspiciousUsers.map((u) => u._id.toString()),
  };
}

async function detectSpoofing(pair) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const quickCancellations = await Order.aggregate([
    {
      $match: {
        pair,
        status: 'Cancelled',
        timestamp: { $gte: fiveMinutesAgo },
      },
    },
    {
      $addFields: {
        lifetime: { $subtract: ['$updatedAt', '$timestamp'] },
      },
    },
    {
      $match: {
        lifetime: { $lt: 10000 }, // Cancelled within 10 seconds
      },
    },
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gte: 5 }, // 5+ quick cancellations
      },
    },
  ]);

  return {
    detected: quickCancellations.length > 0,
    count: quickCancellations.length,
  };
}

async function detectLayering(pair) {
  // Detect multiple orders at different price levels by same user
  const pendingOrders = await Order.aggregate([
    {
      $match: {
        pair,
        status: { $in: ['Pending', 'Partial'] },
      },
    },
    {
      $group: {
        _id: { userId: '$userId', side: '$side' },
        orderCount: { $sum: 1 },
        priceRange: { $push: '$price' },
      },
    },
    {
      $match: {
        orderCount: { $gte: 10 }, // 10+ orders from same user on same side
      },
    },
  ]);

  return {
    detected: pendingOrders.length > 0,
    count: pendingOrders.length,
  };
}

// ─── Health Report Generation ────────────────────────────────────────────────

/**
 * Generate comprehensive market health report
 */
async function generateHealthReport(pair) {
  try {
    const [stateValidation, anomalies, manipulation] = await Promise.all([
      validateMarketState(pair),
      detectAnomalousPatterns(pair),
      detectManipulation(pair),
    ]);

    const report = {
      pair,
      timestamp: new Date(),
      healthy: stateValidation.valid && !manipulation.flagged,
      state: stateValidation,
      anomalies,
      manipulation,
      overallStatus: determineOverallStatus(stateValidation, anomalies, manipulation),
    };

    storeReport(report);

    // Generate alerts for critical issues
    if (!report.healthy) {
      storeAlert({
        type: 'health_report',
        severity: 'high',
        pair,
        message: `Market health issues detected for ${pair}`,
        report,
      });
    }

    return report;
  } catch (err) {
    return {
      pair,
      timestamp: new Date(),
      healthy: false,
      error: err.message,
      overallStatus: 'error',
    };
  }
}

function determineOverallStatus(state, anomalies, manipulation) {
  if (!state.valid) return 'critical';
  if (manipulation.flagged) return 'warning';
  if (anomalies.anomalies.length > 3) return 'warning';
  if (state.issues.length > 0) return 'degraded';
  return 'healthy';
}

// ─── Alert Management ────────────────────────────────────────────────────────

function getAlerts(filter = {}) {
  let filtered = [...alerts];

  if (filter.severity) {
    filtered = filtered.filter((a) => a.severity === filter.severity);
  }

  if (filter.type) {
    filtered = filtered.filter((a) => a.type === filter.type);
  }

  if (filter.pair) {
    filtered = filtered.filter((a) => a.pair === filter.pair);
  }

  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function clearAlerts() {
  const count = alerts.length;
  alerts.length = 0;
  return { cleared: count };
}

// ─── Report Access ───────────────────────────────────────────────────────────

function getHealthReports(filter = {}) {
  let filtered = [...healthReports];

  if (filter.pair) {
    filtered = filtered.filter((r) => r.pair === filter.pair);
  }

  if (filter.status) {
    filtered = filtered.filter((r) => r.overallStatus === filter.status);
  }

  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = {
  validateMarketState,
  detectAnomalousPatterns,
  detectManipulation,
  generateHealthReport,
  getAlerts,
  clearAlerts,
  getHealthReports,
  SANITY_CONFIG,
};
