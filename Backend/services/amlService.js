/**
 * @file amlService.js
 * @description Anti-Money Laundering (AML) screening, suspicious-activity
 * flagging, risk-score calculation, and regulatory filing for GateDelay.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREAT MODEL & SECURITY ASSUMPTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. TRUST BOUNDARY — Third-party AML provider
 *    ─────────────────────────────────────────
 *    Assumption: `amlProvider` is a trusted, contractually bound third party
 *    (e.g. Chainalysis, Elliptic, or similar).  Its responses are treated as
 *    authoritative for the purposes of `risk_level` and `matches`.
 *
 *    Threat: A compromised or spoofed provider could return manipulated
 *    risk levels (e.g. always returning "low") to launder flagged users
 *    through the system.
 *
 *    Mitigation (current): Provider is injected at construction — callers
 *    must supply a real provider and cannot swap it at runtime.
 *    Mitigation (Phase 2+): Add response-signature verification or
 *    dual-provider cross-checking before trusting screening results.
 *    Do not silently downgrade risk from a previously high screening.
 *
 * 2. TRUST BOUNDARY — Caller-supplied `userId` and `userDetails`
 *    ─────────────────────────────────────────────────────────────
 *    Assumption: The HTTP layer (`routes/aml.js`) enforces authentication
 *    via `auth.middleware` before reaching this service.  The `userId`
 *    passed in corresponds to the authenticated session and has not been
 *    tampered with by the request body.
 *
 *    Threat: An authenticated user supplying a different `userId` in the
 *    request body could trigger AML screening under another user's identity,
 *    potentially polluting their record or obscuring their own.
 *
 *    Mitigation (current): None in this service layer — it trusts the
 *    caller implicitly.
 *    Mitigation (Phase 2+): Route handlers must derive `userId` from the
 *    verified JWT/session token, not from `req.body`.
 *
 * 3. IN-MEMORY CACHE — `screeningCache`
 *    ────────────────────────────────────
 *    Assumption: A 1-hour cache TTL is acceptable for screening freshness.
 *    The cache is process-local and is lost on restart.
 *
 *    Threat: A user's risk profile can change within the cache window (e.g.
 *    they are added to a sanctions list after the last screen).  Serving a
 *    stale "low" result during that window creates a compliance gap.
 *
 *    Threat: Cache poisoning — if an attacker can influence the `userId`
 *    used as a cache key, they could serve another user's cached result
 *    under a fabricated key collision.
 *
 *    Mitigation (current): Cache key is namespaced (`aml_${userId}`),
 *    reducing collision surface.
 *    Mitigation (Phase 2+): Replace with a shared cache (Redis) with
 *    appropriate TTL tuning, and add a forced-refresh path for compliance
 *    events (sanctions list updates, manual overrides).
 *
 * 4. DATA SENSITIVITY — PII in screening payloads
 *    ───────────────────────────────────────────────
 *    Assumption: `userDetails.name`, `.email`, and `.country` are the only
 *    fields transmitted to the AML provider.  No additional PII (passport
 *    number, DOB, etc.) is sent unless explicitly extended.
 *
 *    Threat: Over-sharing — a future developer extending `screenUser` may
 *    inadvertently include more PII than the provider requires, violating
 *    data-minimisation obligations under GDPR / equivalent.
 *
 *    Mitigation (current): The provider payload is explicitly constructed
 *    (not spread from `userDetails`), limiting what is sent.
 *    Mitigation (Phase 2+): Add a schema/allowlist validation step before
 *    the provider call to enforce which fields may be transmitted.
 *
 * 5. REGULATORY FILING — `submitFilings`
 *    ────────────────────────────────────
 *    Assumption: Filing is a best-effort administrative action; the caller
 *    is responsible for ensuring the filing meets the requirements of the
 *    applicable jurisdiction (FinCEN, FATF, etc.).
 *
 *    Threat: The current implementation submits a `referenceId` and count
 *    of screenings but does not attach the actual screening data, matches,
 *    or flags to the filing record.  A regulator receiving only a count
 *    cannot reconstruct the audit trail.
 *
 *    Threat: No idempotency guard — calling `submitFilings` twice for the
 *    same user creates duplicate `regulatory_filings` rows, which could
 *    appear as inflated compliance activity.
 *
 *    Mitigation (Phase 2+): Attach a snapshot of relevant screenings and
 *    flags to each filing.  Add an idempotency key (e.g. userId + period)
 *    to prevent duplicate submissions.
 *
 * 6. ERROR HANDLING — Silent swallow in `screenUser`
 *    ──────────────────────────────────────────────────
 *    Assumption: Any provider error is fatal and should bubble to the caller
 *    (current behaviour — error is re-thrown).
 *
 *    Threat: If the error path were changed to return a default "low" result
 *    on failure (a common "fail open" mistake), every provider outage would
 *    allow all users through without screening.  This service must always
 *    fail closed (i.e. reject / block) on provider errors.
 *
 *    Mitigation (current): Provider errors are re-thrown, so the calling
 *    route returns HTTP 500, blocking the operation.  Do not change this to
 *    a fallback approval.
 *
 * 7. RISK SCORE ARITHMETIC — `calculateRiskScore`
 *    ────────────────────────────────────────────
 *    Assumption: Scores are additive across all historical screenings and
 *    flags with no time decay.  A single "high" screening raises the score
 *    permanently.
 *
 *    Threat: Score inflation over time — a user with many old, resolved
 *    flags accumulates a permanently elevated score even if recent
 *    screenings are clean, creating false positives.
 *
 *    Mitigation (Phase 2+): Apply recency weighting and allow flag
 *    resolution to reduce the running score.  Document the scoring model
 *    in the compliance runbook.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 2+ DEPENDENCY NOTE
 * ═══════════════════════════════════════════════════════════════════════════
 * The items marked "Phase 2+" above are known gaps that are acceptable for
 * Phase 1 (local build / developer preview) but MUST be resolved before any
 * production deployment that handles real user funds or regulatory obligations:
 *
 *   [ ] Server-side userId binding (item 2)
 *   [ ] Shared cache with forced-refresh (item 3)
 *   [ ] PII allowlist on provider payload (item 4)
 *   [ ] Filing audit-trail completeness + idempotency (item 5)
 *   [ ] Risk score recency decay (item 7)
 *
 * None of these gaps break the local build or dev-run path.
 */

class AMLService {
  /**
   * @param {object} db           - Database client with `.insert(table, row)`
   *                                and `.query(sql, params)` methods.
   * @param {object} amlProvider  - Injected third-party AML screening
   *                                provider.  Must expose a `.screen(payload)`
   *                                method that resolves with:
   *                                  { id, status, risk_level, matches[] }
   *                                See threat assumption #1 above.
   */
  constructor(db, amlProvider) {
    this.db = db;
    this.provider = amlProvider; // Third-party AML API (trusted — see threat #1)
    // In-memory cache — see threat assumption #3 for limitations.
    this.screeningCache = new Map();
  }

  /**
   * Screen a user against the AML provider's watchlists.
   *
   * Security notes:
   *   - `userId` is trusted as supplied; route layer must bind it to the
   *     authenticated session (threat #2).
   *   - Results are cached for 1 hour (threat #3).
   *   - Only `name`, `email`, `country` are sent to the provider (threat #4).
   *   - Errors are re-thrown; do NOT change to a fail-open fallback (threat #6).
   *
   * @param {string} userId
   * @param {{ name: string, email: string, country: string }} userDetails
   * @returns {Promise<{ userId, screeningId, status, risk_level, matches,
   *                     timestamp, flagged }>}
   */
  async screenUser(userId, userDetails) {
    const cacheKey = `aml_${userId}`;

    if (this.screeningCache.has(cacheKey)) {
      const cached = this.screeningCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) { // 1-hour TTL (threat #3)
        return cached.result;
      }
    }

    try {
      // Explicit payload construction — do not spread userDetails here.
      // Only the three fields below are permitted to leave this service
      // boundary (data minimisation — threat #4).
      const screeningResult = await this.provider.screen({
        name: userDetails.name,
        email: userDetails.email,
        country: userDetails.country
      });

      const result = {
        userId,
        screeningId: screeningResult.id,
        status: screeningResult.status,
        risk_level: screeningResult.risk_level,
        matches: screeningResult.matches || [],
        timestamp: new Date(),
        // Anything other than "low" is treated as flagged (fail-strict).
        flagged: screeningResult.risk_level !== 'low'
      };

      this.screeningCache.set(cacheKey, { result, timestamp: Date.now() });
      await this.db.insert('aml_screenings', result);

      return result;
    } catch (error) {
      // IMPORTANT (threat #6): always re-throw; never silently return a
      // default "low" risk result.  Provider outages must block operations,
      // not approve them.
      console.error('AML screening failed:', error);
      throw new Error('Failed to perform AML screening');
    }
  }

  /**
   * Record a suspicious-activity flag against a user.
   *
   * @param {string} userId
   * @param {{ type: string, description: string, severity?: string }} activity
   * @returns {Promise<object>} The persisted flag record.
   */
  async flagSuspiciousActivity(userId, activity) {
    const flag = {
      userId,
      activityType: activity.type,
      description: activity.description,
      severity: activity.severity || 'medium',
      timestamp: new Date(),
      status: 'open'
    };

    await this.db.insert('aml_flags', flag);
    return flag;
  }

  /**
   * Generate a summary report of screenings and flags for a user over a
   * date range.
   *
   * @param {string} userId
   * @param {Date|string} startDate
   * @param {Date|string} endDate
   * @returns {Promise<object>}
   */
  async generateScreeningReport(userId, startDate, endDate) {
    const screenings = await this.db.query(
      'SELECT * FROM aml_screenings WHERE userId = ? AND timestamp BETWEEN ? AND ?',
      [userId, startDate, endDate]
    );

    const flags = await this.db.query(
      'SELECT * FROM aml_flags WHERE userId = ? AND timestamp BETWEEN ? AND ?',
      [userId, startDate, endDate]
    );

    return {
      userId,
      period: { startDate, endDate },
      totalScreenings: screenings.length,
      screeningsWithMatches: screenings.filter(s => s.matches.length > 0).length,
      flaggedActivities: flags,
      riskAssessment: this.calculateRiskScore(screenings, flags),
      generatedAt: new Date()
    };
  }

  /**
   * Calculate an additive risk score (0–100) from historical screenings and
   * flags.
   *
   * IMPORTANT (threat #7): Scores are additive with no time decay and no
   * upper bound before the Math.min cap.  A user with many old resolved flags
   * may carry a permanently inflated score.  Phase 2+ should add recency
   * weighting.
   *
   * Scoring weights (current):
   *   High screening  → +40
   *   Medium screening → +20
   *   High flag        → +30
   *   Medium flag      → +15
   *
   * @param {Array} screenings
   * @param {Array} flags
   * @returns {number} Score between 0 and 100.
   */
  calculateRiskScore(screenings, flags) {
    let score = 0;
    screenings.forEach(s => {
      if (s.risk_level === 'high') score += 40;
      if (s.risk_level === 'medium') score += 20;
    });
    flags.forEach(f => {
      if (f.severity === 'high') score += 30;
      if (f.severity === 'medium') score += 15;
    });
    return Math.min(score, 100);
  }

  /**
   * Submit a regulatory filing for a user's screening history.
   *
   * KNOWN GAPS (threat #5 — Phase 2+):
   *   - Filing record contains only a count of screenings, not the full audit
   *     trail.  Attach snapshots before production use.
   *   - No idempotency guard: calling this twice creates duplicate rows.
   *
   * @param {string} userId
   * @returns {Promise<object>} The persisted filing record.
   */
  async submitFilings(userId) {
    const screenings = await this.db.query(
      'SELECT * FROM aml_screenings WHERE userId = ?',
      [userId]
    );

    const filing = {
      userId,
      screenings: screenings.length,
      submittedAt: new Date(),
      status: 'pending',
      referenceId: `FILING_${Date.now()}`
    };

    await this.db.insert('regulatory_filings', filing);
    return filing;
  }
}

module.exports = AMLService;
