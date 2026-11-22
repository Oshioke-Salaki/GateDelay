/**
 * SLA Routes
 */
const express = require('express');
const router = express.Router();
const slaTracker = require('../services/slaTracker');

function trackingMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    slaTracker.recordMetric({ endpoint: req.path, responseTime: Date.now() - start, statusCode: res.statusCode });
  });
  next();
}

// GET /api/sla/thresholds
router.get('/thresholds', (req, res) => {
  res.json({ success: true, data: slaTracker.SLA_THRESHOLDS });
});

// GET /api/sla/compliance?window=60
router.get('/compliance', (req, res) => {
  const windowMinutes = parseInt(req.query.window) || 60;
  if (windowMinutes <= 0 || windowMinutes > 43200)
    return res.status(400).json({ success: false, error: 'window must be between 1 and 43200 minutes' });
  res.json({ success: true, data: slaTracker.calculateCompliance(windowMinutes) });
});

// GET /api/sla/violations?limit=50&severity=CRITICAL&type=RESPONSE_TIME
router.get('/violations', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const { severity, type } = req.query;
  const violations = slaTracker.getViolations({ limit, severity, type });
  res.json({ success: true, count: violations.length, data: violations });
});

// POST /api/sla/metric  { endpoint, responseTime, statusCode }
router.post('/metric', (req, res) => {
  const { endpoint, responseTime, statusCode } = req.body;
  if (typeof responseTime !== 'number' || typeof statusCode !== 'number')
    return res.status(400).json({ success: false, error: 'responseTime and statusCode must be numbers' });
  const metric = slaTracker.recordMetric({ endpoint, responseTime, statusCode });
  res.status(201).json({ success: true, data: metric });
});

// GET /api/sla/reports?limit=10
router.get('/reports', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const reports = slaTracker.getReports(limit);
  res.json({ success: true, count: reports.length, data: reports });
});

// POST /api/sla/reports/generate  { window: 1440 }
router.post('/reports/generate', (req, res) => {
  const windowMinutes = parseInt(req.body.window) || 1440;
  if (windowMinutes <= 0 || windowMinutes > 43200)
    return res.status(400).json({ success: false, error: 'window must be between 1 and 43200 minutes' });
  const report = slaTracker.generateReport(windowMinutes);
  res.status(201).json({ success: true, data: report });
});

// GET /api/sla/dashboard
router.get('/dashboard', (req, res) => {
  res.json({ success: true, data: slaTracker.getDashboardData() });
});

module.exports = router;
module.exports.trackingMiddleware = trackingMiddleware;