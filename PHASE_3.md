# Phase 3: Product complete

> **Theme:** Product complete
> **Goal:** Complete user-facing surfaces: wallet, trade, portfolio, market discovery, notifications, settings, and polish for beta users.

> **Area distribution:** frontend 42, backend 38, contracts 32, docs 34, infra 32, security 32 (210 issues)

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).
Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.

### P3-001: Wire notifications in ARBITRAGE_DEMO.md
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/ARBITRAGE_DEMO.md` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ARBITRAGE_DEMO.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ARBITRAGE_DEMO.md`

### P3-002: Remove dead code in .env.example
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/.env.example` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/.env.example`

### P3-003: Pin dependency version in test.yml
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/.github/workflows/test.yml` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/.github/workflows/test.yml`
- [ ] `forge build` succeeds with `Contracts/.github/workflows/test.yml`
**Related:** `Contracts/.github/workflows/test.yml`

### P3-004: Refresh stale claims in BUG_ANALYSIS_REPORT.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `BUG_ANALYSIS_REPORT.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `BUG_ANALYSIS_REPORT.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `BUG_ANALYSIS_REPORT.md`

### P3-005: Add branch protection rule for ci.yml
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `.github/workflows/ci.yml`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `.github/workflows/ci.yml`

### P3-006: Add audit log for rateLimits.js
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/config/rateLimits.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/config/rateLimits.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/config/rateLimits.js`

### P3-007: Fix Next.js boot error in ERROR_BOUNDARY_CHECKLIST.md
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/ERROR_BOUNDARY_CHECKLIST.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/ERROR_BOUNDARY_CHECKLIST.md`

### P3-008: Fix lint violations in API_PROTECTION_README.md
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/API_PROTECTION_README.md` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/API_PROTECTION_README.md`
**Related:** `Backend/API_PROTECTION_README.md`

### P3-009: Cross-check LMSR/CLOB usage in API_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/API_REFERENCE.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/API_REFERENCE.md`

### P3-010: Summarize implementation status in CHECKLIST.md
**Labels:** `phase-3`, `docs`
**Description:** Link `CHECKLIST.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `CHECKLIST.md`

### P3-011: Add monitoring hook for .env.example
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Backend/.env.example` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/.env.example`

### P3-012: Audit access control in ddosGuard.js
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/middleware/ddosGuard.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/middleware/ddosGuard.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/middleware/ddosGuard.js`

### P3-013: Align route layout for ERROR_BOUNDARY_DOCUMENTATION.md
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`

### P3-014: Unify Express/Nest path for COLLATERAL.md
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/COLLATERAL.md`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/COLLATERAL.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/COLLATERAL.md`

### P3-015: Fix compiler warning in BUG_ANALYSIS_AND_FIXES.md
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/BUG_ANALYSIS_AND_FIXES.md` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/BUG_ANALYSIS_AND_FIXES.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/BUG_ANALYSIS_AND_FIXES.md`

### P3-016: Add CONTRIBUTING note for CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `CIRCUIT_BREAKER_IMPLEMENTATION.md` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`

### P3-017: Document deploy path for upgradeManager.js
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Backend/jobs/upgradeManager.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/jobs/upgradeManager.js`

### P3-018: Add circuit breaker check for rateLimiter.js
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/middleware/rateLimiter.js` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/rateLimiter.js`

### P3-019: Connect WebSocket hook in ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` fits the app shell
**Related:** `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`

### P3-020: Resolve TypeScript errors in DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P3-021: Add fuzz harness for Burnable.sol
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/Burnable.sol`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/Burnable.sol`

### P3-022: Add onboarding step to CIRCUIT_BREAKER_QUICK_REFERENCE.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `CIRCUIT_BREAKER_QUICK_REFERENCE.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `CIRCUIT_BREAKER_QUICK_REFERENCE.md`

### P3-023: Stabilize pipeline for package-lock.json
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Backend/package-lock.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/package-lock.json`

### P3-024: Add slippage bounds in AuditLog.js
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/models/AuditLog.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/models/AuditLog.js`

### P3-025: Add loading skeleton to ERROR_BOUNDARY_QUICKSTART.md
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/ERROR_BOUNDARY_QUICKSTART.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/ERROR_BOUNDARY_QUICKSTART.md`

### P3-026: Add integration test for DEPOSIT_SERVICE_README.md
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/DEPOSIT_SERVICE_README.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P3-027: Verify forge build for CODE_REVIEW_REPORT.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/CODE_REVIEW_REPORT.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/CODE_REVIEW_REPORT.md`
**Related:** `Contracts/CODE_REVIEW_REPORT.md`

### P3-028: Add troubleshooting for CIRCUIT_BREAKER_VERIFICATION.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `CIRCUIT_BREAKER_VERIFICATION.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `CIRCUIT_BREAKER_VERIFICATION.md` verified on a clean checkout
**Related:** `CIRCUIT_BREAKER_VERIFICATION.md`

### P3-029: Add cache step for package.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `Backend/package.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package.json`

### P3-030: Document threat model for beta.js
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/routes/beta.js` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/beta.js`
**Related:** `Backend/routes/beta.js`

### P3-031: Finish referral UI in ERROR_BOUNDARY_SUMMARY.md
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/ERROR_BOUNDARY_SUMMARY.md` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ERROR_BOUNDARY_SUMMARY.md`

### P3-032: Remove dead code in IMPLEMENTATION.md
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/IMPLEMENTATION.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/IMPLEMENTATION.md`

### P3-033: Pin dependency version in FLASHBORROW_DOCUMENTATION.md
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/FLASHBORROW_DOCUMENTATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_DOCUMENTATION.md`
**Related:** `Contracts/FLASHBORROW_DOCUMENTATION.md`

### P3-034: Refresh stale claims in DELIVERY_SUMMARY.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `DELIVERY_SUMMARY.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `DELIVERY_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `DELIVERY_SUMMARY.md`

### P3-035: Add branch protection rule for deploy.js
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/scripts/deploy.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/scripts/deploy.js`

### P3-036: Add audit log for blacklist.js
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/routes/blacklist.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/blacklist.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/routes/blacklist.js`

### P3-037: Validate env usage in README.md
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/README.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/README.md`

### P3-038: Fix lint violations in LIQUIDATION.md
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/LIQUIDATION.md` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/LIQUIDATION.md`
**Related:** `Backend/LIQUIDATION.md`

### P3-039: Cross-check LMSR/CLOB usage in FLASHBORROW_README.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/FLASHBORROW_README.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_README.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/FLASHBORROW_README.md`

### P3-040: Summarize implementation status in DOES_IT_WORK_ANSWER.md
**Labels:** `phase-3`, `docs`
**Description:** Link `DOES_IT_WORK_ANSWER.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `DOES_IT_WORK_ANSWER.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `DOES_IT_WORK_ANSWER.md`

### P3-041: Add monitoring hook for deployService.js
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Backend/services/deployService.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P3-042: Audit access control in circuitBreaker.js
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/routes/circuitBreaker.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/routes/circuitBreaker.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/routes/circuitBreaker.js`

### P3-043: Add empty state to SETTINGS_DOCUMENTATION.md
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/SETTINGS_DOCUMENTATION.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/SETTINGS_DOCUMENTATION.md`

### P3-044: Unify Express/Nest path for MARGIN.md
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/MARGIN.md`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/MARGIN.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/MARGIN.md`

### P3-045: Fix compiler warning in FlashLoanProtection.sol
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/FlashLoanProtection.sol` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/FlashLoanProtection.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/FlashLoanProtection.sol`

### P3-046: Add CONTRIBUTING note for FEATURE_SUMMARY.md
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `FEATURE_SUMMARY.md` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `FEATURE_SUMMARY.md`

### P3-047: Document deploy path for upgradeCoordinator.js
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Backend/services/upgradeCoordinator.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P3-048: Add circuit breaker check for multisig.js
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/routes/multisig.js` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/multisig.js`

### P3-049: Implement responsive layout for SETTINGS_QUICKSTART.md
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/SETTINGS_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_QUICKSTART.md` fits the app shell
**Related:** `Frontend/SETTINGS_QUICKSTART.md`

### P3-050: Resolve TypeScript errors in README.md
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/README.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/README.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/README.md`

### P3-051: Add fuzz harness for GAS_OPTIMIZATION_REPORT.md
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/GAS_OPTIMIZATION_REPORT.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/GAS_OPTIMIZATION_REPORT.md`

### P3-052: Add onboarding step to FINAL_VERIFICATION_REPORT.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `FINAL_VERIFICATION_REPORT.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `FINAL_VERIFICATION_REPORT.md`

### P3-053: Stabilize pipeline for deploy.test.js
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Backend/tests/deploy.test.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tests/deploy.test.js`

### P3-054: Add slippage bounds in whitelist.js
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/routes/whitelist.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/routes/whitelist.js`

### P3-055: Add pagination to SETTINGS_SUMMARY.md
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/SETTINGS_SUMMARY.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/SETTINGS_SUMMARY.md`

### P3-056: Add integration test for RISK.md
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/RISK.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/RISK.md`

### P3-057: Verify forge build for INTEGRATION_GUIDE.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/INTEGRATION_GUIDE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/INTEGRATION_GUIDE.md`
**Related:** `Contracts/INTEGRATION_GUIDE.md`

### P3-058: Add troubleshooting for FLASHBORROW_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
**Related:** `FLASHBORROW_IMPLEMENTATION_SUMMARY.md`

### P3-059: Add cache step for tsconfig.build.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `Backend/tsconfig.build.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tsconfig.build.json`

### P3-060: Document threat model for auditTrail.js
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/services/auditTrail.js` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/auditTrail.js`
**Related:** `Backend/services/auditTrail.js`

### P3-061: Add error boundary around TRADING_INTERFACE_DOCUMENTATION.md
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`

### P3-062: Remove dead code in TRADE_REPORTS.md
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/TRADE_REPORTS.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/TRADE_REPORTS.md`

### P3-063: Pin dependency version in Liquidation.sol
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/Liquidation.sol` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/Liquidation.sol`
- [ ] `forge build` succeeds with `Contracts/Liquidation.sol`
**Related:** `Contracts/Liquidation.sol`

### P3-064: Refresh stale claims in FLASHBORROW_VERIFICATION.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `FLASHBORROW_VERIFICATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_VERIFICATION.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `FLASHBORROW_VERIFICATION.md`

### P3-065: Add branch protection rule for tsconfig.json
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/tsconfig.json`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.json`

### P3-066: Add audit log for betaAccess.js
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/services/betaAccess.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/betaAccess.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/services/betaAccess.js`

### P3-067: Stabilize hydration in TRADING_INTERFACE_QUICKSTART.md
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/TRADING_INTERFACE_QUICKSTART.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/TRADING_INTERFACE_QUICKSTART.md`

### P3-068: Fix lint violations in TRADE_REPORTS_SETUP.md
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/TRADE_REPORTS_SETUP.md` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/TRADE_REPORTS_SETUP.md`
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P3-069: Cross-check LMSR/CLOB usage in MARKET_CAP_IMPLEMENTATION.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_CAP_IMPLEMENTATION.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_CAP_IMPLEMENTATION.md`

### P3-070: Summarize implementation status in README.md
**Labels:** `phase-3`, `docs`
**Description:** Link `Frontend/README.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `Frontend/README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `Frontend/README.md`

### P3-071: Add monitoring hook for test.yml
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Contracts/.github/workflows/test.yml` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/.github/workflows/test.yml`

### P3-072: Audit access control in blacklistService.js
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/services/blacklistService.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/services/blacklistService.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/services/blacklistService.js`

### P3-073: Add empty-state UI to TRADING_INTERFACE_SUMMARY.md
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/TRADING_INTERFACE_SUMMARY.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/TRADING_INTERFACE_SUMMARY.md`

### P3-074: Unify Express/Nest path for UPTIME_MONITORING.md
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/UPTIME_MONITORING.md`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/UPTIME_MONITORING.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/UPTIME_MONITORING.md`

### P3-075: Fix compiler warning in MARKET_DELEGATION_API_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_DELEGATION_API_REFERENCE.md` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_DELEGATION_API_REFERENCE.md`

### P3-076: Add CONTRIBUTING note for IMPLEMENTATION_CHECKLIST.md
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_CHECKLIST.md` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_CHECKLIST.md`

### P3-077: Document deploy path for foundry.toml
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Contracts/foundry.toml` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/foundry.toml`

### P3-078: Add circuit breaker check for multisigService.js
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/services/multisigService.js` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/multisigService.js`

### P3-079: Implement search/filter in WEBSOCKET_IMPLEMENTATION.md
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_IMPLEMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_IMPLEMENTATION.md` fits the app shell
**Related:** `Frontend/WEBSOCKET_IMPLEMENTATION.md`

### P3-080: Resolve TypeScript errors in pagerduty.js
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/config/pagerduty.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/config/pagerduty.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/config/pagerduty.js`

### P3-081: Add fuzz harness for MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`

### P3-082: Add onboarding step to IMPLEMENTATION_COMPLETE.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `IMPLEMENTATION_COMPLETE.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `IMPLEMENTATION_COMPLETE.md`

### P3-083: Stabilize pipeline for package-lock.json
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Contracts/package-lock.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/package-lock.json`

### P3-084: Add slippage bounds in whitelistService.js
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/services/whitelistService.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/services/whitelistService.js`

### P3-085: Replace mock data in WEBSOCKET_INTEGRATION_EXAMPLES.md
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`

### P3-086: Add integration test for rateLimits.js
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/config/rateLimits.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/config/rateLimits.js`

### P3-087: Verify forge build for MARKET_DELEGATION_QUICK_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`
**Related:** `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`

### P3-088: Add troubleshooting for IMPLEMENTATION_REPORT.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `IMPLEMENTATION_REPORT.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_REPORT.md` verified on a clean checkout
**Related:** `IMPLEMENTATION_REPORT.md`

### P3-089: Add cache step for package.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `Contracts/package.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package.json`

### P3-090: Document threat model for auth.controller.ts
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/auth.controller.ts` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.controller.ts`
**Related:** `Backend/src/auth/auth.controller.ts`

### P3-091: Document component props in WEBSOCKET_QUICKSTART.md
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/WEBSOCKET_QUICKSTART.md` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/WEBSOCKET_QUICKSTART.md`

### P3-092: Remove dead code in eslint.config.mjs
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/eslint.config.mjs` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/eslint.config.mjs`

### P3-093: Pin dependency version in MARKET_DELEGATION_README.md
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/MARKET_DELEGATION_README.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_README.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_README.md`
**Related:** `Contracts/MARKET_DELEGATION_README.md`

### P3-094: Refresh stale claims in IMPLEMENTATION_SUCCESS.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_SUCCESS.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_SUCCESS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `IMPLEMENTATION_SUCCESS.md`

### P3-095: Add branch protection rule for DeployMarketCap.s.sol
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/script/DeployMarketCap.s.sol`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P3-096: Add audit log for auth.module.ts
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/auth.module.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/auth.module.ts`

### P3-097: Polish UX in WEBSOCKET_SUMMARY.md
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/WEBSOCKET_SUMMARY.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/WEBSOCKET_SUMMARY.md`

### P3-098: Fix lint violations in heartbeatServer.js
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/heartbeatServer.js` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/heartbeatServer.js`
**Related:** `Backend/heartbeatServer.js`

### P3-099: Cross-check LMSR/CLOB usage in MARKET_RELAY_IMPLEMENTATION.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_RELAY_IMPLEMENTATION.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_RELAY_IMPLEMENTATION.md`

### P3-100: Summarize implementation status in IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-3`, `docs`
**Description:** Link `IMPLEMENTATION_SUMMARY.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `IMPLEMENTATION_SUMMARY.md`

### P3-101: Add monitoring hook for DeployRevokeFunction.s.sol
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Contracts/script/DeployRevokeFunction.s.sol` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P3-102: Audit access control in auth.service.ts
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/src/auth/auth.service.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/auth/auth.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/auth/auth.service.ts`

### P3-103: Complete form validation in page.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/analytics/page.tsx` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/analytics/page.tsx`

### P3-104: Unify Express/Nest path for arbitrageMonitor.js
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/jobs/arbitrageMonitor.js`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/arbitrageMonitor.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P3-105: Fix compiler warning in MARKET_RELAY_INTEGRATION_GUIDE.md
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`

### P3-106: Add CONTRIBUTING note for IMPLEMENTATION_VERIFIED.txt
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_VERIFIED.txt` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_VERIFIED.txt`

### P3-107: Document deploy path for DeployVoteWeight.s.sol
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Contracts/script/DeployVoteWeight.s.sol` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P3-108: Add circuit breaker check for auth.dto.ts
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/src/auth/dto/auth.dto.ts` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P3-109: Wire wallet connect flow in page.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api-keys/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api-keys/page.tsx` fits the app shell
**Related:** `Frontend/app/api-keys/page.tsx`

### P3-110: Resolve TypeScript errors in batchExecutor.js
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/batchExecutor.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/batchExecutor.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/batchExecutor.js`

### P3-111: Add fuzz harness for MARKET_RELAY_QUICK_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`

### P3-112: Add onboarding step to LIQUIDATION_IMPLEMENTATION.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `LIQUIDATION_IMPLEMENTATION.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `LIQUIDATION_IMPLEMENTATION.md`

### P3-113: Stabilize pipeline for hardhat.config.js
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Frontend/localnet/hardhat.config.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/localnet/hardhat.config.js`

### P3-114: Add slippage bounds in user.entity.ts
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/src/auth/entities/user.entity.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P3-115: Fix TypeScript path alias in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/ipfs/gateway/[hash]/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/gateway/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/ipfs/gateway/[hash]/route.ts`

### P3-116: Add integration test for complianceChecker.js
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/complianceChecker.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/complianceChecker.js`

### P3-117: Verify forge build for MARKET_RELAY_README.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_RELAY_README.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_README.md`
**Related:** `Contracts/MARKET_RELAY_README.md`

### P3-118: Add troubleshooting for LIQUIDATION_QUICK_START.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `LIQUIDATION_QUICK_START.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `LIQUIDATION_QUICK_START.md` verified on a clean checkout
**Related:** `LIQUIDATION_QUICK_START.md`

### P3-119: Add cache step for package.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `Frontend/localnet/package.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/package.json`

### P3-120: Document threat model for jwt-auth.guard.ts
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/guards/jwt-auth.guard.ts` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/guards/jwt-auth.guard.ts`
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P3-121: Add vitest coverage for route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/ipfs/pin/[hash]/route.ts` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/pin/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ipfs/pin/[hash]/route.ts`

### P3-122: Remove dead code in heartbeatMonitor.js
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/heartbeatMonitor.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P3-123: Pin dependency version in MARKET_RELAY_SECURITY_ANALYSIS.md
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
**Related:** `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

### P3-124: Refresh stale claims in MARKET_DELEGATION_CHECKLIST.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `MARKET_DELEGATION_CHECKLIST.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MARKET_DELEGATION_CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `MARKET_DELEGATION_CHECKLIST.md`

### P3-125: Add branch protection rule for deploy.js
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/localnet/scripts/deploy.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/scripts/deploy.js`

### P3-126: Add audit log for jwt.strategy.ts
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/strategies/jwt.strategy.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/strategies/jwt.strategy.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P3-127: Add accessibility pass on route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/ipfs/retrieve/[hash]/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`

### P3-128: Fix lint violations in liquidationMonitor.js
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/jobs/liquidationMonitor.js` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/liquidationMonitor.js`
**Related:** `Backend/jobs/liquidationMonitor.js`

### P3-129: Cross-check LMSR/CLOB usage in MarketMinter.sol
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MarketMinter.sol`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MarketMinter.sol`
- [ ] `forge build` succeeds with `Contracts/MarketMinter.sol`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MarketMinter.sol`

### P3-130: Summarize implementation status in MARKET_DELEGATION_COMPLETE.md
**Labels:** `phase-3`, `docs`
**Description:** Link `MARKET_DELEGATION_COMPLETE.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `MARKET_DELEGATION_COMPLETE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `MARKET_DELEGATION_COMPLETE.md`

### P3-131: Add monitoring hook for package-lock.json
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Frontend/package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Frontend/package-lock.json`

### P3-132: Audit access control in market-audit.dto.ts
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/src/market-audit/dto/market-audit.dto.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/dto/market-audit.dto.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/dto/market-audit.dto.ts`

### P3-133: Add loading skeleton to route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/api/ipfs/upload-json/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/ipfs/upload-json/route.ts`

### P3-134: Unify Express/Nest path for sanityCheck.js
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/jobs/sanityCheck.js`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/sanityCheck.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/sanityCheck.js`

### P3-135: Fix compiler warning in QUICK_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/QUICK_REFERENCE.md` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/QUICK_REFERENCE.md`

### P3-136: Add CONTRIBUTING note for MARKET_RELAY_DELIVERY_SUMMARY.md
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `MARKET_RELAY_DELIVERY_SUMMARY.md` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `MARKET_RELAY_DELIVERY_SUMMARY.md`

### P3-137: Document deploy path for package.json
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Frontend/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Frontend/package.json`

### P3-138: Add circuit breaker check for market-audit.controller.ts
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/src/market-audit/market-audit.controller.ts` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/market-audit/market-audit.controller.ts`

### P3-139: Add smoke test for route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/market-audit/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-audit/route.ts` fits the app shell
**Related:** `Frontend/app/api/market-audit/route.ts`

### P3-140: Resolve TypeScript errors in snapshotCapture.js
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/snapshotCapture.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/snapshotCapture.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/snapshotCapture.js`

### P3-141: Add fuzz harness for README.md
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/README.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/README.md`

### P3-142: Add onboarding step to MARKET_RELAY_FILES_CHECKLIST.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `MARKET_RELAY_FILES_CHECKLIST.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `MARKET_RELAY_FILES_CHECKLIST.md`

### P3-143: Stabilize pipeline for tsconfig.json
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Frontend/tsconfig.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/tsconfig.json`

### P3-144: Add slippage bounds in market-audit.entity.ts
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/src/market-audit/market-audit.entity.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/market-audit/market-audit.entity.ts`

### P3-145: Fix responsive layout in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/market-sentiment/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-sentiment/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/market-sentiment/route.ts`

### P3-146: Add integration test for tradeExecutor.js
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/tradeExecutor.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/tradeExecutor.js`

### P3-147: Verify forge build for README_MARKETCAP.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/README_MARKETCAP.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_MARKETCAP.md`
**Related:** `Contracts/README_MARKETCAP.md`

### P3-148: Add troubleshooting for MINTING_PAUSABLE_IMPLEMENTATION.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `MINTING_PAUSABLE_IMPLEMENTATION.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MINTING_PAUSABLE_IMPLEMENTATION.md` verified on a clean checkout
**Related:** `MINTING_PAUSABLE_IMPLEMENTATION.md`

### P3-149: Add cache step for package-lock.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `package-lock.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `package-lock.json`

### P3-150: Document threat model for market-audit.module.ts
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/market-audit.module.ts` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.module.ts`
**Related:** `Backend/src/market-audit/market-audit.module.ts`

### P3-151: Wire notifications in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/multisig/execute/route.ts` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/execute/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/multisig/execute/route.ts`

### P3-152: Remove dead code in upgradeManager.js
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/upgradeManager.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/upgradeManager.js`

### P3-153: Pin dependency version in README_VOTE_DELEGATION.md
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/README_VOTE_DELEGATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_VOTE_DELEGATION.md`
- [ ] `forge build` succeeds with `Contracts/README_VOTE_DELEGATION.md`
**Related:** `Contracts/README_VOTE_DELEGATION.md`

### P3-154: Refresh stale claims in PHASES.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `PHASES.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASES.md`

### P3-155: Add branch protection rule for package.json
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `package.json`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `package.json`

### P3-156: Add audit log for market-audit.service.spec.ts
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/market-audit.service.spec.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.spec.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/market-audit/market-audit.service.spec.ts`

### P3-157: Fix Next.js boot error in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/multisig/propose/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/multisig/propose/route.ts`

### P3-158: Fix lint violations in backwardCompat.js
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/middleware/backwardCompat.js` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/backwardCompat.js`
**Related:** `Backend/middleware/backwardCompat.js`

### P3-159: Cross-check LMSR/CLOB usage in REVOKE_FUNCTION_API_REFERENCE.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`

### P3-160: Summarize implementation status in PHASE_1.md
**Labels:** `phase-3`, `docs`
**Description:** Link `PHASE_1.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `PHASE_1.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PHASE_1.md`

### P3-161: Add monitoring hook for ci.yml
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `.github/workflows/ci.yml` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `.github/workflows/ci.yml`

### P3-162: Audit access control in market-audit.service.ts
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/src/market-audit/market-audit.service.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/market-audit.service.ts`

### P3-163: Align route layout for route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/api/multisig/sign/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/multisig/sign/route.ts`

### P3-164: Unify Express/Nest path for ddosGuard.js
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/middleware/ddosGuard.js`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/ddosGuard.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/ddosGuard.js`

### P3-165: Fix compiler warning in REVOKE_FUNCTION_DOCUMENTATION.md
**Labels:** `phase-3`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md` in README or contract comments. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`

### P3-166: Add CONTRIBUTING note for PHASE_2.md
**Labels:** `phase-3`, `docs`
**Description:** Remove outdated implementation claims in `PHASE_2.md` that contradict the codebase. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `PHASE_2.md`

### P3-167: Document deploy path for .env.example
**Labels:** `phase-3`, `infra`
**Description:** Infra: `Backend/.env.example` must be part of reproducible local and CI builds for GateDelay. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/.env.example`

### P3-168: Add circuit breaker check for rate-limiter.config.ts
**Labels:** `phase-3`, `security`
**Description:** Phase 3 security baseline — `Backend/src/rate-limiter/rate-limiter.config.ts` must not expose admin routes or keys without guards. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/rate-limiter/rate-limiter.config.ts`

### P3-169: Connect WebSocket hook in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/status/[txId]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/status/[txId]/route.ts` fits the app shell
**Related:** `Frontend/app/api/multisig/status/[txId]/route.ts`

### P3-170: Resolve TypeScript errors in deprecation.js
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/deprecation.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/middleware/deprecation.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/deprecation.js`

### P3-171: Add fuzz harness for REVOKE_FUNCTION_FEATURES.md
**Labels:** `phase-3`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_FEATURES.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/REVOKE_FUNCTION_FEATURES.md`

### P3-172: Add onboarding step to PHASE_3.md
**Labels:** `phase-3`, `docs`
**Description:** Documentation: `PHASE_3.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `PHASE_3.md`

### P3-173: Stabilize pipeline for upgradeManager.js
**Labels:** `phase-3`, `infra`
**Description:** Phase 3 CI — ensure `Backend/jobs/upgradeManager.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/jobs/upgradeManager.js`

### P3-174: Add slippage bounds in rate-limiter.decorator.ts
**Labels:** `phase-3`, `security`
**Description:** Align `Backend/src/rate-limiter/rate-limiter.decorator.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/rate-limiter/rate-limiter.decorator.ts`

### P3-175: Add loading skeleton to route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/multisig/wallet/[walletId]/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/wallet/[walletId]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/multisig/wallet/[walletId]/route.ts`

### P3-176: Add integration test for permissions.js
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/permissions.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/permissions.js`

### P3-177: Verify forge build for REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md
**Labels:** `phase-3`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`
**Related:** `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`

### P3-178: Add troubleshooting for PHASE_4.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `PHASE_4.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_4.md` verified on a clean checkout
**Related:** `PHASE_4.md`

### P3-179: Add cache step for package-lock.json
**Labels:** `phase-3`, `infra`
**Description:** Document how `Backend/package-lock.json` maps to staging vs production env vars. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package-lock.json`

### P3-180: Document threat model for rate-limiter.guard.ts
**Labels:** `phase-3`, `security`
**Description:** Document trust assumptions for `Backend/src/rate-limiter/rate-limiter.guard.ts` (oracles, multisig, beta access). _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.guard.ts`
**Related:** `Backend/src/rate-limiter/rate-limiter.guard.ts`

### P3-181: Finish referral UI in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/ping/route.ts` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ping/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ping/route.ts`

### P3-182: Remove dead code in rateLimiter.js
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/rateLimiter.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/rateLimiter.js`

### P3-183: Pin dependency version in REVOKE_FUNCTION_QUICK_START.md
**Labels:** `phase-3`, `contracts`
**Description:** Phase 3 ensures `Contracts/REVOKE_FUNCTION_QUICK_START.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_QUICK_START.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_QUICK_START.md`
**Related:** `Contracts/REVOKE_FUNCTION_QUICK_START.md`

### P3-184: Refresh stale claims in PHASE_5.md
**Labels:** `phase-3`, `docs`
**Description:** Reduce onboarding time: `PHASE_5.md` should answer "how do I run wallet + trade flow locally?" _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_5.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASE_5.md`

### P3-185: Add branch protection rule for package.json
**Labels:** `phase-3`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/package.json`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/package.json`

### P3-186: Add audit log for rate-limiter.module.ts
**Labels:** `phase-3`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/rate-limiter/rate-limiter.module.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/rate-limiter/rate-limiter.module.ts`

### P3-187: Validate env usage in route.ts
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/trending-markets/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/trending-markets/route.ts`

### P3-188: Fix lint violations in throttle.js
**Labels:** `phase-3`, `backend`
**Description:** Phase 3 stabilizes the repo; `Backend/middleware/throttle.js` must match the canonical run path in README. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/throttle.js`
**Related:** `Backend/middleware/throttle.js`

### P3-189: Cross-check LMSR/CLOB usage in REVOKE_FUNCTION_README.md
**Labels:** `phase-3`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_README.md`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_README.md`

### P3-190: Summarize implementation status in PR_INSTRUCTIONS.md
**Labels:** `phase-3`, `docs`
**Description:** Link `PR_INSTRUCTIONS.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `PR_INSTRUCTIONS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_INSTRUCTIONS.md`

### P3-191: Add monitoring hook for deploy.js
**Labels:** `phase-3`, `infra`
**Description:** Coordinate `Backend/scripts/deploy.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/scripts/deploy.js`

### P3-192: Audit access control in rate-limiter.service.ts
**Labels:** `phase-3`, `security`
**Description:** Security: review `Backend/src/rate-limiter/rate-limiter.service.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/rate-limiter/rate-limiter.service.ts`

### P3-193: Add empty state to page.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/archive/page.tsx` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/archive/page.tsx`

### P3-194: Unify Express/Nest path for tradeValidation.js
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/middleware/tradeValidation.js`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/tradeValidation.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/tradeValidation.js`

### P3-195: Align README with PR_TEMPLATE.md
**Labels:** `phase-3`, `docs`
**Description:** Link `PR_TEMPLATE.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Commands in `PR_TEMPLATE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_TEMPLATE.md`

### P3-196: Add vitest coverage for page.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/audit/page.tsx` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/audit/page.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/audit/page.tsx`

### P3-197: Remove dead code in version.js
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/version.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/version.js`

### P3-198: Add architecture diagram for PUSH_INSTRUCTIONS.md
**Labels:** `phase-3`, `docs`
**Description:** Phase 3 docs pass — verify `PUSH_INSTRUCTIONS.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PUSH_INSTRUCTIONS.md` verified on a clean checkout
**Related:** `PUSH_INSTRUCTIONS.md`

### P3-199: Implement responsive layout for BridgeClient.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/bridge/BridgeClient.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/bridge/BridgeClient.tsx` fits the app shell
**Related:** `Frontend/app/bridge/BridgeClient.tsx`

### P3-200: Resolve TypeScript errors in 001_init_markets.js
**Labels:** `phase-3`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/migrations/001_init_markets.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/migrations/001_init_markets.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/migrations/001_init_markets.js`

### P3-201: Wire notifications in page.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/bridge/page.tsx` before beta. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/bridge/page.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/bridge/page.tsx`

### P3-202: Consolidate duplicate logic in AuditLog.js
**Labels:** `phase-3`, `backend`
**Description:** Backend foundations: ensure `Backend/models/AuditLog.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/models/AuditLog.js`

### P3-203: Complete form validation in ConnectKitBridge.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/components/ConnectKitBridge.tsx` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/components/ConnectKitBridge.tsx`

### P3-204: Ensure package scripts cover Balance.js
**Labels:** `phase-3`, `backend`
**Description:** Contributors report friction around `Backend/models/Balance.js`; eliminate silent failures on `npm run start:dev`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/models/Balance.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/models/Balance.js`

### P3-205: Add pagination to ConnectivityProvider.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/components/ConnectivityProvider.tsx` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/components/ConnectivityProvider.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/components/ConnectivityProvider.tsx`

### P3-206: Add integration test for Collateral.js
**Labels:** `phase-3`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/models/Collateral.js`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/models/Collateral.js`

### P3-207: Fix Next.js boot error in DarkModeToggle.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/components/DarkModeToggle.tsx` builds under `Frontend/` Next.js app without runtime errors. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/components/DarkModeToggle.tsx`

### P3-208: Add loading skeleton to FlightSearchAutocomplete.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Phase 3 requires `Frontend/app/components/FlightSearchAutocomplete.tsx` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/components/FlightSearchAutocomplete.tsx`

### P3-209: Wire wallet connect flow in GlobalErrorHandler.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/components/GlobalErrorHandler.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/components/GlobalErrorHandler.tsx` fits the app shell
**Related:** `Frontend/app/components/GlobalErrorHandler.tsx`

### P3-210: Replace mock data in Navbar.tsx
**Labels:** `phase-3`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/components/Navbar.tsx` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 3: product complete.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/components/Navbar.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/components/Navbar.tsx`
