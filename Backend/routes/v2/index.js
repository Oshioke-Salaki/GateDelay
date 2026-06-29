const express = require('express');
const router = express.Router();

/**
 * API V2 ROUTES
 * Current API version with modern conventions
 */

// V2 Market routes
router.get('/markets/ticker', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      // V2 format with camelCase
      symbol: req.query.symbol,
      lastPrice: 0,
      bidPrice: 0,
      askPrice: 0,
      volume24h: 0,
      change24h: 0,
      high24h: 0,
      low24h: 0,
      timestamp: Date.now(),
    },
  });
});

router.get('/markets/orderbook', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      symbol: req.query.symbol,
      bids: [],
      asks: [],
      depth: req.query.depth || 20,
      timestamp: Date.now(),
      metadata: {
        spread: 0,
        midPrice: 0,
      },
    },
  });
});

router.get('/markets/trades/recent', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      symbol: req.query.symbol,
      trades: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
      },
    },
  });
});

// V2 Order routes
router.post('/orders/create', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      orderId: 'v2_order_123',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
});

router.get('/orders/list', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      orders: [],
      pagination: {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        total: 0,
        totalPages: 0,
      },
    },
  });
});

router.get('/orders/:id', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      orderId: req.params.id,
      status: 'filled',
      createdAt: new Date().toISOString(),
    },
  });
});

router.delete('/orders/cancel', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    message: 'Order cancelled successfully',
    data: {
      orderId: req.body.orderId,
      cancelledAt: new Date().toISOString(),
    },
  });
});

// V2 User routes
router.get('/users/balance', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      userId: req.query.userId,
      balances: [],
      totalValue: {
        usd: 0,
        btc: 0,
      },
      lastUpdated: new Date().toISOString(),
    },
  });
});

router.get('/users/profile', (req, res) => {
  res.json({
    success: true,
    version: 'v2',
    data: {
      userId: req.query.userId,
      profile: {},
      preferences: {},
    },
  });
});

module.exports = router;
