# Phase 4: Hardening

> **Theme:** Hardening
> **Goal:** Security review, rate limiting, circuit breakers, test coverage, monitoring, fuzzing, and operational resilience.

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).

### P4-001: Add rate limit to API_PROTECTION_README.md
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/API_PROTECTION_README.md per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/API_PROTECTION_README.md`

### P4-002: Fuzz test COLLATERAL.md
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/COLLATERAL.md.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/COLLATERAL.md`

### P4-003: Add reentrancy guard review for DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/DEPOSIT_SERVICE_DOCUMENTATION.md.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P4-004: Expand unit tests in DEPOSIT_SERVICE_README.md
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/DEPOSIT_SERVICE_README.md.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P4-005: Add e2e test for IMPLEMENTATION.md
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/IMPLEMENTATION.md: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/IMPLEMENTATION.md`

### P4-006: Harden auth on LIQUIDATION.md
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/LIQUIDATION.md per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/LIQUIDATION.md`

### P4-007: Add input validation to MARGIN.md
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/MARGIN.md.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/MARGIN.md`

### P4-008: Review access control in README.md
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/README.md.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/README.md`

### P4-009: Add monitoring metric for RISK.md
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/RISK.md.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/RISK.md`

### P4-010: Add alert rule for TRADE_REPORTS.md
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/TRADE_REPORTS.md: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/TRADE_REPORTS.md`

### P4-011: Stress test TRADE_REPORTS_SETUP.md
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/TRADE_REPORTS_SETUP.md per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P4-012: Add circuit breaker to UPTIME_MONITORING.md
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/UPTIME_MONITORING.md.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/UPTIME_MONITORING.md`

### P4-013: Review oracle trust in pagerduty.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/config/pagerduty.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/config/pagerduty.js`

### P4-014: Add slippage bounds to rateLimits.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/config/rateLimits.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/config/rateLimits.js`

### P4-015: Pen-test endpoint eslint.config.mjs
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/eslint.config.mjs: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/eslint.config.mjs`

### P4-016: Add audit log for heartbeatServer.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/heartbeatServer.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/heartbeatServer.js`

### P4-017: Review gas limits in arbitrageMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/jobs/arbitrageMonitor.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P4-018: Add chaos test for batchExecutor.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/jobs/batchExecutor.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/jobs/batchExecutor.js`

### P4-019: Document threat model for complianceChecker.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/jobs/complianceChecker.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/jobs/complianceChecker.js`

### P4-020: Security audit heartbeatMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/jobs/heartbeatMonitor.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P4-021: Add rate limit to liquidationMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/jobs/liquidationMonitor.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/jobs/liquidationMonitor.js`

### P4-022: Fuzz test sanityCheck.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/jobs/sanityCheck.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/jobs/sanityCheck.js`

### P4-023: Add reentrancy guard review for snapshotCapture.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/jobs/snapshotCapture.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/jobs/snapshotCapture.js`

### P4-024: Expand unit tests in tradeExecutor.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/jobs/tradeExecutor.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/jobs/tradeExecutor.js`

### P4-025: Add e2e test for upgradeManager.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/jobs/upgradeManager.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/jobs/upgradeManager.js`

### P4-026: Harden auth on backwardCompat.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/middleware/backwardCompat.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/middleware/backwardCompat.js`

### P4-027: Add input validation to ddosGuard.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/middleware/ddosGuard.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/middleware/ddosGuard.js`

### P4-028: Review access control in deprecation.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/middleware/deprecation.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/deprecation.js`

### P4-029: Add monitoring metric for permissions.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/middleware/permissions.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/middleware/permissions.js`

### P4-030: Add alert rule for rateLimiter.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/middleware/rateLimiter.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/middleware/rateLimiter.js`

### P4-031: Stress test throttle.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/middleware/throttle.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/middleware/throttle.js`

### P4-032: Add circuit breaker to tradeValidation.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/middleware/tradeValidation.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/middleware/tradeValidation.js`

### P4-033: Review oracle trust in version.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/middleware/version.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/version.js`

### P4-034: Add slippage bounds to 001_init_markets.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/migrations/001_init_markets.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/migrations/001_init_markets.js`

### P4-035: Pen-test endpoint AuditLog.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/models/AuditLog.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/models/AuditLog.js`

### P4-036: Add audit log for Balance.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/models/Balance.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/models/Balance.js`

### P4-037: Review gas limits in Collateral.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/models/Collateral.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/models/Collateral.js`

### P4-038: Add chaos test for Dispute.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/models/Dispute.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/models/Dispute.js`

### P4-039: Document threat model for Liquidation.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/models/Liquidation.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/models/Liquidation.js`

### P4-040: Security audit MarginAccount.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/models/MarginAccount.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/models/MarginAccount.js`

### P4-041: Add rate limit to MarginCall.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/models/MarginCall.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/models/MarginCall.js`

### P4-042: Fuzz test MarketSnapshot.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/models/MarketSnapshot.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/models/MarketSnapshot.js`

### P4-043: Add reentrancy guard review for Notification.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/models/Notification.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/models/Notification.js`

### P4-044: Expand unit tests in Order.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/models/Order.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/models/Order.js`

### P4-045: Add e2e test for PriceHistory.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/models/PriceHistory.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/models/PriceHistory.js`

### P4-046: Harden auth on Referral.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/models/Referral.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/models/Referral.js`

### P4-047: Add input validation to RiskConfig.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/models/RiskConfig.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/models/RiskConfig.js`

### P4-048: Review access control in RiskScore.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/models/RiskScore.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/models/RiskScore.js`

### P4-049: Add monitoring metric for TradeReport.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/models/TradeReport.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/models/TradeReport.js`

### P4-050: Add alert rule for nest-cli.json
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/nest-cli.json: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/nest-cli.json`

### P4-051: Stress test package-lock.json
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/package-lock.json per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/package-lock.json`

### P4-052: Add circuit breaker to package.json
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/package.json.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/package.json`

### P4-053: Review oracle trust in aggregatedTrades.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/aggregatedTrades.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/aggregatedTrades.js`

### P4-054: Add slippage bounds to alerts.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/alerts.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/alerts.js`

### P4-055: Pen-test endpoint aml.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/aml.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/aml.js`

### P4-056: Add audit log for api.example.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/api.example.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/api.example.js`

### P4-057: Review gas limits in approvals.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/approvals.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/approvals.js`

### P4-058: Add chaos test for beta.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/beta.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/beta.js`

### P4-059: Document threat model for blacklist.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/blacklist.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/blacklist.js`

### P4-060: Security audit bridge.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/bridge.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/bridge.js`

### P4-061: Add rate limit to circuitBreaker.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/circuitBreaker.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/circuitBreaker.js`

### P4-062: Fuzz test claims.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/claims.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/claims.js`

### P4-063: Add reentrancy guard review for collateral.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/collateral.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/collateral.js`

### P4-064: Expand unit tests in compression.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/compression.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/compression.js`

### P4-065: Add e2e test for disputes.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/disputes.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/disputes.js`

### P4-066: Harden auth on escalation.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/escalation.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/escalation.js`

### P4-067: Add input validation to experiments.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/experiments.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/experiments.js`

### P4-068: Review access control in exports.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/exports.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/exports.js`

### P4-069: Add monitoring metric for features.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/features.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/features.js`

### P4-070: Add alert rule for freeze.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/freeze.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/freeze.js`

### P4-071: Stress test gas.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/gas.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/gas.js`

### P4-072: Add circuit breaker to governance.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/governance.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/governance.js`

### P4-073: Review oracle trust in health.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/health.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/health.js`

### P4-074: Add slippage bounds to heartbeat.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/heartbeat.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/heartbeat.js`

### P4-075: Pen-test endpoint imports.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/imports.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/imports.js`

### P4-076: Add audit log for insurance.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/insurance.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/insurance.js`

### P4-077: Review gas limits in ipfs.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/ipfs.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/ipfs.js`

### P4-078: Add chaos test for kyc.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/kyc.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/kyc.js`

### P4-079: Document threat model for legacy.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/legacy.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/legacy.js`

### P4-080: Security audit lending.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/lending.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/lending.js`

### P4-081: Add rate limit to marketAnalytics.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/marketAnalytics.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/marketAnalytics.js`

### P4-082: Fuzz test migration.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/migration.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/migration.js`

### P4-083: Add reentrancy guard review for mining.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/mining.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/mining.js`

### P4-084: Expand unit tests in multisig.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/multisig.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/multisig.js`

### P4-085: Add e2e test for oncall.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/oncall.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/oncall.js`

### P4-086: Harden auth on oracle.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/oracle.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/oracle.js`

### P4-087: Add input validation to pause.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/pause.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/pause.js`

### P4-088: Review access control in permissions.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/permissions.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/permissions.js`

### P4-089: Add monitoring metric for referrals.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/referrals.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/referrals.js`

### P4-090: Add alert rule for releases.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/releases.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/releases.js`

### P4-091: Stress test risk.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/risk.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/risk.js`

### P4-092: Add circuit breaker to rollback.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/rollback.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/rollback.js`

### P4-093: Review oracle trust in runbooks.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/runbooks.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/runbooks.js`

### P4-094: Add slippage bounds to shutdown.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/shutdown.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/shutdown.js`

### P4-095: Pen-test endpoint sla.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/sla.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/sla.js`

### P4-096: Add audit log for snapshots.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/snapshots.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/snapshots.js`

### P4-097: Review gas limits in status.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/status.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/status.js`

### P4-098: Add chaos test for swaps.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/swaps.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/swaps.js`

### P4-099: Document threat model for tradeReports.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/tradeReports.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/tradeReports.js`

### P4-100: Security audit trades.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/trades.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/trades.js`

### P4-101: Add rate limit to uptime.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/uptime.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/uptime.js`

### P4-102: Fuzz test index.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/routes/v1/index.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/routes/v1/index.js`

### P4-103: Add reentrancy guard review for index.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/routes/v2/index.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/v2/index.js`

### P4-104: Expand unit tests in voting.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/routes/voting.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/routes/voting.js`

### P4-105: Add e2e test for whitelist.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/routes/whitelist.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/routes/whitelist.js`

### P4-106: Harden auth on yield.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/routes/yield.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/routes/yield.js`

### P4-107: Add input validation to deploy.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/scripts/deploy.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/scripts/deploy.js`

### P4-108: Review access control in test.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/scripts/test.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/scripts/test.js`

### P4-109: Add monitoring metric for server.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/server.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/server.js`

### P4-110: Add alert rule for abTesting.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/abTesting.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/abTesting.js`

### P4-111: Stress test alertRouting.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/alertRouting.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/alertRouting.js`

### P4-112: Add circuit breaker to amlService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/amlService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/amlService.js`

### P4-113: Review oracle trust in analyticsService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/analyticsService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/analyticsService.js`

### P4-114: Add slippage bounds to approvalService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/approvalService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/approvalService.js`

### P4-115: Pen-test endpoint arbitrageService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/arbitrageService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/arbitrageService.js`

### P4-116: Add audit log for auditTrail.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/auditTrail.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/auditTrail.js`

### P4-117: Review gas limits in batchProcessor.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/batchProcessor.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/batchProcessor.js`

### P4-118: Add chaos test for betaAccess.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/betaAccess.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/betaAccess.js`

### P4-119: Document threat model for blacklistService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/blacklistService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/blacklistService.js`

### P4-120: Security audit breakerService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/breakerService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/breakerService.js`

### P4-121: Add rate limit to bridgeService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/bridgeService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/bridgeService.js`

### P4-122: Fuzz test claimService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/claimService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/claimService.js`

### P4-123: Add reentrancy guard review for collateralService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/collateralService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/collateralService.js`

### P4-124: Expand unit tests in complianceService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/complianceService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/complianceService.js`

### P4-125: Add e2e test for compressionService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/compressionService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/compressionService.js`

### P4-126: Harden auth on ddosProtection.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/ddosProtection.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/ddosProtection.js`

### P4-127: Add input validation to deployService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/deployService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/deployService.js`

### P4-128: Review access control in deprecationService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/deprecationService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/deprecationService.js`

### P4-129: Add monitoring metric for disputeService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/disputeService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/disputeService.js`

### P4-130: Add alert rule for escalation.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/escalation.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/escalation.js`

### P4-131: Stress test exportService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/exportService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/exportService.js`

### P4-132: Add circuit breaker to featureFlagService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/featureFlagService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/featureFlagService.js`

### P4-133: Review oracle trust in freezeService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/freezeService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/freezeService.js`

### P4-134: Add slippage bounds to gasOptimizer.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/gasOptimizer.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/gasOptimizer.js`

### P4-135: Pen-test endpoint governanceService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/governanceService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/governanceService.js`

### P4-136: Add audit log for healthCheck.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/healthCheck.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/healthCheck.js`

### P4-137: Review gas limits in heartbeat.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/heartbeat.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/heartbeat.js`

### P4-138: Add chaos test for importService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/importService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/importService.js`

### P4-139: Document threat model for insuranceService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/insuranceService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/insuranceService.js`

### P4-140: Security audit ipfsService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/ipfsService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/ipfsService.js`

### P4-141: Add rate limit to kycService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/kycService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/kycService.js`

### P4-142: Fuzz test lendingService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/lendingService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/lendingService.js`

### P4-143: Add reentrancy guard review for liquidationService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/liquidationService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/liquidationService.js`

### P4-144: Expand unit tests in marginEngine.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/marginEngine.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/marginEngine.js`

### P4-145: Add e2e test for migrationService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/migrationService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/migrationService.js`

### P4-146: Harden auth on miningService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/miningService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/miningService.js`

### P4-147: Add input validation to multisigService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/multisigService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/multisigService.js`

### P4-148: Review access control in oncallService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/oncallService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/oncallService.js`

### P4-149: Add monitoring metric for oracleService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/oracleService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/oracleService.js`

### P4-150: Add alert rule for pagerduty.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/pagerduty.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/pagerduty.js`

### P4-151: Stress test pauseService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/pauseService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/pauseService.js`

### P4-152: Add circuit breaker to permissionService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/permissionService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/permissionService.js`

### P4-153: Review oracle trust in referralService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/referralService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/referralService.js`

### P4-154: Add slippage bounds to releaseService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/releaseService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/releaseService.js`

### P4-155: Pen-test endpoint riskService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/riskService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/riskService.js`

### P4-156: Add audit log for rollbackService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/rollbackService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/rollbackService.js`

### P4-157: Review gas limits in runbookService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/runbookService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/runbookService.js`

### P4-158: Add chaos test for sanityChecker.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/sanityChecker.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/sanityChecker.js`

### P4-159: Document threat model for schedulerService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/schedulerService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/schedulerService.js`

### P4-160: Security audit shutdownService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/shutdownService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/shutdownService.js`

### P4-161: Add rate limit to slaTracker.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/slaTracker.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/slaTracker.js`

### P4-162: Fuzz test snapshotService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/snapshotService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/snapshotService.js`

### P4-163: Add reentrancy guard review for statusService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/statusService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/statusService.js`

### P4-164: Expand unit tests in swapService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/swapService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/swapService.js`

### P4-165: Add e2e test for syncService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/syncService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/syncService.js`

### P4-166: Harden auth on throttleService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/throttleService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/throttleService.js`

### P4-167: Add input validation to timeService.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/timeService.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/timeService.js`

### P4-168: Review access control in tradeAggregator.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/tradeAggregator.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/tradeAggregator.js`

### P4-169: Add monitoring metric for tradeEngine.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/tradeEngine.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/tradeEngine.js`

### P4-170: Add alert rule for tradeReportService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/tradeReportService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/tradeReportService.js`

### P4-171: Stress test tradeValidator.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/tradeValidator.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/tradeValidator.js`

### P4-172: Add circuit breaker to upgradeCoordinator.js
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/services/upgradeCoordinator.js.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/services/upgradeCoordinator.js`

### P4-173: Review oracle trust in uptimeService.js
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/services/uptimeService.js.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/uptimeService.js`

### P4-174: Add slippage bounds to votingService.js
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/services/votingService.js.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/services/votingService.js`

### P4-175: Pen-test endpoint whitelistService.js
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/services/whitelistService.js: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/services/whitelistService.js`

### P4-176: Add audit log for yieldService.js
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/services/yieldService.js per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/services/yieldService.js`

### P4-177: Review gas limits in ai.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/ai/ai.controller.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/ai/ai.controller.ts`

### P4-178: Add chaos test for ai.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/ai/ai.module.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/ai/ai.module.ts`

### P4-179: Document threat model for ai.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/ai/ai.service.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/ai/ai.service.ts`

### P4-180: Security audit analysis.dto.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/ai/dto/analysis.dto.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/ai/dto/analysis.dto.ts`

### P4-181: Add rate limit to analytics.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/analytics/analytics.module.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/analytics/analytics.module.ts`

### P4-182: Fuzz test volume-analytics.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/analytics/volume-analytics.controller.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/analytics/volume-analytics.controller.ts`

### P4-183: Add reentrancy guard review for volume-analytics.entity.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/analytics/volume-analytics.entity.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/analytics/volume-analytics.entity.ts`

### P4-184: Expand unit tests in volume-analytics.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/analytics/volume-analytics.service.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/analytics/volume-analytics.service.ts`

### P4-185: Add e2e test for api-keys.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/api-keys/api-keys.controller.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/api-keys/api-keys.controller.ts`

### P4-186: Harden auth on api-keys.entity.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/api-keys/api-keys.entity.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/api-keys/api-keys.entity.ts`

### P4-187: Add input validation to api-keys.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/api-keys/api-keys.module.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/api-keys/api-keys.module.ts`

### P4-188: Review access control in api-keys.service.spec.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/api-keys/api-keys.service.spec.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/api-keys/api-keys.service.spec.ts`

### P4-189: Add monitoring metric for api-keys.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/api-keys/api-keys.service.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/api-keys/api-keys.service.ts`

### P4-190: Add alert rule for api-keys.dto.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/api-keys/dto/api-keys.dto.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/api-keys/dto/api-keys.dto.ts`

### P4-191: Stress test app.controller.spec.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/app.controller.spec.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/app.controller.spec.ts`

### P4-192: Add circuit breaker to app.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/app.controller.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/app.controller.ts`

### P4-193: Review oracle trust in app.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/app.module.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/app.module.ts`

### P4-194: Add slippage bounds to app.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/app.service.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/app.service.ts`

### P4-195: Pen-test endpoint approval.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/approval/approval.controller.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/approval/approval.controller.ts`

### P4-196: Add audit log for approval.entity.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/approval/approval.entity.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/approval/approval.entity.ts`

### P4-197: Review gas limits in approval.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/approval/approval.module.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/approval/approval.module.ts`

### P4-198: Add chaos test for approval.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/approval/approval.service.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/approval/approval.service.ts`

### P4-199: Document threat model for approval.dto.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/approval/dto/approval.dto.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/approval/dto/approval.dto.ts`

### P4-200: Security audit auth.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/auth/auth.controller.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/auth/auth.controller.ts`

### P4-201: Add rate limit to auth.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/auth/auth.module.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/auth/auth.module.ts`

### P4-202: Fuzz test auth.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/auth/auth.service.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/auth/auth.service.ts`

### P4-203: Add reentrancy guard review for auth.dto.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/auth/dto/auth.dto.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P4-204: Expand unit tests in user.entity.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/auth/entities/user.entity.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P4-205: Add e2e test for jwt-auth.guard.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/auth/guards/jwt-auth.guard.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P4-206: Harden auth on jwt.strategy.ts
**Labels:** `phase-4`, `backend`
**Description:** Security and reliability requirement for Backend/src/auth/strategies/jwt.strategy.ts per Phase 4 checklist.
**Acceptance criteria:**
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P4-207: Add input validation to blockchain.controller.ts
**Labels:** `phase-4`, `backend`
**Description:** Expand test coverage and add negative-path cases for Backend/src/blockchain/blockchain.controller.ts.
**Acceptance criteria:**
- [ ] Rate limits or guards verified under load
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
**Related:** `Backend/src/blockchain/blockchain.controller.ts`

### P4-208: Review access control in blockchain.module.ts
**Labels:** `phase-4`, `backend`
**Description:** Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving Backend/src/blockchain/blockchain.module.ts.
**Acceptance criteria:**
- [ ] Monitoring/alerting configured
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/blockchain/blockchain.module.ts`

### P4-209: Add monitoring metric for blockchain.service.ts
**Labels:** `phase-4`, `backend`
**Description:** Operational readiness: metrics, alerts, and runbooks for failures in Backend/src/blockchain/blockchain.service.ts.
**Acceptance criteria:**
- [ ] Documented rollback procedure
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
**Related:** `Backend/src/blockchain/blockchain.service.ts`

### P4-210: Add alert rule for nonce.dto.ts
**Labels:** `phase-4`, `backend`
**Description:** Hardening pass on Backend/src/blockchain/dto/nonce.dto.ts: identify abuse vectors, add limits, tests, and monitoring before public launch.
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Negative-path tests added and passing
- [ ] Rate limits or guards verified under load
**Related:** `Backend/src/blockchain/dto/nonce.dto.ts`
