const expensiveEndpointService = require('../services/expensiveEndpointService');

/**
 * EXPENSIVE ENDPOINT GUARD
 * Express middleware that detects and throttles abusive patterns on expensive endpoints.
 *
 * Uses multi-dimensional counters (user, wallet, IP, endpoint) to detect abuse
 * patterns that single-dimension rate limiting would miss.
 *
 * Fails open on errors (consistent with existing throttle middleware).
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  // Skip throttling for these paths
  skipPaths: ['/api/health', '/api/docs', '/api/docs/json'],
  // Skip throttling for these IPs (whitelist)
  whitelistIps: ['127.0.0.1', '::1'],
  // Include rate limit headers in response
  includeHeaders: true,
  // Custom handler for when abuse is detected
  onAbuseDetected: null,
  // Skip function
  skip: null,
};

/**
 * Create expensive endpoint guard middleware
 */
function expensiveEndpointGuard(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return async (req, res, next) => {
    try {
      // Skip if configured
      if (config.skip && config.skip(req)) {
        return next();
      }

      // Skip whitelisted paths
      if (config.skipPaths.some((p) => req.path.startsWith(p))) {
        return next();
      }

      // Skip whitelisted IPs
      const clientIp = expensiveEndpointService.getClientIp(req);
      if (config.whitelistIps.includes(clientIp)) {
        return next();
      }

      // Track request and check for abuse
      const result = await expensiveEndpointService.trackRequest(req);

      // Add headers
      if (config.includeHeaders) {
        res.setHeader('X-RateLimit-Limit', result.rule.limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, result.rule.limit - result.counters.endpoint));
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.rule.window * 1000).toISOString());
        res.setHeader('X-Abuse-Dimension', result.rule.cost);
      }

      if (!result.allowed) {
        // Log abuse detection
        console.warn(
          `[ExpensiveEndpointGuard] Abuse detected: ${result.reason} - ${result.detail}`,
          {
            ip: clientIp,
            endpoint: req.method + ' ' + req.path,
            user: req.user?.sub || req.user?.userId || 'anonymous',
            wallet: req.user?.walletAddress || req.headers['x-wallet-address'] || 'none',
          }
        );

        if (config.onAbuseDetected) {
          config.onAbuseDetected(req, res, result);
        }

        res.setHeader('Retry-After', Math.ceil(result.rule.window / 2));
        return res.status(429).json({
          success: false,
          error: 'Abusive pattern detected',
          code: result.reason,
          detail: result.detail,
          limit: result.rule.limit,
          retryAfter: Math.ceil(result.rule.window / 2),
          resetTime: new Date(Date.now() + result.rule.window * 1000).toISOString(),
        });
      }

      next();
    } catch (error) {
      console.error('[ExpensiveEndpointGuard] Middleware error:', error);
      // Fail open
      next();
    }
  };
}

/**
 * Strict guard for high-cost endpoints only
 */
function strictExpensiveGuard(overrides = {}) {
  return expensiveEndpointGuard({
    skipPaths: ['/api/health'],
    ...overrides,
  });
}

module.exports = {
  expensiveEndpointGuard,
  strictExpensiveGuard,
  expensiveEndpointService,
};
const deprecationService = require('../services/deprecationService');

const deprecationMiddleware = (options = {}) => {
  return (req, res, next) => {
    const endpoint = `${req.method} ${req.path}`;
    const status = deprecationService.getDeprecationStatus(endpoint);

    if (!status.deprecated) {
      return next();
    }

    if (status.sunset) {
      return res.status(410).json({
        error: 'Gone',
        message: `This endpoint has been sunset and is no longer available.`,
        alternative: status.alternative,
        migrationGuide: status.migrationGuide
      });
    }

    const userId = req.user?.id || req.ip;
    deprecationService.trackUsage(endpoint, userId, {
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent')
    });

    const warning = {
      'Deprecation': `This endpoint is deprecated and will be removed on ${status.sunsetDate.toISOString()}`,
      'Link': `<${status.migrationGuide}>; rel="deprecation"; type="text/html"`,
      'Sunset': status.sunsetDate.toISOString(),
      'Alternative': status.alternative
    };

    res.setHeader('Warning', `299 - "Deprecated: ${warning['Deprecation']}"`);
    res.setHeader('Deprecation', `true, sunset="${status.sunsetDate.toISOString()}"`);
    res.setHeader('Link', warning['Link']);

    res.setHeader('X-Deprecation-Warning', JSON.stringify({
      deprecated: true,
      sunsetDate: status.sunsetDate,
      alternative: status.alternative,
      daysUntilSunset: status.daysUntilSunset
    }));

    next();
  };
};

const markDeprecated = (endpoint, config) => {
  deprecationService.registerDeprecatedEndpoint(endpoint, config);
};

module.exports = {
  deprecationMiddleware,
  markDeprecated
};
