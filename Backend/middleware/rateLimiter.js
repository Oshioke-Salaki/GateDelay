const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('ioredis');

/**
 * MARKET RATE LIMITER MIDDLEWARE
 * Rate limiting for market API endpoints with tier-based limits
 * Supports per-user and per-IP tracking with Redis backing
 */

// ─── Redis Client Setup ──────────────────────────────────────────────────────

let redisClient;

try {
  redisClient = new redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    db: process.env.REDIS_DB || 1, // Separate DB for rate limiting
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis rate limiter error:', err);
  });
} catch (err) {
  console.warn('Redis unavailable for rate limiting, using in-memory store');
  redisClient = null;
}

// ─── Rate Limit Tiers ────────────────────────────────────────────────────────

const RATE_LIMIT_TIERS = {
  PUBLIC: {
    windowMs: 60000, // 1 minute
    max: 20, // 20 requests per minute
    tier: 'public',
  },
  BASIC: {
    windowMs: 60000,
    max: 60,
    tier: 'basic',
  },
  PREMIUM: {
    windowMs: 60000,
    max: 200,
    tier: 'premium',
  },
  VIP: {
    windowMs: 60000,
    max: 1000,
    tier: 'vip',
  },
  ADMIN: {
    windowMs: 60000,
    max: 10000,
    tier: 'admin',
  },
};

// ─── Key Generators ──────────────────────────────────────────────────────────

/**
 * Generate rate limit key based on user ID
 */
function keyGeneratorUser(req) {
  const userId = req.user?.sub || req.user?.userId || req.headers['x-user-id'] || req.body?.userId;
  return userId ? `user:${userId}` : `ip:${req.ip}`;
}

/**
 * Generate rate limit key based on IP only
 */
function keyGeneratorIP(req) {
  return `ip:${req.ip}`;
}

/**
 * Generate rate limit key based on API key
 */
function keyGeneratorApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  return apiKey ? `apikey:${apiKey}` : keyGeneratorIP(req);
}

// ─── Rate Limit Handler ──────────────────────────────────────────────────────

/**
 * Custom handler for rate limit exceeded
 */
function rateLimitHandler(req, res) {
  const retryAfter = req.rateLimit?.resetTime 
    ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    : 60;

  res.status(429).json({
    success: false,
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    limit: req.rateLimit?.limit,
    current: req.rateLimit?.current,
    remaining: 0,
    resetTime: req.rateLimit?.resetTime,
    retryAfter,
  });
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req) {
  // Skip for internal requests
  if (req.headers['x-internal-request'] === 'true') {
    return true;
  }

  // Skip for whitelisted IPs
  const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  if (whitelist.includes(req.ip)) {
    return true;
  }

  return false;
}

// ─── Rate Limiter Factory ────────────────────────────────────────────────────

/**
 * Create rate limiter with specified tier
 */
function createRateLimiter(tierConfig, options = {}) {
  const config = {
    windowMs: tierConfig.windowMs,
    max: tierConfig.max,
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: rateLimitHandler,
    skip: skipRateLimit,
    keyGenerator: options.keyGenerator || keyGeneratorUser,
    ...options,
  };

  // Use Redis store if available
  if (redisClient && !options.skipRedis) {
    config.store = new RedisStore({
      // @ts-expect-error - Known issue with the library not matching key names
      client: redisClient,
      prefix: 'rl:',
    });
  }

  return rateLimit(config);
}

// ─── Tier-Specific Limiters ─────────────────────────────────────────────────

/**
 * Public tier rate limiter (most restrictive)
 */
const publicRateLimiter = createRateLimiter(RATE_LIMIT_TIERS.PUBLIC, {
  keyGenerator: keyGeneratorIP,
});

/**
 * Basic tier rate limiter
 */
const basicRateLimiter = createRateLimiter(RATE_LIMIT_TIERS.BASIC);

/**
 * Premium tier rate limiter
 */
const premiumRateLimiter = createRateLimiter(RATE_LIMIT_TIERS.PREMIUM);

/**
 * VIP tier rate limiter
 */
const vipRateLimiter = createRateLimiter(RATE_LIMIT_TIERS.VIP);

/**
 * Admin tier rate limiter (least restrictive)
 */
const adminRateLimiter = createRateLimiter(RATE_LIMIT_TIERS.ADMIN);

// ─── Dynamic Tier Selection ──────────────────────────────────────────────────

/**
 * Dynamic rate limiter that selects tier based on user
 */
async function dynamicRateLimiter(req, res, next) {
  try {
    // Determine user tier
    const tier = await getUserTier(req);

    // Select appropriate limiter
    let limiter;
    switch (tier) {
      case 'admin':
        limiter = adminRateLimiter;
        break;
      case 'vip':
        limiter = vipRateLimiter;
        break;
      case 'premium':
        limiter = premiumRateLimiter;
        break;
      case 'basic':
        limiter = basicRateLimiter;
        break;
      default:
        limiter = publicRateLimiter;
    }

    // Apply rate limit
    limiter(req, res, next);
  } catch (err) {
    console.error('Dynamic rate limiter error:', err);
    // Fall back to public tier on error
    publicRateLimiter(req, res, next);
  }
}

/**
 * Get user tier from database or permissions
 */
async function getUserTier(req) {
  try {
    const userId = req.user?.sub || req.user?.userId || req.headers['x-user-id'];

    if (!userId) {
      return 'public';
    }

    // Check if admin
    if (req.user?.role === 'admin' || req.headers['x-user-role'] === 'admin') {
      return 'admin';
    }

    // Try to get tier from permission service
    const permissionService = require('../services/permissionService');
    const { data: permissions } = await permissionService.getUserPermissions(userId);

    // Map permission tier to rate limit tier
    if (permissions.tier >= 5) return 'admin';
    if (permissions.tier >= 4) return 'vip';
    if (permissions.tier >= 3) return 'premium';
    if (permissions.tier >= 2) return 'basic';
    
    return 'basic';
  } catch (err) {
    console.error('Failed to get user tier:', err);
    return 'basic';
  }
}

// ─── Endpoint-Specific Limiters ─────────────────────────────────────────────

/**
 * Strict rate limiter for order placement
 */
const orderPlacementLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 30, // 30 orders per minute max
  tier: 'order-placement',
});

/**
 * Lenient rate limiter for market data
 */
const marketDataLimiter = createRateLimiter({
  windowMs: 60000,
  max: 120, // 120 requests per minute
  tier: 'market-data',
});

/**
 * Very strict rate limiter for withdrawal operations
 */
const withdrawalLimiter = createRateLimiter({
  windowMs: 3600000, // 1 hour
  max: 10, // 10 withdrawals per hour
  tier: 'withdrawal',
});

// ─── Rate Limit Info Middleware ──────────────────────────────────────────────

/**
 * Add rate limit headers to all responses
 */
function addRateLimitHeaders(req, res, next) {
  // Store original json function
  const originalJson = res.json.bind(res);

  // Override json function to add headers
  res.json = function (data) {
    if (req.rateLimit) {
      res.set({
        'X-RateLimit-Limit': req.rateLimit.limit,
        'X-RateLimit-Remaining': req.rateLimit.remaining,
        'X-RateLimit-Reset': req.rateLimit.resetTime
          ? new Date(req.rateLimit.resetTime).toISOString()
          : 'unknown',
      });
    }

    return originalJson(data);
  };

  next();
}

// ─── Custom Rate Limiter ─────────────────────────────────────────────────────

/**
 * Create custom rate limiter with specific configuration
 */
function customRateLimiter(options) {
  const defaultOptions = {
    windowMs: 60000,
    max: 100,
    keyGenerator: keyGeneratorUser,
    handler: rateLimitHandler,
    skip: skipRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
  };

  const config = { ...defaultOptions, ...options };

  if (redisClient && !options.skipRedis) {
    config.store = new RedisStore({
      // @ts-expect-error - Known issue with the library
      client: redisClient,
      prefix: 'rl:custom:',
    });
  }

  return rateLimit(config);
}

// ─── Rate Limit Stats ────────────────────────────────────────────────────────

/**
 * Get rate limit statistics for a key
 */
async function getRateLimitStats(key) {
  if (!redisClient) {
    return { error: 'Redis not available' };
  }

  try {
    const data = await redisClient.get(`rl:${key}`);
    return data ? JSON.parse(data) : { requests: 0 };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Reset rate limit for a specific key
 */
async function resetRateLimit(key) {
  if (!redisClient) {
    return { success: false, error: 'Redis not available' };
  }

  try {
    await redisClient.del(`rl:${key}`);
    return { success: true, message: `Rate limit reset for ${key}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  // Tier-based limiters
  publicRateLimiter,
  basicRateLimiter,
  premiumRateLimiter,
  vipRateLimiter,
  adminRateLimiter,
  dynamicRateLimiter,

  // Endpoint-specific limiters
  orderPlacementLimiter,
  marketDataLimiter,
  withdrawalLimiter,

  // Utilities
  addRateLimitHeaders,
  customRateLimiter,
  createRateLimiter,
  getRateLimitStats,
  resetRateLimit,

  // Exports for configuration
  RATE_LIMIT_TIERS,
  keyGeneratorUser,
  keyGeneratorIP,
  keyGeneratorApiKey,
};
