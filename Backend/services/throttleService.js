const Redis = require('ioredis');

/**
 * THROTTLE SERVICE
 * Manages request throttling, user patterns, and analytics
 */

class ThrottleService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_THROTTLE_DB || 6,
    });

    this.rules = new Map();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default throttle rules
   */
  initializeDefaultRules() {
    this.rules.set('default', {
      requests: 60,
      window: 60,
      burst: 10,
    });

    this.rules.set('authenticated', {
      requests: 300,
      window: 60,
      burst: 50,
    });

    this.rules.set('premium', {
      requests: 1000,
      window: 60,
      burst: 200,
    });

    this.rules.set('trading', {
      requests: 100,
      window: 60,
      burst: 20,
    });

    this.rules.set('public-api', {
      requests: 30,
      window: 60,
      burst: 5,
    });
  }

  /**
   * Set custom throttle rule
   */
  setRule(name, rule) {
    this.rules.set(name, {
      requests: rule.requests || 60,
      window: rule.window || 60,
      burst: rule.burst || 10,
    });
  }

  /**
   * Get rule by name
   */
  getRule(name) {
    return this.rules.get(name) || this.rules.get('default');
  }

  /**
   * Track user request pattern
   */
  async trackPattern(userId, metadata = {}) {
    const now = Date.now();
    const key = `throttle:pattern:${userId}`;
    
    const pattern = {
      timestamp: now,
      endpoint: metadata.endpoint,
      method: metadata.method,
      statusCode: metadata.statusCode,
      responseTime: metadata.responseTime,
    };

    // Store last 100 requests
    await this.redis.lpush(key, JSON.stringify(pattern));
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, 3600);

    return pattern;
  }

  /**
   * Analyze user patterns
   */
  async analyzePattern(userId) {
    const key = `throttle:pattern:${userId}`;
    const patterns = await this.redis.lrange(key, 0, -1);
    
    if (patterns.length === 0) {
      return {
        userId,
        requests: 0,
        suspicious: false,
      };
    }

    const parsed = patterns.map(p => JSON.parse(p));
    const now = Date.now();

    // Calculate metrics
    const recentRequests = parsed.filter(p => now - p.timestamp < 60000);
    const endpoints = new Set(parsed.map(p => p.endpoint));
    const methods = parsed.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + 1;
      return acc;
    }, {});

    const avgResponseTime = parsed.reduce((sum, p) => sum + (p.responseTime || 0), 0) / parsed.length;
    const errorRate = parsed.filter(p => p.statusCode >= 400).length / parsed.length;

    // Detect suspicious patterns
    const suspicious = 
      recentRequests.length > 100 || // Too many recent requests
      endpoints.size === 1 || // Targeting single endpoint
      errorRate > 0.5 || // High error rate
      avgResponseTime < 50; // Too fast (possible bot)

    return {
      userId,
      totalRequests: parsed.length,
      recentRequests: recentRequests.length,
      uniqueEndpoints: endpoints.size,
      methods,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: (errorRate * 100).toFixed(2),
      suspicious,
      patterns: parsed.slice(0, 10), // Last 10 requests
    };
  }

  /**
   * Handle throttling response
   */
  createThrottleResponse(result) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      code: 'THROTTLED',
      limit: result.limit,
      remaining: result.remaining,
      resetAt: new Date(result.resetTime).toISOString(),
      retryAfter: result.retryAfter,
    };
  }

  /**
   * Set dynamic throttling limit
   */
  async setDynamicLimit(identifier, limit, window = 60, duration = 3600) {
    const key = `throttle:dynamic:${identifier}`;
    const config = {
      limit,
      window,
      setAt: Date.now(),
    };
    
    await this.redis.setex(key, duration, JSON.stringify(config));
    
    return config;
  }

  /**
   * Get dynamic limit
   */
  async getDynamicLimit(identifier) {
    const key = `throttle:dynamic:${identifier}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data);
  }

  /**
   * Remove dynamic limit
   */
  async removeDynamicLimit(identifier) {
    const key = `throttle:dynamic:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Get throttling analytics
   */
  async getAnalytics(period = 'hour') {
    const now = Date.now();
    const windows = {
      minute: 60000,
      hour: 3600000,
      day: 86400000,
    };
    
    const window = windows[period] || windows.hour;
    const start = now - window;

    // Get all throttle keys
    const keys = await this.redis.keys('throttle:*:*');
    const analytics = {
      period,
      totalRequests: 0,
      throttledRequests: 0,
      uniqueUsers: new Set(),
      topEndpoints: {},
      topUsers: {},
    };

    for (const key of keys) {
      if (!key.includes(':pattern:') && !key.includes(':dynamic:')) {
        const count = await this.redis.zcount(key, start, now);
        analytics.totalRequests += count;

        // Extract user/endpoint from key
        const parts = key.split(':');
        const identifier = parts[1];
        const endpoint = parts[2];

        analytics.uniqueUsers.add(identifier);
        analytics.topEndpoints[endpoint] = (analytics.topEndpoints[endpoint] || 0) + count;
        analytics.topUsers[identifier] = (analytics.topUsers[identifier] || 0) + count;
      }
    }

    // Convert to arrays and sort
    analytics.uniqueUsers = analytics.uniqueUsers.size;
    analytics.topEndpoints = Object.entries(analytics.topEndpoints)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
    
    analytics.topUsers = Object.entries(analytics.topUsers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user, count]) => ({ user, count }));

    return analytics;
  }

  /**
   * Get user throttle status
   */
  async getUserStatus(userId) {
    const pattern = `throttle:user:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    const now = Date.now();
    
    const status = {
      userId,
      endpoints: [],
      totalRequests: 0,
    };

    for (const key of keys) {
      const endpoint = key.split(':')[3];
      const count = await this.redis.zcount(key, now - 60000, now);
      const ttl = await this.redis.ttl(key);

      status.endpoints.push({
        endpoint,
        requests: count,
        expiresIn: ttl,
      });
      status.totalRequests += count;
    }

    // Get dynamic limit if exists
    status.dynamicLimit = await this.getDynamicLimit(`user:${userId}`);

    return status;
  }

  /**
   * Reset throttle for user
   */
  async resetUser(userId) {
    const pattern = `throttle:*:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    await this.removeDynamicLimit(`user:${userId}`);

    return {
      userId,
      keysRemoved: keys.length,
      resetAt: Date.now(),
    };
  }

  /**
   * Export throttle configuration
   */
  exportConfig() {
    const config = {
      rules: {},
      timestamp: Date.now(),
    };

    for (const [name, rule] of this.rules) {
      config.rules[name] = rule;
    }

    return config;
  }

  /**
   * Import throttle configuration
   */
  importConfig(config) {
    if (config.rules) {
      for (const [name, rule] of Object.entries(config.rules)) {
        this.setRule(name, rule);
      }
    }

    return {
      imported: Object.keys(config.rules || {}).length,
      timestamp: Date.now(),
    };
  }
}

module.exports = new ThrottleService();
