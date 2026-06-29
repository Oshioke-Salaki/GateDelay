const express = require('express');
const oracleService = require('../services/oracleService');
const { ethers } = require('ethers');

const router = express.Router();

// Initialize provider (in production, use RPC from env)
const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.mantle.xyz');

/**
 * Error handling middleware
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Oracle Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'ORACLE_ERROR',
    });
  }
};

/**
 * GET /api/oracle/price/:pair
 * Get latest price for a pair
 */
router.get('/price/:base/:quote', handleErrors(async (req, res) => {
  const { base, quote } = req.params;
  const pair = `${base.toUpperCase()}/${quote.toUpperCase()}`;
  
  const result = await oracleService.getPrice(pair, provider);
  res.json({ success: true, data: result });
}));

/**
 * GET /api/oracle/history/:pair
 * Get historical prices for a pair
 */
router.get('/history/:base/:quote', handleErrors(async (req, res) => {
  const { base, quote } = req.params;
  const pair = `${base.toUpperCase()}/${quote.toUpperCase()}`;
  const limit = parseInt(req.query.limit) || 100;

  const history = await oracleService.getHistory(pair, limit);
  res.json({ success: true, data: history });
}));

/**
 * GET /api/oracle/providers
 * List supported oracle providers and feeds
 */
router.get('/providers', (req, res) => {
  res.json({ success: true, data: oracleService.PROVIDERS });
});

module.exports = router;
