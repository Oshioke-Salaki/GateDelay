const express = require('express');
const tradeAggregator = require('../services/tradeAggregator');

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
      code: 'AGGREGATION_ERROR',
    });
  }
};

/**
 * GET /historical/:pair
 * Get aggregated historical trades
 */
router.get(
  '/historical/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { interval, limit } = req.query;
    
    const data = await tradeAggregator.aggregateHistoricalTrades(
      pair, 
      interval || '1h', 
      limit ? parseInt(limit) : 24
    );
    
    res.json({ success: true, data });
  })
);

/**
 * GET /stats/:pair
 * Get real-time trade statistics
 */
router.get(
  '/stats/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    
    // Get both Redis real-time and Mongo summary
    const [realTime, summary] = await Promise.all([
      tradeAggregator.getRealTimeStats(pair),
      tradeAggregator.getTradeStatistics(pair)
    ]);
    
    res.json({
      success: true,
      data: {
        ...realTime,
        ...summary,
        pair
      }
    });
  })
);

/**
 * POST /update/:pair
 * Manually trigger a real-time update (usually called by trade engine)
 */
router.post(
  '/update/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { price, amount } = req.body;
    
    if (!price || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Price and amount are required'
      });
    }
    
    await tradeAggregator.updateRealTimeStats(pair, price, amount);
    
    res.json({ success: true, message: 'Stats updated' });
  })
);

/**
 * POST /ingest
 * Ingest trade data from multiple external sources
 */
router.post(
  '/ingest',
  handleErrors(async (req, res) => {
    const { source, tradeData } = req.body;
    
    if (!source || !tradeData) {
      return res.status(400).json({
        success: false,
        error: 'Source and tradeData are required'
      });
    }
    
    await tradeAggregator.collectExternalTrades(source, tradeData);
    
    res.json({ success: true, message: `Data ingested from ${source}` });
  })
);

module.exports = router;
