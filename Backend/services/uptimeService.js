/**
 * Uptime Monitoring Service
 * 
 * Tracks market uptime, availability, and downtime incidents.
 * Provides uptime percentages, alerts, and detailed reports.
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════════════
// MongoDB Schemas
// ═══════════════════════════════════════════════════════════════════════════

const uptimeCheckSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  status: {
    type: String,
    enum: ['up', 'down', 'degraded'],
    required: true,
  },
  responseTime: {
    type: Number, // milliseconds
  },
  errorMessage: String,
  metadata: mongoose.Schema.Types.Mixed,
});

const downtimeIncidentSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
    index: true,
  },
  endTime: Date,
  duration: Number, // milliseconds
  status: {
    type: String,
    enum: ['ongoing', 'resolved'],
    default: 'ongoing',
    index: true,
  },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    default: 'major',
  },
  cause: String,
  affectedUsers: Number,
  resolution: String,
  notificationsSent: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const uptimeMetricSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  period: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    required: true,
  },
  uptimePercentage: {
    type: Number,
    required: true,
  },
  totalChecks: Number,
  successfulChecks: Number,
  failedChecks: Number,
  averageResponseTime: Number,
  downtimeMinutes: Number,
  incidentCount: Number,
});

// Indexes for performance
uptimeCheckSchema.index({ marketId: 1, timestamp: -1 });
downtimeIncidentSchema.index({ marketId: 1, status: 1, startTime: -1 });
uptimeMetricSchema.index({ marketId: 1, period: 1, date: -1 });

const UptimeCheck = mongoose.model('UptimeCheck', uptimeCheckSchema);
const DowntimeIncident = mongoose.model('DowntimeIncident', downtimeIncidentSchema);
const UptimeMetric = mongoose.model('UptimeMetric', uptimeMetricSchema);

// ═══════════════════════════════════════════════════════════════════════════
// Service Class
// ═══════════════════════════════════════════════════════════════════════════

class UptimeService extends EventEmitter {
  constructor() {
    super();
    this.monitoringJobs = new Map();
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      uptimeWarning: 99.5, // Below 99.5% triggers warning
      uptimeCritical: 99.0, // Below 99% triggers critical alert
      consecutiveFailures: 3, // Alert after 3 consecutive failures
    };
    this.consecutiveFailures = new Map();
    this.currentIncidents = new Map();
  }

  /**
   * Start monitoring a market
   */
  async startMonitoring(marketId, checkInterval = '*/5 * * * *') {
    if (this.monitoringJobs.has(marketId)) {
      console.log(`Already monitoring market: ${marketId}`);
      return;
    }

    // Schedule periodic health checks
    const job = cron.schedule(checkInterval, async () => {
      await this.performHealthCheck(marketId);
    });

    this.monitoringJobs.set(marketId, job);
    console.log(`Started monitoring market: ${marketId} with interval: ${checkInterval}`);

    // Perform immediate check
    await this.performHealthCheck(marketId);
  }

  /**
   * Stop monitoring a market
   */
  stopMonitoring(marketId) {
    const job = this.monitoringJobs.get(marketId);
    if (job) {
      job.stop();
      this.monitoringJobs.delete(marketId);
      console.log(`Stopped monitoring market: ${marketId}`);
    }
  }

  /**
   * Perform health check on a market
   */
  async performHealthCheck(marketId) {
    const startTime = Date.now();
    let status = 'up';
    let responseTime = null;
    let errorMessage = null;

    try {
      // Simulate market health check (replace with actual implementation)
      responseTime = await this.checkMarketHealth(marketId);
      
      if (responseTime > this.alertThresholds.responseTime) {
        status = 'degraded';
      }
    } catch (error) {
      status = 'down';
      errorMessage = error.message;
      responseTime = Date.now() - startTime;
    }

    // Record the check
    const check = await UptimeCheck.create({
      marketId,
      status,
      responseTime,
      errorMessage,
      timestamp: new Date(),
    });

    // Handle status changes
    await this.handleStatusChange(marketId, status, errorMessage);

    // Emit event
    this.emit('healthCheck', { marketId, status, responseTime });

    return check;
  }

  /**
   * Simulate market health check (replace with actual implementation)
   */
  async checkMarketHealth(marketId) {
    // This is a placeholder - implement actual health check logic
    // e.g., check if market contract is responsive, check API endpoints, etc.
    
    return new Promise((resolve, reject) => {
      const responseTime = Math.random() * 2000; // Simulate 0-2 second response
      
      // Simulate 1% failure rate
      if (Math.random() < 0.01) {
        setTimeout(() => reject(new Error('Market unresponsive')), responseTime);
      } else {
        setTimeout(() => resolve(responseTime), responseTime);
      }
    });
  }

  /**
   * Handle status changes and incidents
   */
  async handleStatusChange(marketId, status, errorMessage) {
    const previousFailures = this.consecutiveFailures.get(marketId) || 0;

    if (status === 'down') {
      // Increment failure count
      this.consecutiveFailures.set(marketId, previousFailures + 1);

      // Check if we need to create/update an incident
      if (!this.currentIncidents.has(marketId)) {
        // Create new incident
        const incident = await DowntimeIncident.create({
          marketId,
          startTime: new Date(),
          status: 'ongoing',
          severity: this.calculateSeverity(previousFailures + 1),
          cause: errorMessage,
        });

        this.currentIncidents.set(marketId, incident._id);

        // Send alert if threshold reached
        if (previousFailures + 1 >= this.alertThresholds.consecutiveFailures) {
          await this.sendAlert(marketId, incident, 'started');
        }
      }
    } else {
      // Market is back up
      if (this.currentIncidents.has(marketId)) {
        // Resolve the incident
        const incidentId = this.currentIncidents.get(marketId);
        const incident = await DowntimeIncident.findById(incidentId);
        
        if (incident) {
          const endTime = new Date();
          const duration = endTime - incident.startTime;

          await DowntimeIncident.findByIdAndUpdate(incidentId, {
            endTime,
            duration,
            status: 'resolved',
            updatedAt: new Date(),
          });

          await this.sendAlert(marketId, incident, 'resolved');
        }

        this.currentIncidents.delete(marketId);
      }

      // Reset failure count
      this.consecutiveFailures.set(marketId, 0);
    }
  }

  /**
   * Calculate incident severity based on consecutive failures
   */
  calculateSeverity(consecutiveFailures) {
    if (consecutiveFailures >= 10) return 'critical';
    if (consecutiveFailures >= 5) return 'major';
    return 'minor';
  }

  /**
   * Send uptime alert
   */
  async sendAlert(marketId, incident, alertType) {
    const alert = {
      marketId,
      incidentId: incident._id,
      type: alertType,
      severity: incident.severity,
      timestamp: new Date(),
      message: alertType === 'started'
        ? `Market ${marketId} is experiencing downtime. Severity: ${incident.severity}`
        : `Market ${marketId} is back online. Downtime duration: ${this.formatDuration(incident.duration)}`,
    };

    // Emit alert event
    this.emit('alert', alert);

    // Mark notifications as sent
    if (!incident.notificationsSent) {
      await DowntimeIncident.findByIdAndUpdate(incident._id, {
        notificationsSent: true,
      });
    }

    console.log(`Alert sent: ${alert.message}`);
    return alert;
  }

  /**
   * Calculate uptime percentage for a period
   */
  async calculateUptimePercentage(marketId, startDate, endDate) {
    const checks = await UptimeCheck.find({
      marketId,
      timestamp: { $gte: startDate, $lte: endDate },
    });

    if (checks.length === 0) {
      return 100; // No checks = assume up
    }

    const successfulChecks = checks.filter(c => c.status === 'up').length;
    const uptimePercentage = (successfulChecks / checks.length) * 100;

    return Math.round(uptimePercentage * 100) / 100; // 2 decimal places
  }

  /**
   * Get uptime metrics for a market
   */
  async getUptimeMetrics(marketId, period = 'daily', limit = 30) {
    const metrics = await UptimeMetric.find({
      marketId,
      period,
    })
      .sort({ date: -1 })
      .limit(limit);

    return metrics;
  }

  /**
   * Generate uptime report
   */
  async generateUptimeReport(marketId, startDate, endDate) {
    const [checks, incidents, metrics] = await Promise.all([
      UptimeCheck.find({
        marketId,
        timestamp: { $gte: startDate, $lte: endDate },
      }),
      DowntimeIncident.find({
        marketId,
        startTime: { $gte: startDate, $lte: endDate },
      }),
      this.calculateDetailedMetrics(marketId, startDate, endDate),
    ]);

    const uptimePercentage = await this.calculateUptimePercentage(marketId, startDate, endDate);
    const totalDowntime = incidents.reduce((sum, inc) => sum + (inc.duration || 0), 0);

    return {
      marketId,
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        uptimePercentage,
        totalChecks: checks.length,
        successfulChecks: checks.filter(c => c.status === 'up').length,
        failedChecks: checks.filter(c => c.status === 'down').length,
        degradedChecks: checks.filter(c => c.status === 'degraded').length,
        totalDowntimeMs: totalDowntime,
        totalDowntimeFormatted: this.formatDuration(totalDowntime),
        incidentCount: incidents.length,
        averageResponseTime: metrics.averageResponseTime,
      },
      incidents: incidents.map(inc => ({
        id: inc._id,
        startTime: inc.startTime,
        endTime: inc.endTime,
        duration: inc.duration,
        durationFormatted: this.formatDuration(inc.duration),
        severity: inc.severity,
        status: inc.status,
        cause: inc.cause,
      })),
      metrics,
    };
  }

  /**
   * Calculate detailed metrics
   */
  async calculateDetailedMetrics(marketId, startDate, endDate) {
    const checks = await UptimeCheck.find({
      marketId,
      timestamp: { $gte: startDate, $lte: endDate },
    });

    if (checks.length === 0) {
      return {
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
      };
    }

    const responseTimes = checks
      .filter(c => c.responseTime)
      .map(c => c.responseTime);

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
    };
  }

  /**
   * Get current incidents
   */
  async getCurrentIncidents(marketId = null) {
    const query = { status: 'ongoing' };
    if (marketId) {
      query.marketId = marketId;
    }

    const incidents = await DowntimeIncident.find(query).sort({ startTime: -1 });
    return incidents;
  }

  /**
   * Get incident history
   */
  async getIncidentHistory(marketId, startDate, endDate, limit = 50) {
    const query = { marketId };
    
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = startDate;
      if (endDate) query.startTime.$lte = endDate;
    }

    const incidents = await DowntimeIncident.find(query)
      .sort({ startTime: -1 })
      .limit(limit);

    return incidents;
  }

  /**
   * Aggregate and store periodic metrics
   */
  async aggregateMetrics(period = 'daily') {
    const markets = await this.getMonitoredMarkets();
    const now = new Date();
    let startDate;

    switch (period) {
      case 'hourly':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    for (const marketId of markets) {
      const checks = await UptimeCheck.find({
        marketId,
        timestamp: { $gte: startDate, $lte: now },
      });

      const incidents = await DowntimeIncident.find({
        marketId,
        startTime: { $gte: startDate, $lte: now },
      });

      const successfulChecks = checks.filter(c => c.status === 'up').length;
      const uptimePercentage = checks.length > 0
        ? (successfulChecks / checks.length) * 100
        : 100;

      const responseTimes = checks
        .filter(c => c.responseTime)
        .map(c => c.responseTime);

      const downtimeMinutes = incidents.reduce(
        (sum, inc) => sum + (inc.duration || 0),
        0
      ) / (1000 * 60);

      await UptimeMetric.findOneAndUpdate(
        { marketId, period, date: now },
        {
          uptimePercentage: Math.round(uptimePercentage * 100) / 100,
          totalChecks: checks.length,
          successfulChecks,
          failedChecks: checks.filter(c => c.status === 'down').length,
          averageResponseTime: responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
          downtimeMinutes,
          incidentCount: incidents.length,
        },
        { upsert: true, new: true }
      );

      // Check if uptime is below thresholds
      if (uptimePercentage < this.alertThresholds.uptimeCritical) {
        this.emit('lowUptime', {
          marketId,
          uptimePercentage,
          severity: 'critical',
          period,
        });
      } else if (uptimePercentage < this.alertThresholds.uptimeWarning) {
        this.emit('lowUptime', {
          marketId,
          uptimePercentage,
          severity: 'warning',
          period,
        });
      }
    }
  }

  /**
   * Get list of monitored markets
   */
  async getMonitoredMarkets() {
    const markets = await UptimeCheck.distinct('marketId');
    return markets;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(milliseconds) {
    if (!milliseconds) return '0s';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Clean up old check records (retention policy)
   */
  async cleanupOldRecords(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await UptimeCheck.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    console.log(`Cleaned up ${result.deletedCount} old uptime check records`);
    return result.deletedCount;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════

const uptimeService = new UptimeService();

// Schedule metric aggregation jobs
cron.schedule('0 * * * *', () => {
  // Run hourly aggregation
  uptimeService.aggregateMetrics('hourly').catch(console.error);
});

cron.schedule('0 0 * * *', () => {
  // Run daily aggregation
  uptimeService.aggregateMetrics('daily').catch(console.error);
});

cron.schedule('0 0 * * 0', () => {
  // Run weekly aggregation (every Sunday at midnight)
  uptimeService.aggregateMetrics('weekly').catch(console.error);
});

cron.schedule('0 0 1 * *', () => {
  // Run monthly aggregation (first day of month)
  uptimeService.aggregateMetrics('monthly').catch(console.error);
});

// Cleanup old records weekly
cron.schedule('0 2 * * 0', () => {
  uptimeService.cleanupOldRecords(90).catch(console.error);
});

module.exports = {
  uptimeService,
  UptimeService,
  UptimeCheck,
  DowntimeIncident,
  UptimeMetric,
};
