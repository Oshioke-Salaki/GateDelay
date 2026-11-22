/**
 * BACKWARD COMPATIBILITY MIDDLEWARE
 * Ensures backward compatibility for market API changes
 * Maps legacy endpoints to new implementations
 */

/**
 * Legacy endpoint mappings
 * Maps old paths to new paths and transformation logic
 */
const LEGACY_MAPPINGS = {
  // Old market endpoints
  '/market/ticker': {
    newPath: '/markets/ticker',
    method: 'GET',
    transform: {
      request: (data) => data,
      response: (data) => ({
        ...data,
        // Add legacy fields if needed
        success: true,
      }),
    },
  },
  '/market/orderbook': {
    newPath: '/markets/orderbook',
    method: 'GET',
    transform: {
      request: (data) => data,
      response: (data) => data,
    },
  },
  '/market/trades': {
    newPath: '/markets/trades/recent',
    method: 'GET',
    transform: {
      request: (data) => data,
      response: (data) => data,
    },
  },
  '/trading/place-order': {
    newPath: '/orders/create',
    method: 'POST',
    transform: {
      request: (data) => ({
        symbol: data.pair || data.symbol,
        side: data.side || data.type,
        orderType: data.orderType || 'limit',
        price: data.price,
        quantity: data.amount || data.quantity,
      }),
      response: (data) => ({
        orderId: data.id,
        status: data.status,
        ...data,
      }),
    },
  },
  '/trading/cancel-order': {
    newPath: '/orders/cancel',
    method: 'DELETE',
    transform: {
      request: (data) => ({
        orderId: data.orderId || data.order_id,
      }),
      response: (data) => data,
    },
  },
};

/**
 * Field name mappings for backward compatibility
 */
const FIELD_MAPPINGS = {
  // Old field name -> New field name
  'order_id': 'orderId',
  'user_id': 'userId',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'order_type': 'orderType',
  'total_amount': 'totalAmount',
  'filled_amount': 'filledAmount',
  'remaining_amount': 'remainingAmount',
  'avg_price': 'avgPrice',
  'market_price': 'marketPrice',
};

/**
 * Reverse field mappings (new -> old)
 */
const REVERSE_FIELD_MAPPINGS = Object.entries(FIELD_MAPPINGS).reduce(
  (acc, [oldField, newField]) => {
    acc[newField] = oldField;
    return acc;
  },
  {}
);

/**
 * Check if endpoint is legacy
 */
function isLegacyEndpoint(path) {
  return Object.keys(LEGACY_MAPPINGS).some(legacy => path.startsWith(legacy));
}

/**
 * Get legacy mapping for path
 */
function getLegacyMapping(path) {
  for (const [legacyPath, mapping] of Object.entries(LEGACY_MAPPINGS)) {
    if (path.startsWith(legacyPath)) {
      return { legacyPath, ...mapping };
    }
  }
  return null;
}

/**
 * Transform field names in object (recursive)
 */
function transformFields(obj, mappings) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformFields(item, mappings));
  }

  const transformed = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = mappings[key] || key;
    transformed[newKey] = transformFields(value, mappings);
  }

  return transformed;
}

/**
 * Backward compatibility middleware
 */
function backwardCompatMiddleware(options = {}) {
  const config = {
    warnDeprecated: options.warnDeprecated !== false,
    logUsage: options.logUsage !== false,
    strictMode: options.strictMode || false,
    ...options,
  };

  return (req, res, next) => {
    const legacyMapping = getLegacyMapping(req.path);

    if (!legacyMapping) {
      return next();
    }

    // Log usage
    if (config.logUsage) {
      console.warn(`[Backward Compat] Legacy endpoint accessed: ${req.method} ${req.path}`);
    }

    // Add deprecation headers
    if (config.warnDeprecated) {
      res.setHeader('X-Endpoint-Deprecated', 'true');
      res.setHeader('X-Endpoint-Legacy', legacyMapping.legacyPath);
      res.setHeader('X-Endpoint-New', legacyMapping.newPath);
      res.setHeader('X-Deprecation-Warning', 
        `This endpoint is deprecated. Please use ${legacyMapping.newPath} instead.`);
    }

    // Transform request
    if (legacyMapping.transform && legacyMapping.transform.request) {
      req.body = legacyMapping.transform.request(req.body);
      req.query = legacyMapping.transform.request(req.query);
    }

    // Transform field names in request
    req.body = transformFields(req.body, FIELD_MAPPINGS);
    req.query = transformFields(req.query, FIELD_MAPPINGS);

    // Store original path for routing
    req.legacyPath = req.path;
    req.originalPath = req.path;
    
    // Update path to new endpoint
    req.url = req.url.replace(legacyMapping.legacyPath, legacyMapping.newPath);
    req.path = legacyMapping.newPath;

    // Intercept response to transform back to legacy format
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      let transformed = data;

      // Apply custom response transform
      if (legacyMapping.transform && legacyMapping.transform.response) {
        transformed = legacyMapping.transform.response(transformed);
      }

      // Transform field names back to legacy format
      transformed = transformFields(transformed, REVERSE_FIELD_MAPPINGS);

      // Add compatibility notice
      if (config.warnDeprecated && transformed && typeof transformed === 'object') {
        transformed._compatibility = {
          legacy: true,
          legacyEndpoint: legacyMapping.legacyPath,
          newEndpoint: legacyMapping.newPath,
          message: 'This endpoint is deprecated. Please migrate to the new endpoint.',
        };
      }

      return originalJson(transformed);
    };

    next();
  };
}

/**
 * Legacy request handler middleware
 * Maintains deprecated endpoint functionality
 */
function handleLegacyRequest(legacyHandlers = {}) {
  return (req, res, next) => {
    const handler = legacyHandlers[req.originalPath || req.path];
    
    if (handler) {
      return handler(req, res, next);
    }

    next();
  };
}

/**
 * Compatibility warning middleware
 * Adds warnings without blocking requests
 */
function compatibilityWarning(options = {}) {
  const warnings = options.warnings || {
    '/market/*': {
      message: 'Market endpoints moved to /markets/*',
      sunset: '2025-12-31',
      migration: 'https://docs.example.com/migration/markets',
    },
    '/trading/*': {
      message: 'Trading endpoints moved to /orders/*',
      sunset: '2025-12-31',
      migration: 'https://docs.example.com/migration/orders',
    },
  };

  return (req, res, next) => {
    for (const [pattern, warning] of Object.entries(warnings)) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(req.path)) {
        res.setHeader('X-Compatibility-Warning', warning.message);
        if (warning.sunset) {
          res.setHeader('X-Sunset-Date', warning.sunset);
        }
        if (warning.migration) {
          res.setHeader('X-Migration-Guide', warning.migration);
        }
        break;
      }
    }
    next();
  };
}

/**
 * Graceful migration helper
 * Provides migration path information
 */
function migrationGuide(migrations = {}) {
  return (req, res) => {
    const guide = {
      success: true,
      migrations: [],
    };

    for (const [oldPath, newPath] of Object.entries(migrations)) {
      guide.migrations.push({
        legacy: oldPath,
        current: newPath,
        status: 'deprecated',
        sunset: '2025-12-31',
      });
    }

    res.json(guide);
  };
}

/**
 * Add backward compatibility mappings
 */
function addCompatMapping(legacyPath, newPath, transform = {}) {
  LEGACY_MAPPINGS[legacyPath] = {
    newPath,
    method: transform.method || 'GET',
    transform: {
      request: transform.request || ((data) => data),
      response: transform.response || ((data) => data),
    },
  };
}

/**
 * Add field mapping
 */
function addFieldMapping(oldField, newField) {
  FIELD_MAPPINGS[oldField] = newField;
  REVERSE_FIELD_MAPPINGS[newField] = oldField;
}

module.exports = {
  backwardCompatMiddleware,
  handleLegacyRequest,
  compatibilityWarning,
  migrationGuide,
  addCompatMapping,
  addFieldMapping,
  isLegacyEndpoint,
  LEGACY_MAPPINGS,
  FIELD_MAPPINGS,
};
const ddosProtection = require('../services/ddosProtection');

/**
 * DDOS GUARD MIDDLEWARE
 * Express middleware for DDoS protection
 * Tracks requests, detects attacks, and enforces blacklists
 */

/**
 * Extract client IP from request
 * Checks X-Forwarded-For, X-Real-IP, and socket
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * DDoS protection middleware
 * @param {object} options - Configuration options
 * @returns {Function} Express middleware
 */
function ddosGuard(options = {}) {
  const config = {
    autoMitigate: options.autoMitigate !== false, // Enable by default
    blockOnAttack: options.blockOnAttack !== false,
    logAll: options.logAll || false,
    whitelist: options.whitelist || [],
    ...options,
  };

  return async (req, res, next) => {
    try {
      const ip = getClientIP(req);

      // Skip whitelisted IPs
      if (config.whitelist.includes(ip)) {
        return next();
      }

      // Check blacklist first
      const blacklistStatus = await ddosProtection.isBlacklisted(ip);
      if (blacklistStatus.blacklisted) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          reason: blacklistStatus.reason,
          retryAfter: blacklistStatus.expiresIn,
          ip: config.exposeIP ? ip : undefined,
        });
      }

      // Track request
      const metadata = {
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        bodySize: req.headers['content-length'] || 0,
      };

      await ddosProtection.trackRequest(ip, metadata);

      // Detect attack patterns
      const detection = await ddosProtection.detectAttack(ip);

      // Auto-mitigation
      if (config.autoMitigate && (detection.isAttack || detection.isSuspicious)) {
        const mitigation = await ddosProtection.mitigate(ip, detection);

        if (config.logAll || detection.isAttack) {
          console.warn('[DDoS Guard] Attack detected:', {
            ip,
            severity: detection.severity,
            patterns: detection.patterns.map(p => p.name),
            actions: mitigation.actions,
          });
        }

        // Block if configured
        if (config.blockOnAttack && detection.isAttack) {
          return res.status(429).json({
            success: false,
            error: 'Request blocked',
            code: 'DDOS_DETECTED',
            ip: config.exposeIP ? ip : undefined,
          });
        }
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', ddosProtection.config.requestsPerMinute);
      res.setHeader('X-RateLimit-Remaining', 
        Math.max(0, ddosProtection.config.requestsPerMinute - detection.metrics.rpm));
      
      next();
    } catch (error) {
      console.error('[DDoS Guard] Middleware error:', error);
      // Fail open - don't block requests on error
      next();
    }
  };
}

/**
 * Strict DDoS guard for sensitive endpoints
 * More aggressive protection with lower thresholds
 */
function strictDDoSGuard(options = {}) {
  return ddosGuard({
    ...options,
    autoMitigate: true,
    blockOnAttack: true,
    requestsPerSecond: 10,
    requestsPerMinute: 100,
  });
}

/**
 * Health check — pings the underlying ddosProtection service.
 * @returns {Promise<boolean>} true when the service responds
 */
async function healthCheck() {
  try {
    await ddosProtection.isBlacklisted('__healthcheck__');
    return true;
  } catch {
    return false;
  }
}

module.exports = { ddosGuard, strictDDoSGuard, healthCheck };
