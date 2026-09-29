const Redis = require('ioredis');

/**
 * EXPENSIVE ENDPOINT SERVICE
 * Multi-dimensional abuse detection using user, wallet, IP, and endpoint counters.
 *
 * Tracks request patterns across four dimensions to detect abusive behavior
 * that single-dimension rate limiting would miss:
 *   - User counters: per-user request rates across all endpoints
 *   - Wallet counters: per-wallet request rates (catches wallet hopping)
 *   - IP counters: per-IP request rates (catches distributed attacks)
 *   - Endpoint counters: per-endpoint load (catches expensive endpoint targeting)
 *
 * Pattern detection:
 *   - multiEndpointBurst: same user hitting many different endpoints rapidly
 *   - walletHopping: same IP using multiple wallets in a short window
 *   - userBurst: excessive requests from a single user
 *   - ipBurst: excessive requests from a single IP
 *   - endpointTargeting: disproportionate load on expensive endpoints
 */

// ─── Endpoint Cost Classification ───────────────────────────────────────────

const ENDPOINT_COSTS = {
  // High cost — trading operations
  'POST /api/trade-engine/orders': { cost: 'high', limit: 10, window: 60 },
  'POST /api/trade-engine/cancel': { cost: 'high', limit: 20, window: 60 },
  'GET /api/trade-engine/orderbook': { cost: 'high', limit: 30, window: 60 },

  // High cost — analytics and reporting
  'GET /api/analytics': { cost: 'high', limit: 30, window: 60 },
  'GET /api/portfolio': { cost: 'high', limit: 30, window: 60 },
  'GET /api/trading-history': { cost: 'high', limit: 30, window: 60 },

  // Medium cost — market data
  'GET /api/markets': { cost: 'medium', limit: 60, window: 60 },
  'GET /api/markets/:id': { cost: 'medium', limit: 60, window: 60 },
  'GET /api/categories': { cost: 'medium', limit: 60, window: 60 },

  // Medium cost — user operations
  'GET /api/balance': { cost: 'medium', limit: 60, window: 60 },
  'GET /api/positions': { cost: 'medium', limit: 60, window: 60 },
  'GET /api/wallet': { cost: 'medium', limit: 60, window: 60 },

  // Low cost — public endpoints
  'GET /api/health': { cost: 'low', limit: 120, window: 60 },
  'GET /api/categories': { cost: 'low', limit: 120, window: 60 },
};

// Default rule for unclassified endpoints
const DEFAULT_RULE = { cost: 'low', limit: 100, window: 60 };

// ─── Abuse Pattern Thresholds ────────────────────────────────────────────────

const ABUSE_PATTERNS = {
  // Same user hitting many different endpoints rapidly
  multiEndpointBurst: { threshold: 5, window: 60 },

  // Same IP using multiple wallets in a short window
  walletHopping: { threshold: 3, window: 300 },

  // Excessive requests from a single user
  userBurst: { threshold: 50, window: 60 },

  // Excessive requests from a single IP
  ipBurst: { threshold: 100, window: 60 },

  // Disproportionate load on expensive endpoints
  endpointTargeting: { threshold: 30, window: 60 },
};

class ExpensiveEndpointService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_THROTTLE_DB || 6,
    });

    this.endpointCosts = new Map(Object.entries(ENDPOINT_COSTS));
    this.patterns = { ...ABUSE_PATTERNS };
  }

  /**
   * Get the cost classification for an endpoint
   */
  getEndpointCost(method, path) {
    const key = `${method.toUpperCase()} ${path}`;
    // Try exact match first
    if (this.endpointCosts.has(key)) {
      return this.endpointCosts.get(key);
    }
    // Try pattern match (e.g., /api/markets/:id)
    for (const [pattern, rule] of this.endpointCosts) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(key)) {
        return rule;
      }
    }
    return DEFAULT_RULE;
  }

  /**
   * Set custom endpoint cost rule
   */
  setEndpointCost(endpoint, rule) {
    this.endpointCosts.set(endpoint, rule);
  }

  /**
   * Extract identifiers from request context
   */
  extractIdentifiers(req) {
    const userId = req.user?.sub || req.user?.userId || req.headers['x-user-id'] || null;
    const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'] || null;
    const ip = this.getClientIp(req);
    const endpoint = `${req.method.toUpperCase()} ${req.path}`;

    return { userId, walletAddress, ip, endpoint };
  }

  /**
   * Get client IP from request
   */
  getClientIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Track a request across all dimensions
   * Returns { allowed, reason, counters }
   */
  async trackRequest(req) {
    const { userId, walletAddress, ip, endpoint } = this.extractIdentifiers(req);
    const rule = this.getEndpointCost(req.method, req.path);
    const now = Date.now();
    const windowStart = now - rule.window * 1000;

    const pipeline = this.redis.pipeline();

    // 1. User counter
    if (userId) {
      const userKey = `abuse:user:${userId}`;
      pipeline.zremrangebyscore(userKey, 0, windowStart);
      pipeline.zadd(userKey, now, `${now}-${Math.random()}`);
      pipeline.zcount(userKey, windowStart, now);
      pipeline.expire(userKey, rule.window * 2);
    }

    // 2. Wallet counter
    if (walletAddress) {
      const walletKey = `abuse:wallet:${walletAddress}`;
      pipeline.zremrangebyscore(walletKey, 0, windowStart);
      pipeline.zadd(walletKey, now, `${now}-${Math.random()}`);
      pipeline.zcount(walletKey, windowStart, now);
      pipeline.expire(walletKey, rule.window * 2);
    }

    // 3. IP counter
    const ipKey = `abuse:ip:${ip}`;
    pipeline.zremrangebyscore(ipKey, 0, windowStart);
    pipeline.zadd(ipKey, now, `${now}-${Math.random()}`);
    pipeline.zcount(ipKey, windowStart, now);
    pipeline.expire(ipKey, rule.window * 2);

    // 4. Endpoint counter
    const endpointKey = `abuse:endpoint:${endpoint}`;
    pipeline.zremrangebyscore(endpointKey, 0, windowStart);
    pipeline.zadd(endpointKey, now, `${now}-${Math.random()}`);
    pipeline.zcount(endpointKey, windowStart, now);
    pipeline.expire(endpointKey, rule.window * 2);

    // 5. User endpoint diversity (for multi-endpoint burst detection)
    if (userId) {
      const userEndpointsKey = `abuse:user:endpoints:${userId}`;
      pipeline.sadd(userEndpointsKey, endpoint);
      pipeline.expire(userEndpointsKey, this.patterns.multiEndpointBurst.window);
    }

    // 6. IP wallet diversity (for wallet hopping detection)
    if (walletAddress) {
      const ipWalletsKey = `abuse:ip:wallets:${ip}`;
      pipeline.sadd(ipWalletsKey, walletAddress);
      pipeline.expire(ipWalletsKey, this.patterns.walletHopping.window);
    }

    const results = await pipeline.exec();

    // Extract counts from pipeline results
    let idx = 0;
    const userCount = userId ? results[idx++][1] : 0;
    const walletCount = walletAddress ? results[idx++][1] : 0;
    const ipCount = results[idx++][1];
    const endpointCount = results[idx++][1];
    // Skip expire results
    idx += 4;

    const counters = {
      user: userCount,
      wallet: walletCount,
      ip: ipCount,
      endpoint: endpointCount,
    };

    // Check for abuse patterns
    const abuseResult = await this.detectAbusePatterns(req, counters, {
      userId,
      walletAddress,
      ip,
      endpoint,
      rule,
    });

    return {
      allowed: !abuseResult.isAbusive,
      reason: abuseResult.reason,
      counters,
      rule,
    };
  }

  /**
   * Detect abusive patterns across dimensions
   */
  async detectAbusePatterns(req, counters, context) {
    const { userId, walletAddress, ip, endpoint, rule } = context;
    const now = Date.now();

    // Check 1: User burst — too many requests from single user
    if (userId && counters.user > this.patterns.userBurst.threshold) {
      return {
        isAbusive: true,
        reason: 'USER_BURST',
        detail: `User ${userId} exceeded ${this.patterns.userBurst.threshold} requests in ${this.patterns.userBurst.window}s`,
      };
    }

    // Check 2: IP burst — too many requests from single IP
    if (counters.ip > this.patterns.ipBurst.threshold) {
      return {
        isAbusive: true,
        reason: 'IP_BURST',
        detail: `IP ${ip} exceeded ${this.patterns.ipBurst.threshold} requests in ${this.patterns.ipBurst.window}s`,
      };
    }

    // Check 3: Multi-endpoint burst — same user hitting many endpoints
    if (userId) {
      const userEndpointsKey = `abuse:user:endpoints:${userId}`;
      const endpointCount = await this.redis.scard(userEndpointsKey);
      if (endpointCount > this.patterns.multiEndpointBurst.threshold) {
        return {
          isAbusive: true,
          reason: 'MULTI_ENDPOINT_BURST',
          detail: `User ${userId} hit ${endpointCount} different endpoints in ${this.patterns.multiEndpointBurst.window}s`,
        };
      }
    }

    // Check 4: Wallet hopping — same IP using multiple wallets
    if (walletAddress) {
      const ipWalletsKey = `abuse:ip:wallets:${ip}`;
      const walletCount = await this.redis.scard(ipWalletsKey);
      if (walletCount > this.patterns.walletHopping.threshold) {
        return {
          isAbusive: true,
          reason: 'WALLET_HOPPING',
          detail: `IP ${ip} used ${walletCount} different wallets in ${this.patterns.walletHopping.window}s`,
        };
      }
    }

    // Check 5: Endpoint targeting — disproportionate load on expensive endpoint
    if (rule.cost === 'high' && counters.endpoint > this.patterns.endpointTargeting.threshold) {
      return {
        isAbusive: true,
        reason: 'ENDPOINT_TARGETING',
        detail: `Endpoint ${endpoint} received ${counters.endpoint} requests in ${this.patterns.endpointTargeting.window}s`,
      };
    }

    // Check 6: Per-endpoint rate limit
    if (counters.endpoint > rule.limit) {
      return {
        isAbusive: true,
        reason: 'ENDPOINT_RATE_LIMIT',
        detail: `Endpoint ${endpoint} exceeded ${rule.limit} requests in ${rule.window}s`,
      };
    }

    return { isAbusive: false, reason: null, detail: null };
  }

  /**
   * Get analytics for a specific dimension
   */
  async getAnalytics(dimension, identifier, period = 3600) {
    const now = Date.now();
    const start = now - period * 1000;
    const key = `abuse:${dimension}:${identifier}`;

    const count = await this.redis.zcount(key, start, now);
    const ttl = await this.redis.ttl(key);

    return {
      dimension,
      identifier,
      period,
      requestCount: count,
      expiresIn: ttl,
    };
  }

  /**
   * Get top abusers across all dimensions
   */
  async getTopAbusers(period = 3600, limit = 10) {
    const now = Date.now();
    const start = now - period * 1000;

    const keys = await this.redis.keys('abuse:*');
    const dimensions = {
      user: {},
      wallet: {},
      ip: {},
      endpoint: {},
    };

    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length < 3) continue;
      const dimension = parts[1];
      const identifier = parts[2];

      if (!dimensions[dimension]) continue;

      const count = await this.redis.zcount(key, start, now);
      dimensions[dimension][identifier] = (dimensions[dimension][identifier] || 0) + count;
    }

    const result = {};
    for (const [dim, data] of Object.entries(dimensions)) {
      result[dim] = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([identifier, count]) => ({ identifier, count }));
    }

    return result;
  }

  /**
   * Clear all abuse data for a specific identifier
   */
  async clearIdentifier(dimension, identifier) {
    const pattern = `abuse:${dimension}:${identifier}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return { cleared: keys.length, dimension, identifier };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      endpointCosts: Object.fromEntries(this.endpointCosts),
      patterns: this.patterns,
    };
  }

  /**
   * Update pattern thresholds
   */
  updatePatterns(patterns) {
    Object.assign(this.patterns, patterns);
  }
}

module.exports = new ExpensiveEndpointService();
