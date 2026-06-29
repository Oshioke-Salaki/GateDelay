const permissionService = require('../services/permissionService');

/**
 * PERMISSIONS MIDDLEWARE
 * Express middleware factory that validates trade permissions before route execution.
 * Integrates with permissionService for tier checks, overrides, and delegations.
 *
 * Usage:
 *   router.post('/order', requirePermission('PLACE_ORDER'), handler);
 *   router.post('/margin', requirePermission('MARGIN_TRADE'), handler);
 */

/**
 * Extract userId from request.
 * Checks JWT payload (req.user), then x-user-id header, then body.
 * @param {object} req
 * @returns {string|null}
 */
function extractUserId(req) {
  return (
    req.user?.sub ||
    req.user?.userId ||
    req.headers['x-user-id'] ||
    req.body?.userId ||
    null
  );
}

/**
 * requirePermission
 * Returns middleware that blocks the request if the user lacks the given operation permission.
 *
 * @param {string} operation - One of OPERATION_REQUIREMENTS keys
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/orders', requirePermission('PLACE_ORDER'), placeOrderHandler);
 */
function requirePermission(operation) {
  return async (req, res, next) => {
    try {
      const userId = extractUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { allowed, reason } = await permissionService.validatePermission(userId, operation);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: `Permission denied for operation "${operation}": ${reason}`,
          code: 'PERMISSION_DENIED',
          operation,
        });
      }

      // Attach resolved userId for downstream handlers
      req.resolvedUserId = userId;
      next();
    } catch (error) {
      console.error('Permission middleware error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PERMISSION_ERROR',
      });
    }
  };
}

/**
 * requireMinTier
 * Blocks the request if the user's tier is below the specified minimum.
 * Use when you need a tier gate without tying it to a specific operation.
 *
 * @param {number} minTier - Minimum PERMISSION_TIERS value required
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/admin', requireMinTier(PERMISSION_TIERS.ADMIN), adminHandler);
 */
function requireMinTier(minTier) {
  return async (req, res, next) => {
    try {
      const userId = extractUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { data: record } = await permissionService.getUserPermissions(userId);

      if (record.tier < minTier) {
        return res.status(403).json({
          success: false,
          error: `Insufficient tier. Required: ${minTier}, current: ${record.tier}`,
          code: 'TIER_INSUFFICIENT',
          required: minTier,
          current: record.tier,
        });
      }

      req.resolvedUserId = userId;
      req.userTier = record.tier;
      next();
    } catch (error) {
      console.error('Tier middleware error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PERMISSION_ERROR',
      });
    }
  };
}

module.exports = { requirePermission, requireMinTier };
