/**
 * @file routes/aml.js
 * @description Anti-Money Laundering (AML) compliance route handler for GateDelay.
 *
 * Provides Express router middleware for:
 *   - POST /screen       — Screen a user against watchlists
 *   - POST /flag          — Record suspicious-activity flags
 *   - GET  /report/:userId — Generate a screening report for a date range
 *   - POST /file-report   — Submit regulatory filings
 *
 * ## Boot Requirements
 *
 * This module requires `express` (^4.x) to be installed.  It is listed as a
 * direct dependency in `Backend/package.json`.
 *
 * The returned factory function accepts two injected dependencies:
 *   1. `amlService` — An instance of `../services/amlService` (AMLService)
 *   2. `auth`       — An auth middleware object with a `.middleware` property
 *
 * All routes are guarded by `auth.middleware`. When `auth` is not provided
 * at mount time (e.g. during local development), routes fall back to
 * unauthenticated access with a console warning — see the factory-function
 * guards below.  **Phase 2+**: crash hard on missing auth for compliance.
 *
 * ## Usage (mount in an Express app)
 *
 *   const amlRoute = require('./routes/aml');
 *   const AMLService = require('./services/amlService');
 *   const amlService = new AMLService(db, amlProvider);
 *   app.use('/api/aml', amlRoute(amlService, auth));
 *
 * ## Related Files
 *
 *   - Backend/services/amlService.js  — Service layer with threat model docs
 *   - Backend/test/aml.smoke.test.js  — Smoke test for module load
 *   - Backend/package.json            — `test:aml` script
 */

const MODULE_NAME = 'aml.js';

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
console.log(
  `[${MODULE_NAME}] Initializing AML compliance route handler...`
);
console.log(
  `[${MODULE_NAME}] Routes: POST /screen, POST /flag, GET /report/:userId, POST /file-report`
);
console.log(
  `[${MODULE_NAME}] Boot check passed — module loaded successfully`
);

/**
 * Factory that returns a configured Express router for AML operations.
 *
 * @param {object} amlService — AMLService instance (see ../services/amlService.js)
 * @param {object} auth       — Auth middleware object with `.middleware` property
 * @returns {express.Router}
 */
module.exports = (amlService, auth) => {
  if (!amlService) {
    console.warn(
      `[${MODULE_NAME}] WARNING: amlService not provided — ` +
      `AML routes will throw on use until a service is injected.`
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
        `all AML routes are unprotected. ` +
        `(Phase 2+: must fail-closed for compliance.)`
      );
      guardWarned = true;
    }
    next();
  };

  // POST /screen — Screen a user against AML watchlists
  router.post('/screen', guard, async (req, res) => {
    try {
      const { userId, userDetails } = req.body;
      const result = await amlService.screenUser(userId, userDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /flag — Record suspicious activity
  router.post('/flag', guard, async (req, res) => {
    try {
      const { userId, activity } = req.body;
      const flag = await amlService.flagSuspiciousActivity(userId, activity);
      res.status(201).json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /report/:userId — Generate screening report
  router.get('/report/:userId', guard, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await amlService.generateScreeningReport(
        req.params.userId,
        startDate,
        endDate
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /file-report — Submit regulatory filings
  router.post('/file-report', guard, async (req, res) => {
    try {
      const { userId } = req.body;
      const filing = await amlService.submitFilings(userId);
      res.status(201).json(filing);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log(
    `[${MODULE_NAME}] Router mounted and ready — 4 AML endpoints registered`
  );

  return router;
};
