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
