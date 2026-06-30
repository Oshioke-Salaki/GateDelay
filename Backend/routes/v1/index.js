const express = require('express');
const router = express.Router();

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
router.get('/users/balance', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    data: {
      user_id: req.query.userId,
      balances: [],
    },
  });
});

module.exports = router;
