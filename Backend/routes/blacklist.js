/**
 * @file routes/blacklist.js
 * @description Blacklist management route handler for GateDelay.
 *
 * Provides Express router middleware for:
 *   - POST /add           — Add an identifier to the blacklist
 *   - POST /remove         — Remove an identifier from the blacklist
 *   - GET  /check/:identifier — Check if an identifier is blacklisted
 *   - POST /batch-add      — Batch add identifiers to the blacklist
 *   - POST /batch-remove   — Batch remove identifiers from the blacklist
 *   - GET  /count           — Get the total number of blacklisted entries
 *   - GET  /report          — Generate a blacklist report for a date range
 *
 * ## Boot Requirements
 *
 * This module requires `express` (^4.x) to be installed.  It is listed as a
 * direct dependency in `Backend/package.json`.
 *
 * The returned factory function accepts two injected dependencies:
 *   1. `blacklistService` — An instance of `../services/blacklistService`
 *   2. `auth`             — An auth middleware object with a `.middleware` property
 *
 * All mutation routes are guarded by `auth.middleware`. When `auth` is not
 * provided at mount time (e.g. during local development), routes fall back to
 * unauthenticated access with a console warning.  **Phase 2+**: crash hard on
 * missing auth for compliance.
 *
 * ## Usage (mount in an Express app)
 *
 *   const blacklistRoute = require('./routes/blacklist');
 *   const BlacklistService = require('./services/blacklistService');
 *   const blacklistService = new BlacklistService(redisClient);
 *   app.use('/api/blacklist', blacklistRoute(blacklistService, auth));
 *
 * ## Related Files
 *
 *   - Backend/services/blacklistService.js  — Service layer (Redis-backed)
 *   - Backend/package.json                  — `test:blacklist` script
 */

const MODULE_NAME = 'blacklist.js';

// ----- Boot-time dependency check -------------------------------------------
let express;
try {
  express = require('express');
} catch (err) {
  console.error(
    `[${MODULE_NAME}] FATAL: Failed to require 'express'. ` +
    `Is it installed? Run: npm install express`
  );
  throw err;
}

const router = express.Router();

// ----- Startup logging ------------------------------------------------------
console.log(`[${MODULE_NAME}] Initializing blacklist route handler...`);
console.log(
  `[${MODULE_NAME}] Routes: POST /add, POST /remove, GET /check/:identifier, ` +
  `POST /batch-add, POST /batch-remove, GET /count, GET /report`
);
console.log(`[${MODULE_NAME}] Boot check passed — module loaded successfully`);

/**
 * Factory that returns a configured Express router for blacklist operations.
 *
 * @param {object} blacklistService — BlacklistService instance
 * @param {object} auth             — Auth middleware object with `.middleware`
 * @returns {express.Router}
 */
module.exports = (blacklistService, auth) => {
  if (!blacklistService) {
    console.warn(
      `[${MODULE_NAME}] WARNING: blacklistService not provided — ` +
      `blacklist routes will throw on use until a service is injected.`
    );
  }

  // Auth guard: delegates to real middleware when available, otherwise
  // passes through with a warning.  Phase 2+ should make this fail-closed.
  let guardWarned = false;
  const guard = (req, res, next) => {
    if (auth && auth.middleware) {
      return auth.middleware(req, res, next);
    }
    if (!guardWarned) {
      console.warn(
        `[${MODULE_NAME}] WARNING: auth middleware was not provided at mount time — ` +
        `mutation routes are unprotected. ` +
        `(Phase 2+: must fail-closed for compliance.)`
      );
      guardWarned = true;
    }
    next();
  };

  // POST /add — Add an identifier to the blacklist
  router.post('/add', guard, async (req, res) => {
    try {
      const { identifier, reason, expiryDays } = req.body;
      const result = await blacklistService.addToBlacklist(identifier, reason, expiryDays);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /remove — Remove an identifier from the blacklist
  router.post('/remove', guard, async (req, res) => {
    try {
      const { identifier } = req.body;
      const result = await blacklistService.removeFromBlacklist(identifier);
      res.json(result);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  // GET /check/:identifier — Check if an identifier is blacklisted
  router.get('/check/:identifier', async (req, res) => {
    try {
      const result = await blacklistService.isBlacklisted(req.params.identifier);
      res.json({ blacklisted: !!result, entry: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /batch-add — Batch add identifiers
  router.post('/batch-add', guard, async (req, res) => {
    try {
      const { identifiers, reason } = req.body;
      const results = await blacklistService.batchAddToBlacklist(identifiers, reason);
      res.status(201).json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /batch-remove — Batch remove identifiers
  router.post('/batch-remove', guard, async (req, res) => {
    try {
      const { identifiers } = req.body;
      const results = await blacklistService.batchRemoveFromBlacklist(identifiers);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /count — Get total blacklisted entries
  router.get('/count', guard, async (req, res) => {
    try {
      const count = await blacklistService.getBlacklistCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /report — Generate a blacklist report for a date range
  router.get('/report', guard, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await blacklistService.generateReport(
        new Date(startDate),
        new Date(endDate)
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log(
    `[${MODULE_NAME}] Router mounted and ready — 7 blacklist endpoints registered`
  );

  return router;
};
