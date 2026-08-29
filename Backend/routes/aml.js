/**
 * @file aml.js
 * @module routes/aml
 * @description AML (Anti-Money Laundering) compliance route handler for
 *   GateDelay.  Exposes four endpoints that wrap the AmlService:
 *
 *   POST /aml/screen        — run a KYC/AML screen on a user
 *   POST /aml/flag          — flag a suspicious activity event
 *   GET  /aml/report/:userId — fetch a time-bounded screening report
 *   POST /aml/file-report   — submit a regulatory filing (SAR/STR)
 *
 * ---------------------------------------------------------------------------
 * THREAT MODEL & SECURITY ASSUMPTIONS  (issue #588)
 * ---------------------------------------------------------------------------
 *
 * 1. AUTHENTICATION & AUTHORISATION
 *    - Every route is protected by `auth.middleware` (JWT bearer token).
 *    - Assumption: the auth layer rejects unauthenticated and expired tokens
 *      before any handler body is executed.
 *    - Threat: token theft / session hijacking.
 *      Mitigation: short-lived JWTs + refresh-token rotation (handled in
 *      Backend/src/auth/).
 *
 * 2. INPUT VALIDATION
 *    - `userId` and `userDetails` are passed directly to amlService without
 *      sanitisation at the route layer.
 *    - Assumption: amlService validates and sanitises all inputs before
 *      persisting or forwarding them.
 *    - Threat: injection attacks (NoSQL injection via `userId`, prototype
 *      pollution via `userDetails` object).
 *      Mitigation: amlService must use parameterised queries / schema
 *      validation (e.g., Joi or class-validator).  TODO: add an explicit
 *      validation middleware here in Phase 2.
 *
 * 3. SENSITIVE DATA EXPOSURE
 *    - Screening reports and filing responses may contain PII and financial
 *      data.
 *    - Assumption: TLS is terminated at the load-balancer / reverse-proxy;
 *      all traffic between client and server is encrypted in transit.
 *    - Threat: data leakage via verbose error messages.
 *      Mitigation: only `error.message` is forwarded to the client.
 *      Stack traces and internal details are NOT exposed.  A global error
 *      logger should capture the full error server-side.
 *
 * 4. RATE LIMITING & ABUSE
 *    - AML endpoints are high-value targets for enumeration attacks
 *      (e.g., probing user IDs via GET /report/:userId).
 *    - Assumption: the NestJS ThrottlerModule applies a global rate limit of
 *      100 requests / 60 s (see Backend/src/app.module.ts).
 *    - Threat: brute-force enumeration of userId values.
 *      Mitigation: ensure per-route stricter limits are applied in Phase 2,
 *      and that `userId` values are non-sequential (UUIDs recommended).
 *
 * 5. PRIVILEGE ESCALATION
 *    - All four routes require only a valid auth token — there is no
 *      role-based check at the route layer.
 *    - Assumption: role enforcement is handled inside amlService
 *      (e.g., only COMPLIANCE_OFFICER role may call submitFilings).
 *    - Threat: a regular user calling POST /file-report.
 *      Mitigation: add role-guard middleware (RBAC) at the route level in
 *      Phase 2, aligned with the AccessControl.sol role hierarchy.
 *
 * 6. AUDIT LOGGING
 *    - All AML actions must produce an immutable audit trail for regulatory
 *      purposes (FATF, FinCEN).
 *    - Assumption: amlService persists an audit record for every call.
 *    - Threat: silent failure with no audit trail.
 *      Mitigation: wrap service calls in a try/catch that logs failures to
 *      the audit service even when the primary action fails.
 *
 * Phase 2 follow-up items:
 *   [ ] Add per-route input validation middleware (Joi/class-validator)
 *   [ ] Add RBAC role-guard for /flag and /file-report
 *   [ ] Add tighter rate limits on /report/:userId
 *   [ ] Replace generic 500 responses with structured error codes
 * ---------------------------------------------------------------------------
 */

console.log("[aml.js] Initializing AML compliance route handler...");
const express = require('express');
const router = express.Router();

module.exports = (amlService, auth) => {
  router.post('/screen', auth.middleware, async (req, res) => {
    try {
      const { userId, userDetails } = req.body;
      const result = await amlService.screenUser(userId, userDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/flag', auth.middleware, async (req, res) => {
    try {
      const { userId, activity } = req.body;
      const flag = await amlService.flagSuspiciousActivity(userId, activity);
      res.status(201).json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/report/:userId', auth.middleware, async (req, res) => {
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

  router.post('/file-report', auth.middleware, async (req, res) => {
    try {
      const { userId } = req.body;
      const filing = await amlService.submitFilings(userId);
      res.status(201).json(filing);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
