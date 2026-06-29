const express = require('express');
const router = express.Router();

// Import middlewares
const { ddosGuard, strictDDoSGuard } = require('../middleware/ddosGuard');
const { throttle, strictThrottle } = require('../middleware/throttle');
const { versionMiddleware, versionRoute, deprecationNotice } = require('../middleware/version');
const { backwardCompatMiddleware, compatibilityWarning } = require('../middleware/backwardCompat');

// Import services
const ddosProtection = require('../services/ddosProtection');
const throttleService = require('../services/throttleService');

// Import versioned routes
const v1Routes = require('./v1');
const v2Routes = require('./v2');
const legacyRoutes = require('./legacy');

/**
 * EXAMPLE API INTEGRATION
 * Shows how to use all protection and versioning features together
 */

// Apply global DDoS protection
router.use(ddosGuard({
  autoMitigate: true,
  blockOnAttack: true,
  whitelist: ['127.0.0.1'], // Whitelist localhost
}));

// Apply global throttling
router.use(throttle({
  endpointSpecific: false, // Global throttling
}));

// Apply versioning middleware
router.use(versionMiddleware({
  defaultVersion: 'v2',
  supportedVersions: ['v1', 'v2'],
  deprecatedVersions: [
    {
      version: 'v1',
      sunset: '2025-12-31',
      message: 'API v1 is deprecated. Please migrate to v2.',
    },
  ],
}));

// Apply backward compatibility for legacy endpoints
router.use('/legacy', compatibilityWarning());
router.use('/legacy', legacyRoutes);

// Version-specific routes
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);

// Auto-routing based on version header/param
router.use('/api', versionRoute({
  v1: v1Routes,
  v2: v2Routes,
  default: v2Routes,
}));

/**
 * Protected endpoints examples
 */

// Public endpoint - standard protection
router.get('/public/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    version: req.apiVersion,
  });
});

// Sensitive endpoint - strict protection
router.post('/trading/execute', 
  strictDDoSGuard(),
  strictThrottle(5, 60), // 5 requests per minute
  (req, res) => {
    res.json({
      success: true,
      message: 'Trade executed',
      version: req.apiVersion,
    });
  }
);

/**
 * Admin endpoints - DDoS protection management
 */

// Get DDoS protection status
router.get('/admin/ddos/status', async (req, res) => {
  try {
    const status = await ddosProtection.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get DDoS protection report
router.get('/admin/ddos/report', async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const report = await ddosProtection.generateReport(period);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Blacklist IP
router.post('/admin/ddos/blacklist', async (req, res) => {
  try {
    const { ip, duration, reason } = req.body;
    await ddosProtection.blacklistIP(ip, duration, reason);
    res.json({
      success: true,
      message: 'IP blacklisted',
      ip,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Remove from blacklist
router.delete('/admin/ddos/blacklist/:ip', async (req, res) => {
  try {
    await ddosProtection.removeFromBlacklist(req.params.ip);
    res.json({
      success: true,
      message: 'IP removed from blacklist',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Throttling management endpoints
 */

// Get throttle analytics
router.get('/admin/throttle/analytics', async (req, res) => {
  try {
    const period = req.query.period || 'hour';
    const analytics = await throttleService.getAnalytics(period);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user throttle status
router.get('/admin/throttle/user/:userId', async (req, res) => {
  try {
    const status = await throttleService.getUserStatus(req.params.userId);
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Set dynamic throttle limit
router.post('/admin/throttle/dynamic-limit', async (req, res) => {
  try {
    const { identifier, limit, window, duration } = req.body;
    const result = await throttleService.setDynamicLimit(identifier, limit, window, duration);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Reset user throttle
router.delete('/admin/throttle/reset/:userId', async (req, res) => {
  try {
    const result = await throttleService.resetUser(req.params.userId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Version management endpoints
 */

// Get API version info
router.get('/version', (req, res) => {
  res.json({
    success: true,
    currentVersion: 'v2',
    requestedVersion: req.apiVersion,
    supportedVersions: ['v1', 'v2'],
    deprecated: ['v1'],
  });
});

module.exports = router;
