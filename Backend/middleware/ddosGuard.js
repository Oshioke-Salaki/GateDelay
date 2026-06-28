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

module.exports = { ddosGuard, strictDDoSGuard };
