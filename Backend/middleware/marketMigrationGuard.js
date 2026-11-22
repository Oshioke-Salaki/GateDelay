/**
 * marketMigrationGuard.js — Express middleware for protecting market endpoints.
 *
 * Ensures market routes remain disabled or fail fast with HTTP 503 until
 * database migration integrity is verified.
 *
 * Closes #919
 */

'use strict';

const marketMigrationValidator = require('../services/marketMigrationValidator');

let cachedStatus = null;

/**
 * Checks market migration status with optional caching.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<boolean>}
 */
async function checkMigrationStatus(forceRefresh = false) {
  if (cachedStatus !== null && !forceRefresh) {
    return cachedStatus;
  }
  try {
    const report = await marketMigrationValidator.validateMarketMigrations();
    cachedStatus = report.valid;
    return cachedStatus;
  } catch {
    cachedStatus = false;
    return false;
  }
}

/**
 * Resets the cached migration check state (useful for tests).
 */
function resetMigrationGuardCache() {
  cachedStatus = null;
}

/**
 * Express middleware that intercepts requests to market endpoints and returns 503
 * if market migrations are missing or unapplied.
 */
function marketMigrationGuard() {
  return async (req, res, next) => {
    const pathLower = (req.path || req.originalUrl || '').toLowerCase();
    const isMarketEndpoint = pathLower.includes('/markets') || pathLower.includes('/market');

    if (isMarketEndpoint) {
      const isValid = await checkMigrationStatus();
      if (!isValid) {
        return res.status(503).json({
          success: false,
          error: 'Market endpoints disabled: required database migrations are pending or missing.',
          code: 'MARKET_MIGRATIONS_PENDING',
          requestId: req.requestId,
        });
      }
    }
    next();
  };
}

module.exports = {
  marketMigrationGuard,
  checkMigrationStatus,
  resetMigrationGuardCache,
};
