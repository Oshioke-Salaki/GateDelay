const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'deprecation.log' }),
    new winston.transports.Console()
  ]
});

class DeprecationService {
  constructor() {
    this.deprecatedEndpoints = new Map();
    this.usageTracking = new Map();
    this.deprecationTimelines = new Map();
  }

  registerDeprecatedEndpoint(endpoint, config) {
    const {
      deprecationDate,
      sunsetDate,
      alternative,
      reason,
      migrationGuide
    } = config;

    this.deprecatedEndpoints.set(endpoint, {
      deprecationDate: new Date(deprecationDate),
      sunsetDate: new Date(sunsetDate),
      alternative,
      reason,
      migrationGuide,
      isActive: true
    });

    this.deprecationTimelines.set(endpoint, {
      registeredAt: new Date(),
      deprecationDate: new Date(deprecationDate),
      sunsetDate: new Date(sunsetDate)
    });

    logger.info(`Registered deprecated endpoint: ${endpoint}`, config);
  }

  trackUsage(endpoint, userId, metadata = {}) {
    if (!this.usageTracking.has(endpoint)) {
      this.usageTracking.set(endpoint, []);
    }

    const usage = {
      timestamp: new Date(),
      userId,
      metadata
    };

    this.usageTracking.get(endpoint).push(usage);

    logger.warn(`Deprecated endpoint used: ${endpoint} by user ${userId}`);
  }

  getDeprecationStatus(endpoint) {
    const config = this.deprecatedEndpoints.get(endpoint);
    if (!config) {
      return { deprecated: false };
    }

    const now = new Date();
    const isDeprecated = now >= config.deprecationDate;
    const isSunset = now >= config.sunsetDate;

    return {
      deprecated: isDeprecated,
      sunset: isSunset,
      deprecationDate: config.deprecationDate,
      sunsetDate: config.sunsetDate,
      alternative: config.alternative,
      reason: config.reason,
      migrationGuide: config.migrationGuide,
      daysUntilSunset: Math.ceil((config.sunsetDate - now) / (1000 * 60 * 60 * 24))
    };
  }

  getMigrationGuidance(endpoint) {
    const config = this.deprecatedEndpoints.get(endpoint);
    if (!config) {
      return null;
    }

    return {
      endpoint,
      alternative: config.alternative,
      migrationGuide: config.migrationGuide,
      steps: this.generateMigrationSteps(config)
    };
  }

  generateMigrationSteps(config) {
    const steps = [];

    if (config.alternative) {
      steps.push({
        step: 1,
        action: 'Update endpoint',
        description: `Replace ${config.alternative} with the new endpoint`
      });
    }

    if (config.migrationGuide) {
      steps.push({
        step: 2,
        action: 'Follow migration guide',
        description: config.migrationGuide
      });
    }

    steps.push({
      step: 3,
      action: 'Test changes',
      description: 'Test your application with the new endpoint before deployment'
    });

    return steps;
  }

  checkDeprecationTimeline(endpoint) {
    const timeline = this.deprecationTimelines.get(endpoint);
    if (!timeline) {
      return null;
    }

    const now = new Date();
    const timeUntilDeprecation = timeline.deprecationDate - now;
    const timeUntilSunset = timeline.sunsetDate - now;

    return {
      endpoint,
      registeredAt: timeline.registeredAt,
      deprecationDate: timeline.deprecationDate,
      sunsetDate: timeline.sunsetDate,
      status: now < timeline.deprecationDate ? 'pending' : 
              now < timeline.sunsetDate ? 'deprecated' : 'sunset',
      daysUntilDeprecation: Math.ceil(timeUntilDeprecation / (1000 * 60 * 60 * 24)),
      daysUntilSunset: Math.ceil(timeUntilSunset / (1000 * 60 * 60 * 24))
    };
  }

  generateDeprecationReport() {
    const report = {
      generatedAt: new Date(),
      summary: {
        totalDeprecated: this.deprecatedEndpoints.size,
        activeDeprecated: 0,
        sunset: 0,
        pending: 0
      },
      endpoints: [],
      usageStats: []
    };

    for (const [endpoint, config] of this.deprecatedEndpoints) {
      const status = this.getDeprecationStatus(endpoint);
      const timeline = this.checkDeprecationTimeline(endpoint);
      const usage = this.usageTracking.get(endpoint) || [];

      report.endpoints.push({
        endpoint,
        status: timeline.status,
        deprecationDate: config.deprecationDate,
        sunsetDate: config.sunsetDate,
        alternative: config.alternative,
        usageCount: usage.length
      });

      if (timeline.status === 'deprecated') report.summary.activeDeprecated++;
      else if (timeline.status === 'sunset') report.summary.sunset++;
      else report.summary.pending++;

      report.usageStats.push({
        endpoint,
        totalUsage: usage.length,
        uniqueUsers: new Set(usage.map(u => u.userId)).size,
        lastUsed: usage.length > 0 ? usage[usage.length - 1].timestamp : null
      });
    }

    return report;
  }

  getUsageByEndpoint(endpoint) {
    const usage = this.usageTracking.get(endpoint) || [];
    const uniqueUsers = new Set(usage.map(u => u.userId));

    return {
      endpoint,
      totalUsage: usage.length,
      uniqueUsers: uniqueUsers.size,
      usageHistory: usage.slice(-100),
      lastUsed: usage.length > 0 ? usage[usage.length - 1].timestamp : null
    };
  }

  getAllDeprecatedEndpoints() {
    const endpoints = [];
    for (const [endpoint, config] of this.deprecatedEndpoints) {
      endpoints.push({
        endpoint,
        ...config,
        status: this.checkDeprecationTimeline(endpoint).status
      });
    }
    return endpoints;
  }
}

module.exports = new DeprecationService();
