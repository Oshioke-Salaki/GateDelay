const express = require('express');
const router = express.Router();
const balanceService = require('../../services/balanceService');

/**
 * API V1 ROUTES
 * Legacy API version - maintained for backward compatibility
 */

// V1 Market routes
router.get('/markets/ticker', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      // V1 format with snake_case
      symbol: req.query.symbol,
      last_price: 0,
      bid_price: 0,
      ask_price: 0,
      volume_24h: 0,
      change_24h: 0,
      high_24h: 0,
      low_24h: 0,
    },
  });
});

router.get('/markets/orderbook', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      symbol: req.query.symbol,
      bids: [],
      asks: [],
      timestamp: Date.now(),
    },
  });
});

router.get('/markets/trades', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      symbol: req.query.symbol,
      trades: [],
    },
  });
});

// V1 Order routes
router.post('/orders', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      order_id: 'v1_order_123',
      status: 'pending',
      created_at: Date.now(),
    },
  });
});

router.get('/orders', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      orders: [],
      total: 0,
    },
  });
});

router.delete('/orders/:id', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    message: 'Order cancelled',
    order_id: req.params.id,
  });
});

// V1 User routes
router.get('/users/balance', async (req, res) => {
  if (!req.query.userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    const balances = await balanceService.getBalances(req.query.userId, req.query.asset);
    res.json({
      success: true,
      version: 'v1',
      data: { user_id: req.query.userId, balances },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load balance' });
  }
});

module.exports = router;
