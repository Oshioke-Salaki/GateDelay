const Order = require('../models/Order');
const d3 = require('d3');
const tf = require('@tensorflow/tfjs');
const Big = require('big.js');

class AnalyticsService {
  /**
   * Calculate market performance metrics for a given pair over a period
   * @param {string} pair - Trading pair (e.g., 'ETH-USDT')
   * @param {number} hours - Period in hours
   */
  async getMarketMetrics(pair, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const orders = await Order.find({
      pair,
      status: 'Filled',
      updatedAt: { $gte: since }
    }).sort({ updatedAt: 1 });

    if (orders.length === 0) {
      return {
        pair,
        volume: '0',
        high: '0',
        low: '0',
        close: '0',
        change: '0',
        tradeCount: 0
      };
    }

    const prices = orders.map(o => parseFloat(o.price));
    const volumes = orders.map(o => parseFloat(o.amount));

    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const high = d3.max(prices);
    const low = d3.min(prices);
    const close = prices[prices.length - 1];
    const open = prices[0];
    const change = ((close - open) / open) * 100;

    return {
      pair,
      volume: totalVolume.toString(),
      high: high.toString(),
      low: low.toString(),
      close: close.toString(),
      change: change.toFixed(2),
      tradeCount: orders.length
    };
  }

  /**
   * Generate trend analysis (Moving Averages)
   */
  async getTrendAnalysis(pair) {
    const orders = await Order.find({
      pair,
      status: 'Filled'
    }).sort({ updatedAt: 1 }).limit(100);

    if (orders.length < 10) {
      return { error: 'Insufficient data for trend analysis' };
    }

    const prices = orders.map(o => parseFloat(o.price));
    
    // Simple Moving Average (SMA) using d3
    const sma10 = d3.mean(prices.slice(-10));
    const sma30 = prices.length >= 30 ? d3.mean(prices.slice(-30)) : null;

    return {
      pair,
      currentPrice: prices[prices.length - 1],
      sma10,
      sma30,
      trend: sma10 > (sma30 || 0) ? 'Bullish' : 'Bearish'
    };
  }

  /**
   * Support historical data queries with grouping
   */
  async getHistoricalData(pair, interval = '1h') {
    const orders = await Order.find({
      pair,
      status: 'Filled'
    }).sort({ updatedAt: 1 });

    // Group by interval and calculate OHLC
    // This is a simplified version. In production, use MongoDB aggregation.
    const grouped = d3.group(orders, d => {
      const date = new Date(d.updatedAt);
      if (interval === '1h') date.setMinutes(0, 0, 0);
      else if (interval === '1d') date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    const hists = Array.from(grouped, ([time, items]) => {
      const prices = items.map(o => parseFloat(o.price));
      return {
        time,
        open: prices[0],
        high: d3.max(prices),
        low: d3.min(prices),
        close: prices[prices.length - 1],
        volume: items.reduce((sum, o) => sum + parseFloat(o.amount), 0)
      };
    });

    return hists;
  }

  /**
   * Predictive analytics using tensorflow.js
   * Predicts the next price based on the last 10 prices
   */
  async getPredictiveAnalytics(pair) {
    const orders = await Order.find({
      pair,
      status: 'Filled'
    }).sort({ updatedAt: 1 }).limit(50);

    if (orders.length < 20) {
      return { error: 'Insufficient data for prediction' };
    }

    const prices = orders.map(o => parseFloat(o.price));
    
    // Normalize data
    const min = d3.min(prices);
    const max = d3.max(prices);
    const normalized = prices.map(p => (p - min) / (max - min));

    // Prepare training data (X: [p1..p10], Y: p11)
    const windowSize = 10;
    const xs = [];
    const ys = [];

    for (let i = 0; i < normalized.length - windowSize; i++) {
      xs.push(normalized.slice(i, i + windowSize));
      ys.push(normalized[i + windowSize]);
    }

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 8, inputShape: [windowSize], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    const xsTensor = tf.tensor2d(xs);
    const ysTensor = tf.tensor1d(ys);

    await model.fit(xsTensor, ysTensor, { epochs: 50, verbose: 0 });

    const lastWindow = normalized.slice(-windowSize);
    const predictionTensor = model.predict(tf.tensor2d([lastWindow]));
    const predictedNormalized = (await predictionTensor.data())[0];
    
    // Denormalize
    const predictedPrice = predictedNormalized * (max - min) + min;

    return {
      pair,
      currentPrice: prices[prices.length - 1],
      predictedPrice,
      confidence: 'Medium (Based on linear regression of recent trends)'
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(pair, format = 'json') {
    const data = await this.getMarketMetrics(pair);
    const history = await this.getHistoricalData(pair);
    
    const exportObj = {
      pair,
      generatedAt: new Date(),
      metrics: data,
      history
    };

    if (format === 'csv') {
      // Simple JSON to CSV conversion for history
      const headers = ['time', 'open', 'high', 'low', 'close', 'volume'];
      const csvRows = [headers.join(',')];
      
      history.forEach(h => {
        csvRows.push(headers.map(header => h[header]).join(','));
      });
      
      return csvRows.join('\n');
    }

    return JSON.stringify(exportObj, null, 2);
  }
}

module.exports = new AnalyticsService();
