const express = require('express');
const yieldService = require('../services/yieldService');

const router = express.Router();

/**
 * Error handling middleware
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Yield Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'YIELD_ERROR',
    });
  }
};

/**
 * GET /api/yield/strategies
 * List all available yield farming strategies
 */
router.get('/strategies', (req, res) => {
  const strategies = yieldService.getStrategies();
  res.json({ success: true, data: strategies });
});

/**
 * GET /api/yield/positions/:address
 * Track farming positions for a user
 */
router.get('/positions/:address', handleErrors(async (req, res) => {
  const { address } = req.params;
  const positions = await yieldService.trackPositions(address);
  res.json({ success: true, data: positions });
}));

/**
 * POST /api/yield/claim
 * Handle reward distribution for a specific strategy
 */
router.post('/claim', handleErrors(async (req, res) => {
  const { address, strategyId } = req.body;

  if (!address || !strategyId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: address, strategyId',
      code: 'VALIDATION_ERROR'
    });
  }

  const result = await yieldService.distributeRewards(address, strategyId);
  res.json({ success: true, data: result });
}));

/**
 * GET /api/yield/analytics
 * Provide farming analytics
 */
router.get('/analytics', handleErrors(async (req, res) => {
  const { strategyId } = req.query;
  const analytics = await yieldService.getAnalytics(strategyId);
  res.json({ success: true, data: analytics });
}));

module.exports = router;
