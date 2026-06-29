const Redis = require('ioredis');

/**
 * THROTTLE MIDDLEWARE
 * Request throttling to prevent API abuse
 * Supports user-based and IP-based throttling with dynamic limits
 */

class ThrottleService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_THROTTLE_DB || 6,
    });

    // Default throttle rules
    this.defaultRules = {
      public: { requests: 60, window: 60 }, // 60 req/min
      authenticated: { requests: 300, window: 60 }, // 300 req/min
      premium: { requests: 1000, window: 60 }, // 1000 req/min
    };

    // Endpoint-specific rules
    this.endpointRules = new Map();
  }

  /**
   * Set throttle rule for specific endpoint
   */
  setEndpointRule(endpoint, rule) {
    this.endpointRules.set(endpoint, rule);
  }

  /**
   * Get throttle rule for identifier
   */
  getRule(identifier, endpoint = null) {
    // Check endpoint-specific rule first
    if (endpoint && this.endpointRules.has(endpoint)) {
      return this.endpointRules.get(endpoint);
    }

    // Default rules based on identifier type
    if (identifier.startsWith('user:')) {
      return this.defaultRules.authenticated;
    } else if (identifier.startsWith('premium:')) {
      return this.defaultRules.premium;
    }
    return this.defaultRules.public;
  }

  /**
   * Track request and check throttle
   */
  async track(identifier, endpoint = null) {
    const rule = this.getRule(identifier, endpoint);
    const now = Date.now();
    const windowStart = now - (rule.window * 1000);
    const key = `throttle:${identifier}:${endpoint || 'global'}`;

    // Use sorted set to track requests in time window
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Count requests in window
    pipeline.zcount(key, windowStart, now);
    
    // Set expiration
    pipeline.expire(key, rule.window * 2);

    const results = await pipeline.exec();
    const count = results[2][1];

    const remaining = Math.max(0, rule.requests - count);
    const resetTime = now + (rule.window * 1000);

    return {
      allowed: count <= rule.requests,
      count,
      limit: rule.requests,
      remaining,
      resetTime,
      retryAfter: count > rule.requests ? Math.ceil(rule.window / 2) : 0,
    };
  }

  /**
   * Get analytics for identifier
   */
  async getAnalytics(identifier, period = 3600) {
    const now = Date.now();
    const start = now - (period * 1000);
    const pattern = `throttle:${identifier}:*`;
    
    const keys = await this.redis.keys(pattern);
    const analytics = {
      identifier,
      period,
      endpoints: {},
      totalRequests: 0,
    };

    for (const key of keys) {
      const endpoint = key.split(':')[2] || 'global';
      const count = await this.redis.zcount(key, start, now);
      
      analytics.endpoints[endpoint] = count;
      analytics.totalRequests += count;
    }

    return analytics;
  }

  /**
   * Get pattern analytics
   */
  async getPatternAnalytics() {
    const now = Date.now();
    const window = 300000; // 5 minutes
    const start = now - window;
    
    const keys = await this.redis.keys('throttle:*');
    const patterns = {
      byType: { public: 0, authenticated: 0, premium: 0 },
      byEndpoint: {},
      topUsers: [],
    };

    const userCounts = {};

    for (const key of keys) {
      const parts = key.split(':');
      const identifier = parts[1];
      const endpoint = parts[2] || 'global';
      
      const count = await this.redis.zcount(key, start, now);
      
      // Categorize by type
      if (identifier.startsWith('user:')) {
        patterns.byType.authenticated += count;
        userCounts[identifier] = (userCounts[identifier] || 0) + count;
      } else if (identifier.startsWith('premium:')) {
        patterns.byType.premium += count;
        userCounts[identifier] = (userCounts[identifier] || 0) + count;
      } else {
        patterns.byType.public += count;
      }

      // Count by endpoint
      patterns.byEndpoint[endpoint] = (patterns.byEndpoint[endpoint] || 0) + count;
    }

    // Top users
    patterns.topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([identifier, count]) => ({ identifier, count }));

    return patterns;
  }

  /**
   * Set dynamic limit for identifier
   */
  async setDynamicLimit(identifier, limit, window = 60) {
    const key = `throttle:dynamic:${identifier}`;
    await this.redis.setex(key, 3600, JSON.stringify({ limit, window }));
  }

  /**
   * Get dynamic limit if exists
   */
  async getDynamicLimit(identifier) {
    const key = `throttle:dynamic:${identifier}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear throttle data for identifier
   */
  async clear(identifier) {
    const pattern = `throttle:${identifier}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Singleton instance
const throttleService = new ThrottleService();

/**
 * Extract identifier from request
 */
function getIdentifier(req) {
  // Check for authenticated user
  const userId = req.user?.sub || req.user?.userId || req.headers['x-user-id'];
  if (userId) {
    // Check if premium user
    const isPremium = req.user?.tier === 'premium' || req.user?.isPremium;
    return isPremium ? `premium:${userId}` : `user:${userId}`;
  }

  // Fall back to IP
  const ip = 
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown';
  
  return `ip:${ip}`;
}

/**
 * Throttle middleware factory
 */
function throttle(options = {}) {
  const config = {
    keyGenerator: options.keyGenerator || getIdentifier,
    skip: options.skip || (() => false),
    onLimitReached: options.onLimitReached || null,
    includeHeaders: options.includeHeaders !== false,
    ...options,
  };

  return async (req, res, next) => {
    try {
      // Skip if configured
      if (config.skip(req)) {
        return next();
      }

      const identifier = config.keyGenerator(req);
      const endpoint = config.endpointSpecific ? req.path : null;

      // Check for dynamic limit
      const dynamicLimit = await throttleService.getDynamicLimit(identifier);
      if (dynamicLimit) {
        throttleService.setEndpointRule(endpoint, {
          requests: dynamicLimit.limit,
          window: dynamicLimit.window,
        });
      }

      const result = await throttleService.track(identifier, endpoint);

      // Add headers
      if (config.includeHeaders) {
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      }

      if (!result.allowed) {
        if (config.onLimitReached) {
          config.onLimitReached(req, res, result);
        }

        res.setHeader('Retry-After', result.retryAfter);
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          limit: result.limit,
          retryAfter: result.retryAfter,
          resetTime: new Date(result.resetTime).toISOString(),
        });
      }

      next();
    } catch (error) {
      console.error('[Throttle] Middleware error:', error);
      // Fail open
      next();
    }
  };
}

/**
 * Strict throttle for sensitive endpoints
 */
function strictThrottle(requests = 10, window = 60) {
  return throttle({
    endpointSpecific: true,
    rule: { requests, window },
  });
}

module.exports = { 
  throttle, 
  strictThrottle, 
  throttleService,
};
