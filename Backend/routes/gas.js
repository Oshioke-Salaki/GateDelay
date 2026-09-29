const express = require('express');
const gasOptimizer = require('../services/gasOptimizer');

const router = express.Router();

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Gas Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'GAS_ERROR' });
  }
};

/**
 * GET /api/gas/prices
 * Get current optimal gas prices (slow / standard / fast).
 */
router.get('/prices', handleErrors(async (req, res) => {
  const prices = await gasOptimizer.getOptimalGasPrices();
  res.json({ success: true, data: prices });
}));

/**
 * GET /api/gas/operations
 * List supported operation types and their base gas units.
 */
router.get('/operations', (req, res) => {
  res.json({ success: true, data: gasOptimizer.GAS_UNITS });
});

/**
 * POST /api/gas/analyze
 * Analyze gas cost for a transaction and get optimization suggestions.
 * Body: { operationType, currentGasPrice?, txData? }
 */
router.post('/analyze', handleErrors(async (req, res) => {
  const analysis = await gasOptimizer.analyzeTransaction(req.body);
  res.status(201).json({ success: true, data: analysis });
}));

/**
 * POST /api/gas/optimize-batch
 * Optimize a batch of transactions via multicall estimation.
 * Body: { transactions: [{ operationType, count? }] }
 */
router.post('/optimize-batch', handleErrors(async (req, res) => {
  const result = await gasOptimizer.optimizeBatch(req.body.transactions);
  res.status(201).json({ success: true, data: result });
}));

/**
 * GET /api/gas/analytics
 * Aggregate gas usage analytics.
 */
router.get('/analytics', handleErrors(async (req, res) => {
  const analytics = await gasOptimizer.getGasAnalytics();
  res.json({ success: true, data: analytics });
}));

module.exports = router;
