# Phase 4: Hardening

> **Theme:** Hardening
> **Goal:** Security review, rate limiting, circuit breakers, test coverage, monitoring, fuzzing, and operational resilience.

> **Area distribution:** frontend 36, backend 36, contracts 35, docs 32, infra 32, security 39 (210 issues)

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).
Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.

### P4-001: Validate env usage in ARBITRAGE_DEMO.md
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/ARBITRAGE_DEMO.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ARBITRAGE_DEMO.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ARBITRAGE_DEMO.md`

### P4-002: Add health check for .env.example
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/.env.example` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/.env.example`

### P4-003: Add invariant test for test.yml
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/.github/workflows/test.yml`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/.github/workflows/test.yml`
- [ ] `forge build` succeeds with `Contracts/.github/workflows/test.yml`
**Related:** `Contracts/.github/workflows/test.yml`

### P4-004: Add phase checklist to BUG_ANALYSIS_REPORT.md
**Labels:** `phase-4`, `docs`
**Description:** Link `BUG_ANALYSIS_REPORT.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `BUG_ANALYSIS_REPORT.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `BUG_ANALYSIS_REPORT.md`

### P4-005: Configure secrets mapping for ci.yml
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `.github/workflows/ci.yml` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `.github/workflows/ci.yml`

### P4-006: Audit access control in rateLimits.js
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/config/rateLimits.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/config/rateLimits.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/config/rateLimits.js`

### P4-007: Add empty state to ERROR_BOUNDARY_CHECKLIST.md
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/ERROR_BOUNDARY_CHECKLIST.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/ERROR_BOUNDARY_CHECKLIST.md`

### P4-008: Ensure package scripts cover API_PROTECTION_README.md
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/API_PROTECTION_README.md`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/API_PROTECTION_README.md`
**Related:** `Backend/API_PROTECTION_README.md`

### P4-009: Add event coverage test for API_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/API_REFERENCE.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/API_REFERENCE.md`

### P4-010: Add glossary entry in CHECKLIST.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `CHECKLIST.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `CHECKLIST.md`

### P4-011: Add CI job for .env.example
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Backend/.env.example` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/.env.example`

### P4-012: Add circuit breaker check for ddosGuard.js
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/middleware/ddosGuard.js` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/middleware/ddosGuard.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/middleware/ddosGuard.js`

### P4-013: Wire wallet connect flow in ERROR_BOUNDARY_DOCUMENTATION.md
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`

### P4-014: Add smoke test for COLLATERAL.md
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/COLLATERAL.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/COLLATERAL.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/COLLATERAL.md`

### P4-015: Align ABI export for BUG_ANALYSIS_AND_FIXES.md
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/BUG_ANALYSIS_AND_FIXES.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/BUG_ANALYSIS_AND_FIXES.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/BUG_ANALYSIS_AND_FIXES.md`

### P4-016: Document env matrix in CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `CIRCUIT_BREAKER_IMPLEMENTATION.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`

### P4-017: Add smoke test post-build for upgradeManager.js
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Backend/jobs/upgradeManager.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/jobs/upgradeManager.js`

### P4-018: Add slippage bounds in rateLimiter.js
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/middleware/rateLimiter.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/rateLimiter.js`

### P4-019: Fix TypeScript path alias in ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` fits the app shell
**Related:** `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`

### P4-020: Add missing module export in DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P4-021: Verify remappings for Burnable.sol
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/Burnable.sol` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/Burnable.sol`

### P4-022: Fix broken links in CIRCUIT_BREAKER_QUICK_REFERENCE.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `CIRCUIT_BREAKER_QUICK_REFERENCE.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `CIRCUIT_BREAKER_QUICK_REFERENCE.md`

### P4-023: Add parallel job for package-lock.json
**Labels:** `phase-4`, `infra`
**Description:** Document how `Backend/package-lock.json` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/package-lock.json`

### P4-024: Expand negative tests in AuditLog.js
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/models/AuditLog.js` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/models/AuditLog.js`

### P4-025: Add vitest coverage for ERROR_BOUNDARY_QUICKSTART.md
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/ERROR_BOUNDARY_QUICKSTART.md` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/ERROR_BOUNDARY_QUICKSTART.md`

### P4-026: Document setup for DEPOSIT_SERVICE_README.md
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/DEPOSIT_SERVICE_README.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P4-027: Add Foundry test for CODE_REVIEW_REPORT.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/CODE_REVIEW_REPORT.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/CODE_REVIEW_REPORT.md`
**Related:** `Contracts/CODE_REVIEW_REPORT.md`

### P4-028: Cross-link ADR in CIRCUIT_BREAKER_VERIFICATION.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `CIRCUIT_BREAKER_VERIFICATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `CIRCUIT_BREAKER_VERIFICATION.md` verified on a clean checkout
**Related:** `CIRCUIT_BREAKER_VERIFICATION.md`

### P4-029: Configure env matrix in package.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/package.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package.json`

### P4-030: Add circuit breaker test for beta.js
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/routes/beta.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/beta.js`
**Related:** `Backend/routes/beta.js`

### P4-031: Validate env usage in ERROR_BOUNDARY_SUMMARY.md
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/ERROR_BOUNDARY_SUMMARY.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ERROR_BOUNDARY_SUMMARY.md`

### P4-032: Add health check for IMPLEMENTATION.md
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/IMPLEMENTATION.md` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/IMPLEMENTATION.md`

### P4-033: Add invariant test for FLASHBORROW_DOCUMENTATION.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/FLASHBORROW_DOCUMENTATION.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_DOCUMENTATION.md`
**Related:** `Contracts/FLASHBORROW_DOCUMENTATION.md`

### P4-034: Add phase checklist to DELIVERY_SUMMARY.md
**Labels:** `phase-4`, `docs`
**Description:** Link `DELIVERY_SUMMARY.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `DELIVERY_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `DELIVERY_SUMMARY.md`

### P4-035: Configure secrets mapping for deploy.js
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `Backend/scripts/deploy.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/scripts/deploy.js`

### P4-036: Harden auth flow in blacklist.js
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/routes/blacklist.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/blacklist.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/routes/blacklist.js`

### P4-037: Add empty state to README.md
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/README.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/README.md`

### P4-038: Ensure package scripts cover LIQUIDATION.md
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/LIQUIDATION.md`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/LIQUIDATION.md`
**Related:** `Backend/LIQUIDATION.md`

### P4-039: Add event coverage test for FLASHBORROW_README.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/FLASHBORROW_README.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_README.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/FLASHBORROW_README.md`

### P4-040: Add glossary entry in DOES_IT_WORK_ANSWER.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `DOES_IT_WORK_ANSWER.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `DOES_IT_WORK_ANSWER.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `DOES_IT_WORK_ANSWER.md`

### P4-041: Add CI job for deployService.js
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Backend/services/deployService.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P4-042: Review oracle trust in circuitBreaker.js
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/routes/circuitBreaker.js` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/routes/circuitBreaker.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/routes/circuitBreaker.js`

### P4-043: Wire wallet connect flow in SETTINGS_DOCUMENTATION.md
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/SETTINGS_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/SETTINGS_DOCUMENTATION.md`

### P4-044: Add smoke test for MARGIN.md
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/MARGIN.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/MARGIN.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/MARGIN.md`

### P4-045: Align ABI export for FlashLoanProtection.sol
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/FlashLoanProtection.sol`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/FlashLoanProtection.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/FlashLoanProtection.sol`

### P4-046: Document env matrix in FEATURE_SUMMARY.md
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `FEATURE_SUMMARY.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `FEATURE_SUMMARY.md`

### P4-047: Add smoke test post-build for upgradeCoordinator.js
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Backend/services/upgradeCoordinator.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P4-048: Stress test rate limiter in multisig.js
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/routes/multisig.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/multisig.js`

### P4-049: Fix TypeScript path alias in SETTINGS_QUICKSTART.md
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/SETTINGS_QUICKSTART.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_QUICKSTART.md` fits the app shell
**Related:** `Frontend/SETTINGS_QUICKSTART.md`

### P4-050: Add missing module export in README.md
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/README.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/README.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/README.md`

### P4-051: Verify remappings for GAS_OPTIMIZATION_REPORT.md
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/GAS_OPTIMIZATION_REPORT.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/GAS_OPTIMIZATION_REPORT.md`

### P4-052: Fix broken links in FINAL_VERIFICATION_REPORT.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `FINAL_VERIFICATION_REPORT.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `FINAL_VERIFICATION_REPORT.md`

### P4-053: Add parallel job for deploy.test.js
**Labels:** `phase-4`, `infra`
**Description:** Document how `Backend/tests/deploy.test.js` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tests/deploy.test.js`

### P4-054: Review multisig policy in whitelist.js
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/routes/whitelist.js` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/routes/whitelist.js`

### P4-055: Add vitest coverage for SETTINGS_SUMMARY.md
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/SETTINGS_SUMMARY.md` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/SETTINGS_SUMMARY.md`

### P4-056: Document setup for RISK.md
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/RISK.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/RISK.md`

### P4-057: Add Foundry test for INTEGRATION_GUIDE.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/INTEGRATION_GUIDE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/INTEGRATION_GUIDE.md`
**Related:** `Contracts/INTEGRATION_GUIDE.md`

### P4-058: Cross-link ADR in FLASHBORROW_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
**Related:** `FLASHBORROW_IMPLEMENTATION_SUMMARY.md`

### P4-059: Configure env matrix in tsconfig.build.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/tsconfig.build.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tsconfig.build.json`

### P4-060: Review reentrancy surface in auditTrail.js
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/services/auditTrail.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/auditTrail.js`
**Related:** `Backend/services/auditTrail.js`

### P4-061: Validate env usage in TRADING_INTERFACE_DOCUMENTATION.md
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`

### P4-062: Add health check for TRADE_REPORTS.md
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/TRADE_REPORTS.md` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/TRADE_REPORTS.md`

### P4-063: Add invariant test for Liquidation.sol
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/Liquidation.sol`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/Liquidation.sol`
- [ ] `forge build` succeeds with `Contracts/Liquidation.sol`
**Related:** `Contracts/Liquidation.sol`

### P4-064: Add phase checklist to FLASHBORROW_VERIFICATION.md
**Labels:** `phase-4`, `docs`
**Description:** Link `FLASHBORROW_VERIFICATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_VERIFICATION.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `FLASHBORROW_VERIFICATION.md`

### P4-065: Configure secrets mapping for tsconfig.json
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `Backend/tsconfig.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.json`

### P4-066: Fuzz abuse path in betaAccess.js
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/services/betaAccess.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/betaAccess.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/services/betaAccess.js`

### P4-067: Add empty state to TRADING_INTERFACE_QUICKSTART.md
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/TRADING_INTERFACE_QUICKSTART.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/TRADING_INTERFACE_QUICKSTART.md`

### P4-068: Ensure package scripts cover TRADE_REPORTS_SETUP.md
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/TRADE_REPORTS_SETUP.md`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/TRADE_REPORTS_SETUP.md`
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P4-069: Add event coverage test for MARKET_CAP_IMPLEMENTATION.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_CAP_IMPLEMENTATION.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_CAP_IMPLEMENTATION.md`

### P4-070: Add glossary entry in README.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `Frontend/README.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `Frontend/README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `Frontend/README.md`

### P4-071: Add CI job for test.yml
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Contracts/.github/workflows/test.yml` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/.github/workflows/test.yml`

### P4-072: Add reentrancy review for blacklistService.js
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/services/blacklistService.js` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/services/blacklistService.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/services/blacklistService.js`

### P4-073: Wire wallet connect flow in TRADING_INTERFACE_SUMMARY.md
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/TRADING_INTERFACE_SUMMARY.md`

### P4-074: Add smoke test for UPTIME_MONITORING.md
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/UPTIME_MONITORING.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/UPTIME_MONITORING.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/UPTIME_MONITORING.md`

### P4-075: Align ABI export for MARKET_DELEGATION_API_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_DELEGATION_API_REFERENCE.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_DELEGATION_API_REFERENCE.md`

### P4-076: Document env matrix in IMPLEMENTATION_CHECKLIST.md
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `IMPLEMENTATION_CHECKLIST.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_CHECKLIST.md`

### P4-077: Add smoke test post-build for foundry.toml
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Contracts/foundry.toml` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/foundry.toml`

### P4-078: Pen-test auth on multisigService.js
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/services/multisigService.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/multisigService.js`

### P4-079: Fix TypeScript path alias in WEBSOCKET_IMPLEMENTATION.md
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/WEBSOCKET_IMPLEMENTATION.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_IMPLEMENTATION.md` fits the app shell
**Related:** `Frontend/WEBSOCKET_IMPLEMENTATION.md`

### P4-080: Add missing module export in pagerduty.js
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/config/pagerduty.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/config/pagerduty.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/config/pagerduty.js`

### P4-081: Verify remappings for MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`

### P4-082: Fix broken links in IMPLEMENTATION_COMPLETE.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `IMPLEMENTATION_COMPLETE.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `IMPLEMENTATION_COMPLETE.md`

### P4-083: Add parallel job for package-lock.json
**Labels:** `phase-4`, `infra`
**Description:** Document how `Contracts/package-lock.json` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/package-lock.json`

### P4-084: Document threat model for whitelistService.js
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/services/whitelistService.js` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/services/whitelistService.js`

### P4-085: Add vitest coverage for WEBSOCKET_INTEGRATION_EXAMPLES.md
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`

### P4-086: Document setup for rateLimits.js
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/config/rateLimits.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/config/rateLimits.js`

### P4-087: Add Foundry test for MARKET_DELEGATION_QUICK_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`
**Related:** `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`

### P4-088: Cross-link ADR in IMPLEMENTATION_REPORT.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_REPORT.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_REPORT.md` verified on a clean checkout
**Related:** `IMPLEMENTATION_REPORT.md`

### P4-089: Configure env matrix in package.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/package.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package.json`

### P4-090: Add audit log for auth.controller.ts
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/auth.controller.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.controller.ts`
**Related:** `Backend/src/auth/auth.controller.ts`

### P4-091: Validate env usage in WEBSOCKET_QUICKSTART.md
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/WEBSOCKET_QUICKSTART.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/WEBSOCKET_QUICKSTART.md`

### P4-092: Add health check for eslint.config.mjs
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/eslint.config.mjs` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/eslint.config.mjs`

### P4-093: Add invariant test for MARKET_DELEGATION_README.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_DELEGATION_README.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_README.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_README.md`
**Related:** `Contracts/MARKET_DELEGATION_README.md`

### P4-094: Add phase checklist to IMPLEMENTATION_SUCCESS.md
**Labels:** `phase-4`, `docs`
**Description:** Link `IMPLEMENTATION_SUCCESS.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_SUCCESS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `IMPLEMENTATION_SUCCESS.md`

### P4-095: Configure secrets mapping for DeployMarketCap.s.sol
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `Contracts/script/DeployMarketCap.s.sol` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P4-096: Fuzz test auth.module.ts
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/src/auth/auth.module.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/auth.module.ts`

### P4-097: Add empty state to WEBSOCKET_SUMMARY.md
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/WEBSOCKET_SUMMARY.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/WEBSOCKET_SUMMARY.md`

### P4-098: Ensure package scripts cover heartbeatServer.js
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/heartbeatServer.js`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/heartbeatServer.js`
**Related:** `Backend/heartbeatServer.js`

### P4-099: Add event coverage test for MARKET_RELAY_IMPLEMENTATION.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_RELAY_IMPLEMENTATION.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_RELAY_IMPLEMENTATION.md`

### P4-100: Add glossary entry in IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_SUMMARY.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `IMPLEMENTATION_SUMMARY.md`

### P4-101: Add CI job for DeployRevokeFunction.s.sol
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Contracts/script/DeployRevokeFunction.s.sol` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P4-102: Add monitoring alert for auth.service.ts
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/src/auth/auth.service.ts` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/auth/auth.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/auth/auth.service.ts`

### P4-103: Wire wallet connect flow in page.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/analytics/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/analytics/page.tsx`

### P4-104: Add smoke test for arbitrageMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/arbitrageMonitor.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/arbitrageMonitor.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P4-105: Align ABI export for MARKET_RELAY_INTEGRATION_GUIDE.md
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`

### P4-106: Document env matrix in IMPLEMENTATION_VERIFIED.txt
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `IMPLEMENTATION_VERIFIED.txt` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_VERIFIED.txt`

### P4-107: Add smoke test post-build for DeployVoteWeight.s.sol
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Contracts/script/DeployVoteWeight.s.sol` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P4-108: Add input validation to auth.dto.ts
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/src/auth/dto/auth.dto.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P4-109: Fix TypeScript path alias in page.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api-keys/page.tsx` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api-keys/page.tsx` fits the app shell
**Related:** `Frontend/app/api-keys/page.tsx`

### P4-110: Add missing module export in batchExecutor.js
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/batchExecutor.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/batchExecutor.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/batchExecutor.js`

### P4-111: Verify remappings for MARKET_RELAY_QUICK_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_RELAY_QUICK_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`

### P4-112: Fix broken links in LIQUIDATION_IMPLEMENTATION.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `LIQUIDATION_IMPLEMENTATION.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `LIQUIDATION_IMPLEMENTATION.md`

### P4-113: Add parallel job for hardhat.config.js
**Labels:** `phase-4`, `infra`
**Description:** Document how `Frontend/localnet/hardhat.config.js` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/localnet/hardhat.config.js`

### P4-114: Review secrets exposure in user.entity.ts
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/entities/user.entity.ts` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P4-115: Add vitest coverage for route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/ipfs/gateway/[hash]/route.ts` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/gateway/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/ipfs/gateway/[hash]/route.ts`

### P4-116: Document setup for complianceChecker.js
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/complianceChecker.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/complianceChecker.js`

### P4-117: Add Foundry test for MARKET_RELAY_README.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/MARKET_RELAY_README.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_README.md`
**Related:** `Contracts/MARKET_RELAY_README.md`

### P4-118: Cross-link ADR in LIQUIDATION_QUICK_START.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `LIQUIDATION_QUICK_START.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `LIQUIDATION_QUICK_START.md` verified on a clean checkout
**Related:** `LIQUIDATION_QUICK_START.md`

### P4-119: Configure env matrix in package.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/localnet/package.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/package.json`

### P4-120: Add beta gate check in jwt-auth.guard.ts
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/guards/jwt-auth.guard.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/guards/jwt-auth.guard.ts`
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P4-121: Validate env usage in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/ipfs/pin/[hash]/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/pin/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ipfs/pin/[hash]/route.ts`

### P4-122: Add health check for heartbeatMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/jobs/heartbeatMonitor.js` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P4-123: Add invariant test for MARKET_RELAY_SECURITY_ANALYSIS.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
**Related:** `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

### P4-124: Add phase checklist to MARKET_DELEGATION_CHECKLIST.md
**Labels:** `phase-4`, `docs`
**Description:** Link `MARKET_DELEGATION_CHECKLIST.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MARKET_DELEGATION_CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `MARKET_DELEGATION_CHECKLIST.md`

### P4-125: Configure secrets mapping for deploy.js
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `Frontend/localnet/scripts/deploy.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/scripts/deploy.js`

### P4-126: Review gas griefing in jwt.strategy.ts
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/src/auth/strategies/jwt.strategy.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/strategies/jwt.strategy.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P4-127: Add empty state to route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/app/api/ipfs/retrieve/[hash]/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`

### P4-128: Ensure package scripts cover liquidationMonitor.js
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/jobs/liquidationMonitor.js`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/liquidationMonitor.js`
**Related:** `Backend/jobs/liquidationMonitor.js`

### P4-129: Add event coverage test for MarketMinter.sol
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MarketMinter.sol` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MarketMinter.sol`
- [ ] `forge build` succeeds with `Contracts/MarketMinter.sol`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MarketMinter.sol`

### P4-130: Add glossary entry in MARKET_DELEGATION_COMPLETE.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `MARKET_DELEGATION_COMPLETE.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `MARKET_DELEGATION_COMPLETE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `MARKET_DELEGATION_COMPLETE.md`

### P4-131: Add CI job for package-lock.json
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Frontend/package-lock.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Frontend/package-lock.json`

### P4-132: Review rate limits for market-audit.dto.ts
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/src/market-audit/dto/market-audit.dto.ts` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/dto/market-audit.dto.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/dto/market-audit.dto.ts`

### P4-133: Wire wallet connect flow in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/upload-json/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/ipfs/upload-json/route.ts`

### P4-134: Add smoke test for sanityCheck.js
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/sanityCheck.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/sanityCheck.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/sanityCheck.js`

### P4-135: Align ABI export for QUICK_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/QUICK_REFERENCE.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/QUICK_REFERENCE.md`

### P4-136: Document env matrix in MARKET_RELAY_DELIVERY_SUMMARY.md
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `MARKET_RELAY_DELIVERY_SUMMARY.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `MARKET_RELAY_DELIVERY_SUMMARY.md`

### P4-137: Add smoke test post-build for package.json
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Frontend/package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Frontend/package.json`

### P4-138: Pen-test endpoint behind market-audit.controller.ts
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/src/market-audit/market-audit.controller.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/market-audit/market-audit.controller.ts`

### P4-139: Fix TypeScript path alias in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/market-audit/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-audit/route.ts` fits the app shell
**Related:** `Frontend/app/api/market-audit/route.ts`

### P4-140: Add missing module export in snapshotCapture.js
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/snapshotCapture.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/snapshotCapture.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/snapshotCapture.js`

### P4-141: Verify remappings for README.md
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/README.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/README.md`

### P4-142: Fix broken links in MARKET_RELAY_FILES_CHECKLIST.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `MARKET_RELAY_FILES_CHECKLIST.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `MARKET_RELAY_FILES_CHECKLIST.md`

### P4-143: Add parallel job for tsconfig.json
**Labels:** `phase-4`, `infra`
**Description:** Document how `Frontend/tsconfig.json` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/tsconfig.json`

### P4-144: Review CORS policy for market-audit.entity.ts
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/market-audit.entity.ts` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/market-audit/market-audit.entity.ts`

### P4-145: Add vitest coverage for route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/market-sentiment/route.ts` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-sentiment/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/market-sentiment/route.ts`

### P4-146: Document setup for tradeExecutor.js
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/tradeExecutor.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/tradeExecutor.js`

### P4-147: Add Foundry test for README_MARKETCAP.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/README_MARKETCAP.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_MARKETCAP.md`
**Related:** `Contracts/README_MARKETCAP.md`

### P4-148: Cross-link ADR in MINTING_PAUSABLE_IMPLEMENTATION.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `MINTING_PAUSABLE_IMPLEMENTATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MINTING_PAUSABLE_IMPLEMENTATION.md` verified on a clean checkout
**Related:** `MINTING_PAUSABLE_IMPLEMENTATION.md`

### P4-149: Configure env matrix in package-lock.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `package-lock.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `package-lock.json`

### P4-150: Add chaos scenario for market-audit.module.ts
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/market-audit.module.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.module.ts`
**Related:** `Backend/src/market-audit/market-audit.module.ts`

### P4-151: Validate env usage in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/multisig/execute/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/execute/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/multisig/execute/route.ts`

### P4-152: Add health check for upgradeManager.js
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/jobs/upgradeManager.js` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/upgradeManager.js`

### P4-153: Add invariant test for README_VOTE_DELEGATION.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/README_VOTE_DELEGATION.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_VOTE_DELEGATION.md`
- [ ] `forge build` succeeds with `Contracts/README_VOTE_DELEGATION.md`
**Related:** `Contracts/README_VOTE_DELEGATION.md`

### P4-154: Add phase checklist to PHASES.md
**Labels:** `phase-4`, `docs`
**Description:** Link `PHASES.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASES.md`

### P4-155: Configure secrets mapping for package.json
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `package.json`

### P4-156: Audit access control in market-audit.service.spec.ts
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/src/market-audit/market-audit.service.spec.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.spec.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/market-audit/market-audit.service.spec.ts`

### P4-157: Add empty state to route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/app/api/multisig/propose/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/multisig/propose/route.ts`

### P4-158: Ensure package scripts cover backwardCompat.js
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/middleware/backwardCompat.js`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/backwardCompat.js`
**Related:** `Backend/middleware/backwardCompat.js`

### P4-159: Add event coverage test for REVOKE_FUNCTION_API_REFERENCE.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_API_REFERENCE.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`

### P4-160: Add glossary entry in PHASE_1.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `PHASE_1.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `PHASE_1.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PHASE_1.md`

### P4-161: Add CI job for ci.yml
**Labels:** `phase-4`, `infra`
**Description:** Infra: `.github/workflows/ci.yml` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `.github/workflows/ci.yml`

### P4-162: Add circuit breaker check for market-audit.service.ts
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/src/market-audit/market-audit.service.ts` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/market-audit.service.ts`

### P4-163: Wire wallet connect flow in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/sign/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/multisig/sign/route.ts`

### P4-164: Add smoke test for ddosGuard.js
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/ddosGuard.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/ddosGuard.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/ddosGuard.js`

### P4-165: Align ABI export for REVOKE_FUNCTION_DOCUMENTATION.md
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`

### P4-166: Document env matrix in PHASE_2.md
**Labels:** `phase-4`, `docs`
**Description:** Documentation: `PHASE_2.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `PHASE_2.md`

### P4-167: Add smoke test post-build for .env.example
**Labels:** `phase-4`, `infra`
**Description:** Phase 4 CI — ensure `Backend/.env.example` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/.env.example`

### P4-168: Add slippage bounds in rate-limiter.config.ts
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/src/rate-limiter/rate-limiter.config.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/rate-limiter/rate-limiter.config.ts`

### P4-169: Fix TypeScript path alias in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/multisig/status/[txId]/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/status/[txId]/route.ts` fits the app shell
**Related:** `Frontend/app/api/multisig/status/[txId]/route.ts`

### P4-170: Add missing module export in deprecation.js
**Labels:** `phase-4`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/deprecation.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/middleware/deprecation.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/deprecation.js`

### P4-171: Verify remappings for REVOKE_FUNCTION_FEATURES.md
**Labels:** `phase-4`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_FEATURES.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/REVOKE_FUNCTION_FEATURES.md`

### P4-172: Fix broken links in PHASE_3.md
**Labels:** `phase-4`, `docs`
**Description:** Phase 4 docs pass — verify `PHASE_3.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `PHASE_3.md`

### P4-173: Add parallel job for upgradeManager.js
**Labels:** `phase-4`, `infra`
**Description:** Document how `Backend/jobs/upgradeManager.js` maps to staging vs production env vars. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/jobs/upgradeManager.js`

### P4-174: Expand negative tests in rate-limiter.decorator.ts
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/src/rate-limiter/rate-limiter.decorator.ts` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/rate-limiter/rate-limiter.decorator.ts`

### P4-175: Add vitest coverage for route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/multisig/wallet/[walletId]/route.ts` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/wallet/[walletId]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/multisig/wallet/[walletId]/route.ts`

### P4-176: Document setup for permissions.js
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/permissions.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/permissions.js`

### P4-177: Add Foundry test for REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md
**Labels:** `phase-4`, `contracts`
**Description:** Phase 4 ensures `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`
**Related:** `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`

### P4-178: Cross-link ADR in PHASE_4.md
**Labels:** `phase-4`, `docs`
**Description:** Reduce onboarding time: `PHASE_4.md` should answer "how do I run wallet + trade flow locally?" _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_4.md` verified on a clean checkout
**Related:** `PHASE_4.md`

### P4-179: Configure env matrix in package-lock.json
**Labels:** `phase-4`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/package-lock.json`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package-lock.json`

### P4-180: Add circuit breaker test for rate-limiter.guard.ts
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/rate-limiter/rate-limiter.guard.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.guard.ts`
**Related:** `Backend/src/rate-limiter/rate-limiter.guard.ts`

### P4-181: Validate env usage in route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/ping/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ping/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ping/route.ts`

### P4-182: Add health check for rateLimiter.js
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/middleware/rateLimiter.js` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/rateLimiter.js`

### P4-183: Add invariant test for REVOKE_FUNCTION_QUICK_START.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_QUICK_START.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_QUICK_START.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_QUICK_START.md`
**Related:** `Contracts/REVOKE_FUNCTION_QUICK_START.md`

### P4-184: Add phase checklist to PHASE_5.md
**Labels:** `phase-4`, `docs`
**Description:** Link `PHASE_5.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_5.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASE_5.md`

### P4-185: Configure secrets mapping for package.json
**Labels:** `phase-4`, `infra`
**Description:** Coordinate `Backend/package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/package.json`

### P4-186: Harden auth flow in rate-limiter.module.ts
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/src/rate-limiter/rate-limiter.module.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/rate-limiter/rate-limiter.module.ts`

### P4-187: Add empty state to route.ts
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/app/api/trending-markets/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/trending-markets/route.ts`

### P4-188: Ensure package scripts cover throttle.js
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/middleware/throttle.js`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/throttle.js`
**Related:** `Backend/middleware/throttle.js`

### P4-189: Add event coverage test for REVOKE_FUNCTION_README.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_README.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_README.md`

### P4-190: Add glossary entry in PR_INSTRUCTIONS.md
**Labels:** `phase-4`, `docs`
**Description:** Remove outdated implementation claims in `PR_INSTRUCTIONS.md` that contradict the codebase. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Commands in `PR_INSTRUCTIONS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_INSTRUCTIONS.md`

### P4-191: Add CI job for deploy.js
**Labels:** `phase-4`, `infra`
**Description:** Infra: `Backend/scripts/deploy.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/scripts/deploy.js`

### P4-192: Review oracle trust in rate-limiter.service.ts
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/src/rate-limiter/rate-limiter.service.ts` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/rate-limiter/rate-limiter.service.ts`

### P4-193: Wire wallet connect flow in page.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/archive/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/archive/page.tsx`

### P4-194: Add smoke test for tradeValidation.js
**Labels:** `phase-4`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/tradeValidation.js`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/tradeValidation.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/tradeValidation.js`

### P4-195: Align ABI export for RoleManager.sol
**Labels:** `phase-4`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/RoleManager.sol`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/RoleManager.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/RoleManager.sol`

### P4-196: Fuzz test verification.dto.ts
**Labels:** `phase-4`, `security`
**Description:** Security: review `Backend/src/verification/dto/verification.dto.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/verification/dto/verification.dto.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/verification/dto/verification.dto.ts`

### P4-197: Align route layout for page.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Phase 4 requires `Frontend/app/audit/page.tsx` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/audit/page.tsx`

### P4-198: Stabilize boot sequence of version.js
**Labels:** `phase-4`, `backend`
**Description:** Contributors report friction around `Backend/middleware/version.js`; eliminate silent failures on `npm run start:dev`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/version.js`
**Related:** `Backend/middleware/version.js`

### P4-199: Resolve import path in VERIFICATION_REPORT.md
**Labels:** `phase-4`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/VERIFICATION_REPORT.md` in README or contract comments. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/VERIFICATION_REPORT.md`
- [ ] `forge build` succeeds with `Contracts/VERIFICATION_REPORT.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/VERIFICATION_REPORT.md`

### P4-200: Add chaos scenario for verification.controller.ts
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/verification/verification.controller.ts`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/verification/verification.controller.ts`
**Related:** `Backend/src/verification/verification.controller.ts`

### P4-201: Stabilize hydration in BridgeClient.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/bridge/BridgeClient.tsx` builds under `Frontend/` Next.js app without runtime errors. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/bridge/BridgeClient.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/bridge/BridgeClient.tsx`

### P4-202: Fix lint violations in 001_init_markets.js
**Labels:** `phase-4`, `backend`
**Description:** Phase 4 stabilizes the repo; `Backend/migrations/001_init_markets.js` must match the canonical run path in README. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/migrations/001_init_markets.js`

### P4-203: Cross-check LMSR/CLOB usage in VOTEWEIGHT_CHECKLIST.md
**Labels:** `phase-4`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/VOTEWEIGHT_CHECKLIST.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/VOTEWEIGHT_CHECKLIST.md`
- [ ] `forge build` succeeds with `Contracts/VOTEWEIGHT_CHECKLIST.md`
**Related:** `Contracts/VOTEWEIGHT_CHECKLIST.md`

### P4-204: Review multisig policy in verification.module.ts
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/src/verification/verification.module.ts` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/verification/verification.module.ts`

### P4-205: Add vitest coverage for page.tsx
**Labels:** `phase-4`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/bridge/page.tsx` before beta. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/bridge/page.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/bridge/page.tsx`

### P4-206: Document setup for AuditLog.js
**Labels:** `phase-4`, `backend`
**Description:** Backend foundations: ensure `Backend/models/AuditLog.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/models/AuditLog.js`

### P4-207: Review rate limits for verification.service.spec.ts
**Labels:** `phase-4`, `security`
**Description:** Phase 4 security baseline — `Backend/src/verification/verification.service.spec.ts` must not expose admin routes or keys without guards. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/verification/verification.service.spec.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/verification/verification.service.spec.ts`

### P4-208: Add input validation to verification.service.ts
**Labels:** `phase-4`, `security`
**Description:** Align `Backend/src/verification/verification.service.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/verification/verification.service.ts`

### P4-209: Document threat model for multisig.test.js
**Labels:** `phase-4`, `security`
**Description:** Document trust assumptions for `Backend/test/multisig.test.js` (oracles, multisig, beta access). _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/test/multisig.test.js`

### P4-210: Review reentrancy surface in CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-4`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `CIRCUIT_BREAKER_IMPLEMENTATION.md`. _(Phase 4: hardening.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `CIRCUIT_BREAKER_IMPLEMENTATION.md`
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`
