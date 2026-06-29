const express = require('express');
const analyticsService = require('../services/analyticsService');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'ANALYTICS_ERROR',
    });
  }
};

/**
 * GET /metrics/:pair
 * Get market performance metrics
 */
router.get(
  '/metrics/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { hours } = req.query;
    const data = await analyticsService.getMarketMetrics(pair, hours ? parseInt(hours) : 24);
    res.json({ success: true, data });
  })
);

/**
 * GET /trends/:pair
 * Generate trend analysis
 */
router.get(
  '/trends/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const data = await analyticsService.getTrendAnalysis(pair);
    res.json({ success: true, data });
  })
);

/**
 * GET /history/:pair
 * Support historical data queries
 */
router.get(
  '/history/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { interval } = req.query;
    const data = await analyticsService.getHistoricalData(pair, interval || '1h');
    res.json({ success: true, data });
  })
);

/**
 * GET /predict/:pair
 * Include predictive analytics
 */
router.get(
  '/predict/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const data = await analyticsService.getPredictiveAnalytics(pair);
    res.json({ success: true, data });
  })
);

/**
 * GET /export/:pair
 * Export analytics data
 */
router.get(
  '/export/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { format } = req.query;
    
    const data = await analyticsService.exportAnalyticsData(pair, format || 'json');
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${pair}_analytics.csv`);
      return res.send(data);
    }
    
    res.json({ success: true, data: JSON.parse(data) });
  })
);

module.exports = router;
