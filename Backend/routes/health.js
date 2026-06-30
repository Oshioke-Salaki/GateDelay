/**
 * HEALTH ROUTES
 * API endpoints for system monitoring, connection verification, and component health.
 */

const express = require('express');
const healthCheckService = require('../services/healthCheck');

const router = express.Router();

// Wrap async route handlers and handle errors gracefully
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Health Check Route Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_ERROR',
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
      success: statusCode === 200,
      status: report.status,
      timestamp: report.timestamp,
      message: `System operational status is ${report.status}`,
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
      success: statusCode === 200,
      ...report,
    });
  })
);

module.exports = router;
