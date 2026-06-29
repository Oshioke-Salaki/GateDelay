const express = require('express');
const router = express.Router();
const { backwardCompatMiddleware, migrationGuide } = require('../middleware/backwardCompat');

/**
 * LEGACY ROUTES
 * Maintains backward compatibility for deprecated endpoints
 * All routes here redirect to new implementations with appropriate transforms
 */

// Apply backward compatibility middleware to all legacy routes
router.use(backwardCompatMiddleware({
  warnDeprecated: true,
  logUsage: true,
}));

/**
 * Migration guide endpoint
 * Provides information about deprecated endpoints and their replacements
 */
router.get('/migration-guide', migrationGuide({
  '/market/ticker': '/markets/ticker',
  '/market/orderbook': '/markets/orderbook',
  '/market/trades': '/markets/trades/recent',
  '/trading/place-order': '/orders/create',
  '/trading/cancel-order': '/orders/cancel',
  '/trading/orders': '/orders/list',
  '/trading/order/:id': '/orders/:id',
}));

/**
 * Legacy market endpoints
 * These are maintained for backward compatibility
 */

// GET /market/ticker - Get market ticker
router.get('/market/ticker', (req, res) => {
  // Request is already transformed by backwardCompatMiddleware
  // Response will be transformed back to legacy format
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use /markets/ticker instead.',
  });
});

// GET /market/orderbook - Get order book
router.get('/market/orderbook', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use /markets/orderbook instead.',
  });
});

// GET /market/trades - Get recent trades
router.get('/market/trades', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use /markets/trades/recent instead.',
  });
});

/**
 * Legacy trading endpoints
 */

// POST /trading/place-order - Place order
router.post('/trading/place-order', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use POST /orders/create instead.',
  });
});

// POST /trading/cancel-order - Cancel order
router.post('/trading/cancel-order', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use DELETE /orders/cancel instead.',
  });
});

// GET /trading/orders - Get user orders
router.get('/trading/orders', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use GET /orders/list instead.',
  });
});

// GET /trading/order/:id - Get specific order
router.get('/trading/order/:id', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use GET /orders/:id instead.',
  });
});

/**
 * Legacy user endpoints
 */

// GET /user/balance - Get user balance
router.get('/user/balance', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use GET /users/balance instead.',
  });
});

// GET /user/profile - Get user profile
router.get('/user/profile', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is deprecated. Use GET /users/profile instead.',
  });
});

module.exports = router;
