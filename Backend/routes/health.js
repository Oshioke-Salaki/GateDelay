/**
 * HEALTH ROUTES
 * API endpoints for system monitoring, connection verification, and component health.
 */

const express = require('express');
const healthCheckService = require('../services/healthCheck');
const { sendError } = require('../utils/errorEnvelope');

const router = express.Router();

// Wrap async route handlers and handle errors gracefully
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Health Check Route Error:', error.message);
    sendError(res, error, {
      statusCode: 500,
      code: 'HEALTH_CHECK_ERROR',
      requestId: req.requestId,
    });
  }
};

/**
 * GET /health
 * Simple ping endpoint returning overall status and server timestamp.
 */
router.get(
  '/',
  handleErrors(async (req, res) => {
    const report = await healthCheckService.generateHealthReport();
    
    const statusCode = report.status === 'DOWN' ? 503 : 200;
    
    res.status(statusCode).json({
      status: report.status,
      timestamp: report.timestamp,
      message: `System operational status is ${report.status}`,
      requestId: req.requestId,
    });
  })
);

/**
 * GET /health/details
 * Comprehensive detailed health check report across all system components.
 */
router.get(
  '/details',
  handleErrors(async (req, res) => {
    const report = await healthCheckService.generateHealthReport();
    
    const statusCode = report.status === 'DOWN' ? 503 : 200;
    
    res.status(statusCode).json({
      ...report,
      requestId: req.requestId,
    });
  })
);

router.get('/live', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gatedelay-backend-express',
    requestId: req.requestId,
  });
});

module.exports = router;
