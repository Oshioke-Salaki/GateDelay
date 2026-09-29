/**
 * RATE LIMIT CONFIGURATION
 * Central configuration for all rate limiting rules and tiers
 */

module.exports = {
  // ─── Tier Definitions ──────────────────────────────────────────────────────

  tiers: {
    PUBLIC: {
      name: 'Public',
      requestsPerMinute: 20,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 5, // Max burst requests
      windowMs: 60000, // 1 minute
    },

    BASIC: {
      name: 'Basic',
      requestsPerMinute: 60,
      requestsPerHour: 3000,
      requestsPerDay: 50000,
      burstLimit: 10,
      windowMs: 60000,
    },

    PREMIUM: {
      name: 'Premium',
      requestsPerMinute: 200,
      requestsPerHour: 10000,
      requestsPerDay: 200000,
      burstLimit: 30,
      windowMs: 60000,
    },

    VIP: {
      name: 'VIP',
      requestsPerMinute: 1000,
      requestsPerHour: 50000,
      requestsPerDay: 1000000,
      burstLimit: 100,
      windowMs: 60000,
    },

    ADMIN: {
      name: 'Admin',
      requestsPerMinute: 10000,
      requestsPerHour: 500000,
      requestsPerDay: 10000000,
      burstLimit: 1000,
      windowMs: 60000,
    },
  },

  // ─── Endpoint-Specific Limits ──────────────────────────────────────────────

  endpoints: {
    // Trading endpoints
    placeOrder: {
      PUBLIC: { max: 10, windowMs: 60000 }, // 10/min
      BASIC: { max: 30, windowMs: 60000 }, // 30/min
      PREMIUM: { max: 100, windowMs: 60000 }, // 100/min
      VIP: { max: 500, windowMs: 60000 }, // 500/min
      ADMIN: { max: 10000, windowMs: 60000 }, // No practical limit
    },

    cancelOrder: {
      PUBLIC: { max: 15, windowMs: 60000 },
      BASIC: { max: 50, windowMs: 60000 },
      PREMIUM: { max: 200, windowMs: 60000 },
      VIP: { max: 1000, windowMs: 60000 },
      ADMIN: { max: 10000, windowMs: 60000 },
    },

    // Market data endpoints
    marketData: {
      PUBLIC: { max: 30, windowMs: 60000 },
      BASIC: { max: 120, windowMs: 60000 },
      PREMIUM: { max: 600, windowMs: 60000 },
      VIP: { max: 3000, windowMs: 60000 },
      ADMIN: { max: 10000, windowMs: 60000 },
    },

    orderBook: {
      PUBLIC: { max: 20, windowMs: 60000 },
      BASIC: { max: 100, windowMs: 60000 },
      PREMIUM: { max: 500, windowMs: 60000 },
      VIP: { max: 2000, windowMs: 60000 },
      ADMIN: { max: 10000, windowMs: 60000 },
    },

    // Account endpoints
    balance: {
      PUBLIC: { max: 30, windowMs: 60000 },
      BASIC: { max: 60, windowMs: 60000 },
      PREMIUM: { max: 300, windowMs: 60000 },
      VIP: { max: 1000, windowMs: 60000 },
      ADMIN: { max: 10000, windowMs: 60000 },
    },

    // Withdrawal/deposit (more restrictive)
    withdrawal: {
      PUBLIC: { max: 3, windowMs: 3600000 }, // 3/hour
      BASIC: { max: 10, windowMs: 3600000 }, // 10/hour
      PREMIUM: { max: 50, windowMs: 3600000 }, // 50/hour
      VIP: { max: 200, windowMs: 3600000 }, // 200/hour
      ADMIN: { max: 1000, windowMs: 3600000 },
    },

    deposit: {
      PUBLIC: { max: 5, windowMs: 3600000 },
      BASIC: { max: 20, windowMs: 3600000 },
      PREMIUM: { max: 100, windowMs: 3600000 },
      VIP: { max: 500, windowMs: 3600000 },
      ADMIN: { max: 1000, windowMs: 3600000 },
    },

    // Authentication endpoints
    login: {
      PUBLIC: { max: 5, windowMs: 300000 }, // 5 per 5 minutes
      BASIC: { max: 5, windowMs: 300000 },
      PREMIUM: { max: 5, windowMs: 300000 },
      VIP: { max: 10, windowMs: 300000 },
      ADMIN: { max: 20, windowMs: 300000 },
    },

    register: {
      PUBLIC: { max: 3, windowMs: 3600000 }, // 3 per hour
      BASIC: { max: 3, windowMs: 3600000 },
      PREMIUM: { max: 3, windowMs: 3600000 },
      VIP: { max: 5, windowMs: 3600000 },
      ADMIN: { max: 10, windowMs: 3600000 },
    },

    // API key management
    createApiKey: {
      PUBLIC: { max: 2, windowMs: 86400000 }, // 2 per day
      BASIC: { max: 5, windowMs: 86400000 }, // 5 per day
      PREMIUM: { max: 20, windowMs: 86400000 },
      VIP: { max: 100, windowMs: 86400000 },
      ADMIN: { max: 1000, windowMs: 86400000 },
    },
  },

  // ─── IP-Based Limits ───────────────────────────────────────────────────────

  ipLimits: {
    global: {
      max: 100, // 100 requests per minute per IP
      windowMs: 60000,
    },

    strict: {
      max: 30, // For sensitive endpoints
      windowMs: 60000,
    },
  },

  // ─── Whitelist ─────────────────────────────────────────────────────────────

  whitelist: {
    ips: process.env.RATE_LIMIT_WHITELIST?.split(',') || [],
    userIds: [],
    apiKeys: [],
  },

  // ─── Error Messages ────────────────────────────────────────────────────────

  messages: {
    exceeded: 'Rate limit exceeded. Please try again later.',
    tooManyRequests: 'Too many requests from this IP. Please slow down.',
    accountLocked: 'Account temporarily locked due to excessive requests.',
  },

  // ─── Headers ───────────────────────────────────────────────────────────────

  headers: {
    standard: true, // Use RateLimit-* headers
    legacy: false, // Disable X-RateLimit-* headers
    includeReset: true, // Include reset time in headers
  },

  // ─── Redis Configuration ───────────────────────────────────────────────────

  redis: {
    enabled: true,
    prefix: 'rl:',
    keyExpiration: 86400, // 24 hours
  },

  // ─── Cost-Based Rate Limiting ──────────────────────────────────────────────
  // Assign costs to different operations (for future implementation)

  costs: {
    read: 1, // Reading data
    write: 5, // Writing data (order, withdrawal)
    heavy: 10, // Heavy operations (analytics, exports)
  },

  // ─── Adaptive Rate Limiting ────────────────────────────────────────────────

  adaptive: {
    enabled: false, // Enable adaptive limits based on system load
    loadThreshold: 0.8, // Reduce limits at 80% system capacity
    reductionFactor: 0.5, // Reduce by 50% when threshold exceeded
  },
};
