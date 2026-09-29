const express = require('express');
const breakerService = require('../services/breakerService');

const router = express.Router();

/**
 * Error handler wrapper
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CIRCUIT_BREAKER_ERROR',
    });
  }
};

/**
 * GET /status
 * Get status of all circuit breakers
 */
router.get(
  '/status',
  handleErrors(async (req, res) => {
    const status = await breakerService.getAllBreakerStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * GET /status/:serviceName
 * Get status of specific circuit breaker
 */
router.get(
  '/status/:serviceName',
  handleErrors(async (req, res) => {
    const { serviceName } = req.params;

    const state = await breakerService.getBreakerState(serviceName);

    res.json({
      success: true,
      data: state,
    });
  })
);

/**
 * POST /trip
 * Trip/activate circuit breaker for a service
 */
router.post(
  '/trip',
  handleErrors(async (req, res) => {
    const { serviceName, reason } = req.body;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'serviceName is required',
        code: 'MISSING_SERVICE_NAME',
      });
    }

    const state = await breakerService.tripBreaker(serviceName, reason);

    res.json({
      success: true,
      message: `Circuit breaker tripped for ${serviceName}`,
      data: state,
    });
  })
);

/**
 * POST /reset
 * Reset circuit breaker for a service
 */
router.post(
  '/reset',
  handleErrors(async (req, res) => {
    const { serviceName } = req.body;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'serviceName is required',
        code: 'MISSING_SERVICE_NAME',
      });
    }

    const result = await breakerService.resetBreaker(serviceName);

    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  })
);

/**
 * POST /reset-all
 * Reset all circuit breakers
 */
router.post(
  '/reset-all',
  handleErrors(async (req, res) => {
    const result = await breakerService.resetAllBreakers();

    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  })
);

/**
 * POST /isolate
 * Isolate a service (force circuit breaker open)
 */
router.post(
  '/isolate',
  handleErrors(async (req, res) => {
    const { serviceName, reason } = req.body;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'serviceName is required',
        code: 'MISSING_SERVICE_NAME',
      });
    }

    const result = await breakerService.isolateService(serviceName, reason);

    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  })
);

/**
 * GET /history
 * Get circuit breaker activation history
 */
router.get(
  '/history',
  handleErrors(async (req, res) => {
    const { serviceName, action, limit } = req.query;

    const filter = {};
    if (serviceName) filter.serviceName = serviceName;
    if (action) filter.action = action;
    if (limit) filter.limit = parseInt(limit);

    const history = breakerService.getActivationHistory(filter);

    res.json({
      success: true,
      data: {
        history,
        total: history.length,
      },
    });
  })
);

/**
 * GET /check/:serviceName
 * Check if service is allowed to execute
 */
router.get(
  '/check/:serviceName',
  handleErrors(async (req, res) => {
    const { serviceName } = req.params;

    const check = await breakerService.isServiceAllowed(serviceName);

    res.json({
      success: true,
      data: check,
    });
  })
);

/**
 * POST /config
 * Update circuit breaker configuration
 */
router.post(
  '/config',
  handleErrors(async (req, res) => {
    const newConfig = req.body;

    const result = breakerService.updateConfig(newConfig);

    res.json({
      success: true,
      message: 'Configuration updated',
      data: result,
    });
  })
);

/**
 * GET /config
 * Get current circuit breaker configuration
 */
router.get(
  '/config',
  handleErrors(async (req, res) => {
    res.json({
      success: true,
      data: breakerService.BREAKER_CONFIG,
    });
  })
);

module.exports = router;
