const express = require('express');
const oracleService = require('../services/oracleService');
// TODO: Quarantined - ethers not in package.json. Add dependency or implement alternative.
// const { ethers } = require('ethers');

const router = express.Router();

// TODO: Quarantined - ethers not available, provider disabled
// Initialize provider (in production, use RPC from env)
// const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.mantle.xyz');

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
 * GET /api/oracle/price/:base/:quote
 * Get latest price for a pair with optional staleness rejection
 */
router.get('/price/:base/:quote', handleErrors(async (req, res) => {
  const { base, quote } = req.params;
  const pair = `${base.toUpperCase()}/${quote.toUpperCase()}`;
  const rejectIfStale = req.query.rejectIfStale === 'true';
  const maxAgeSeconds = req.query.maxAgeSeconds ? parseInt(req.query.maxAgeSeconds, 10) : undefined;
  
  const result = await oracleService.getPrice(pair, undefined, { rejectIfStale, maxAgeSeconds });
  res.json({ success: true, data: result });
}));

/**
 * GET /api/oracle/freshness/:base/:quote
 * Check freshness metrics for an oracle pair
 */
router.get('/freshness/:base/:quote', handleErrors(async (req, res) => {
  const { base, quote } = req.params;
  const pair = `${base.toUpperCase()}/${quote.toUpperCase()}`;
  const maxAgeSeconds = req.query.maxAgeSeconds ? parseInt(req.query.maxAgeSeconds, 10) : undefined;

  const result = await oracleService.getPrice(pair, undefined, { maxAgeSeconds });
  res.json({
    success: true,
    data: {
      pair,
      price: result.price,
      source: result.source,
      oracleTimestamp: result.timestamp,
      freshness: result.freshness,
    },
  });
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
