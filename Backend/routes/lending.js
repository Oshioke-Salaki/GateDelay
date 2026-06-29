const express = require('express');
const lendingService = require('../services/lendingService');

const router = express.Router();

/**
 * Error handling middleware
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Lending Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'LENDING_ERROR',
    });
  }
};

/**
 * GET /api/lending/positions/:address
 * Track lending positions for a user
 */
router.get('/positions/:address', handleErrors(async (req, res) => {
  const { address } = req.params;
  const { protocol = 'AAVE' } = req.query;
  
  const positions = await lendingService.trackPositions(address, protocol);
  res.json({ success: true, data: positions });
}));

/**
 * GET /api/lending/rewards/:address
 * Calculate lending rewards for a user
 */
router.get('/rewards/:address', handleErrors(async (req, res) => {
  const { address } = req.params;
  const { protocol = 'AAVE' } = req.query;
  
  const rewards = await lendingService.calculateRewards(address, protocol);
  res.json({ success: true, data: rewards });
}));

/**
 * POST /api/lending/operation
 * Handle lending operations (deposit, withdraw)
 */
router.post('/operation', handleErrors(async (req, res) => {
  const { operation, protocol, asset, amount, address } = req.body;
  
  if (!operation || !protocol || !asset || !amount || !address) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: operation, protocol, asset, amount, address',
      code: 'VALIDATION_ERROR'
    });
  }

  const result = await lendingService.handleOperation(operation, {
    protocol,
    asset,
    amount,
    address
  });
  
  res.json({ success: true, data: result });
}));

/**
 * GET /api/lending/analytics/:protocol
 * Provide lending analytics for a protocol
 */
router.get('/analytics/:protocol', handleErrors(async (req, res) => {
  const { protocol } = req.params;
  
  const analytics = await lendingService.getAnalytics(protocol);
  res.json({ success: true, data: analytics });
}));

module.exports = router;
