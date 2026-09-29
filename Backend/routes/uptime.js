/**
 * Uptime Monitoring API Routes
 * 
 * Provides endpoints for uptime tracking, incident management, and reporting
 */

const express = require('express');
const {
  uptimeService,
  UptimeCheck,
  DowntimeIncident,
  UptimeMetric,
} = require('../services/uptimeService');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// Monitoring Control
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/uptime/monitor/start
 * Start monitoring a market
 * 
 * Body:
 * {
 *   marketId: string,
 *   checkInterval?: string (cron expression, default: '*/5 * * * *')
 * }
 */
router.post('/monitor/start', async (req, res) => {
  try {
    const { marketId, checkInterval } = req.body;

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    await uptimeService.startMonitoring(marketId, checkInterval);

    res.json({
      success: true,
      message: `Started monitoring market: ${marketId}`,
      marketId,
      checkInterval: checkInterval || '*/5 * * * *',
    });
  } catch (error) {
    console.error('Failed to start monitoring:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
});

/**
 * POST /api/uptime/monitor/stop
 * Stop monitoring a market
 * 
 * Body:
 * {
 *   marketId: string
 * }
 */
router.post('/monitor/stop', async (req, res) => {
  try {
    const { marketId } = req.body;

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    uptimeService.stopMonitoring(marketId);

    res.json({
      success: true,
      message: `Stopped monitoring market: ${marketId}`,
      marketId,
    });
  } catch (error) {
    console.error('Failed to stop monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

/**
 * GET /api/uptime/markets
 * Get list of monitored markets
 */
router.get('/markets', async (req, res) => {
  try {
    const markets = await uptimeService.getMonitoredMarkets();
    res.json({ markets });
  } catch (error) {
    console.error('Failed to get monitored markets:', error);
    res.status(500).json({ error: 'Failed to get monitored markets' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Health Checks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/uptime/check
 * Manually trigger a health check
 * 
 * Body:
 * {
 *   marketId: string
 * }
 */
router.post('/check', async (req, res) => {
  try {
    const { marketId } = req.body;

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    const check = await uptimeService.performHealthCheck(marketId);

    res.json({
      success: true,
      check: {
        marketId: check.marketId,
        status: check.status,
        responseTime: check.responseTime,
        timestamp: check.timestamp,
        errorMessage: check.errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to perform health check:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

/**
 * GET /api/uptime/checks/:marketId
 * Get recent health checks for a market
 * 
 * Query params:
 * - limit: number (default: 100)
 * - startDate: ISO date
 * - endDate: ISO date
 */
router.get('/checks/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const query = { marketId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const checks = await UptimeCheck.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      marketId,
      count: checks.length,
      checks: checks.map(check => ({
        id: check._id,
        status: check.status,
        responseTime: check.responseTime,
        timestamp: check.timestamp,
        errorMessage: check.errorMessage,
      })),
    });
  } catch (error) {
    console.error('Failed to get health checks:', error);
    res.status(500).json({ error: 'Failed to get health checks' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Incidents
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/uptime/incidents/current
 * Get current ongoing incidents
 * 
 * Query params:
 * - marketId: string (optional)
 */
router.get('/incidents/current', async (req, res) => {
  try {
    const { marketId } = req.query;
    const incidents = await uptimeService.getCurrentIncidents(marketId || null);

    res.json({
      count: incidents.length,
      incidents: incidents.map(inc => ({
        id: inc._id,
        marketId: inc.marketId,
        startTime: inc.startTime,
        duration: inc.duration,
        durationFormatted: uptimeService.formatDuration(Date.now() - inc.startTime),
        severity: inc.severity,
        cause: inc.cause,
      })),
    });
  } catch (error) {
    console.error('Failed to get current incidents:', error);
    res.status(500).json({ error: 'Failed to get current incidents' });
  }
});

/**
 * GET /api/uptime/incidents/:marketId
 * Get incident history for a market
 * 
 * Query params:
 * - startDate: ISO date
 * - endDate: ISO date
 * - limit: number (default: 50)
 */
router.get('/incidents/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const incidents = await uptimeService.getIncidentHistory(
      marketId,
      start,
      end,
      parseInt(limit)
    );

    res.json({
      marketId,
      count: incidents.length,
      incidents: incidents.map(inc => ({
        id: inc._id,
        startTime: inc.startTime,
        endTime: inc.endTime,
        duration: inc.duration,
        durationFormatted: uptimeService.formatDuration(inc.duration),
        status: inc.status,
        severity: inc.severity,
        cause: inc.cause,
        resolution: inc.resolution,
      })),
    });
  } catch (error) {
    console.error('Failed to get incident history:', error);
    res.status(500).json({ error: 'Failed to get incident history' });
  }
});

/**
 * PATCH /api/uptime/incidents/:incidentId
 * Update an incident (e.g., add resolution notes)
 * 
 * Body:
 * {
 *   resolution?: string,
 *   affectedUsers?: number,
 *   severity?: 'minor' | 'major' | 'critical'
 * }
 */
router.patch('/incidents/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { resolution, affectedUsers, severity } = req.body;

    const updateFields = { updatedAt: new Date() };
    if (resolution) updateFields.resolution = resolution;
    if (affectedUsers !== undefined) updateFields.affectedUsers = affectedUsers;
    if (severity) updateFields.severity = severity;

    const incident = await DowntimeIncident.findByIdAndUpdate(
      incidentId,
      updateFields,
      { new: true }
    );

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({
      success: true,
      incident: {
        id: incident._id,
        marketId: incident.marketId,
        startTime: incident.startTime,
        endTime: incident.endTime,
        status: incident.status,
        severity: incident.severity,
        resolution: incident.resolution,
        affectedUsers: incident.affectedUsers,
      },
    });
  } catch (error) {
    console.error('Failed to update incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Metrics & Reports
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/uptime/metrics/:marketId
 * Get uptime metrics for a market
 * 
 * Query params:
 * - period: 'hourly' | 'daily' | 'weekly' | 'monthly' (default: 'daily')
 * - limit: number (default: 30)
 */
router.get('/metrics/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { period = 'daily', limit = 30 } = req.query;

    const metrics = await uptimeService.getUptimeMetrics(
      marketId,
      period,
      parseInt(limit)
    );

    res.json({
      marketId,
      period,
      count: metrics.length,
      metrics: metrics.map(m => ({
        date: m.date,
        uptimePercentage: m.uptimePercentage,
        totalChecks: m.totalChecks,
        successfulChecks: m.successfulChecks,
        failedChecks: m.failedChecks,
        averageResponseTime: m.averageResponseTime,
        downtimeMinutes: m.downtimeMinutes,
        incidentCount: m.incidentCount,
      })),
    });
  } catch (error) {
    console.error('Failed to get uptime metrics:', error);
    res.status(500).json({ error: 'Failed to get uptime metrics' });
  }
});

/**
 * GET /api/uptime/percentage/:marketId
 * Get current uptime percentage for a market
 * 
 * Query params:
 * - startDate: ISO date (default: 30 days ago)
 * - endDate: ISO date (default: now)
 */
router.get('/percentage/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    let { startDate, endDate } = req.query;

    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }

    if (!endDate) {
      endDate = new Date().toISOString();
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const uptimePercentage = await uptimeService.calculateUptimePercentage(
      marketId,
      start,
      end
    );

    res.json({
      marketId,
      period: {
        start: start,
        end: end,
      },
      uptimePercentage,
      status: uptimePercentage >= 99.9 ? 'excellent' :
              uptimePercentage >= 99.5 ? 'good' :
              uptimePercentage >= 99.0 ? 'fair' : 'poor',
    });
  } catch (error) {
    console.error('Failed to calculate uptime percentage:', error);
    res.status(500).json({ error: 'Failed to calculate uptime percentage' });
  }
});

/**
 * GET /api/uptime/report/:marketId
 * Generate comprehensive uptime report
 * 
 * Query params:
 * - startDate: ISO date (default: 30 days ago)
 * - endDate: ISO date (default: now)
 */
router.get('/report/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    let { startDate, endDate } = req.query;

    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }

    if (!endDate) {
      endDate = new Date().toISOString();
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const report = await uptimeService.generateUptimeReport(marketId, start, end);

    res.json(report);
  } catch (error) {
    console.error('Failed to generate uptime report:', error);
    res.status(500).json({ error: 'Failed to generate uptime report' });
  }
});

/**
 * GET /api/uptime/dashboard
 * Get dashboard summary for all monitored markets
 */
router.get('/dashboard', async (req, res) => {
  try {
    const markets = await uptimeService.getMonitoredMarkets();
    const currentIncidents = await uptimeService.getCurrentIncidents();

    const marketSummaries = await Promise.all(
      markets.map(async (marketId) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const uptimePercentage = await uptimeService.calculateUptimePercentage(
          marketId,
          thirtyDaysAgo,
          new Date()
        );

        const marketIncidents = currentIncidents.filter(
          inc => inc.marketId === marketId
        );

        return {
          marketId,
          uptimePercentage,
          status: uptimePercentage >= 99.9 ? 'excellent' :
                  uptimePercentage >= 99.5 ? 'good' :
                  uptimePercentage >= 99.0 ? 'fair' : 'poor',
          currentIncidents: marketIncidents.length,
          hasActiveIncident: marketIncidents.length > 0,
        };
      })
    );

    res.json({
      totalMarkets: markets.length,
      activeIncidents: currentIncidents.length,
      markets: marketSummaries,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Failed to get dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/uptime/aggregate
 * Manually trigger metric aggregation
 * 
 * Body:
 * {
 *   period: 'hourly' | 'daily' | 'weekly' | 'monthly'
 * }
 */
router.post('/aggregate', async (req, res) => {
  try {
    const { period = 'daily' } = req.body;

    await uptimeService.aggregateMetrics(period);

    res.json({
      success: true,
      message: `Aggregated ${period} metrics`,
      period,
    });
  } catch (error) {
    console.error('Failed to aggregate metrics:', error);
    res.status(500).json({ error: 'Failed to aggregate metrics' });
  }
});

/**
 * DELETE /api/uptime/cleanup
 * Clean up old check records
 * 
 * Query params:
 * - retentionDays: number (default: 90)
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const { retentionDays = 90 } = req.query;

    const deletedCount = await uptimeService.cleanupOldRecords(
      parseInt(retentionDays)
    );

    res.json({
      success: true,
      deletedCount,
      retentionDays: parseInt(retentionDays),
    });
  } catch (error) {
    console.error('Failed to cleanup old records:', error);
    res.status(500).json({ error: 'Failed to cleanup old records' });
  }
});

module.exports = router;
