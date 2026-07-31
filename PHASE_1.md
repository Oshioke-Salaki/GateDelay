# Phase 1: Stabilize foundations

> **Theme:** Stabilize foundations
> **Goal:** Docs, build/run reproducibility, unify Backend runtime paths, fix critical boot/blocker bugs, and establish contributor onboarding across all layers.

> **Area distribution:** frontend 33, backend 37, contracts 32, docs 38, infra 38, security 32 (210 issues)

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).
Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.

### P1-001: Wire wallet connect flow in ARBITRAGE_DEMO.md
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/ARBITRAGE_DEMO.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ARBITRAGE_DEMO.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ARBITRAGE_DEMO.md`

### P1-002: Add smoke test for .env.example
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/.env.example`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/.env.example`

### P1-003: Align ABI export for test.yml
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/.github/workflows/test.yml`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/.github/workflows/test.yml`
- [ ] `forge build` succeeds with `Contracts/.github/workflows/test.yml`
**Related:** `Contracts/.github/workflows/test.yml`

### P1-004: Document env matrix in BUG_ANALYSIS_REPORT.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `BUG_ANALYSIS_REPORT.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `BUG_ANALYSIS_REPORT.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `BUG_ANALYSIS_REPORT.md`

### P1-005: Add smoke test post-build for ci.yml
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `.github/workflows/ci.yml` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `.github/workflows/ci.yml`

### P1-006: Pen-test endpoint behind rateLimits.js
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/config/rateLimits.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/config/rateLimits.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/config/rateLimits.js`

### P1-007: Fix TypeScript path alias in ERROR_BOUNDARY_CHECKLIST.md
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/ERROR_BOUNDARY_CHECKLIST.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/ERROR_BOUNDARY_CHECKLIST.md`

### P1-008: Add missing module export in API_PROTECTION_README.md
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/API_PROTECTION_README.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/API_PROTECTION_README.md`
**Related:** `Backend/API_PROTECTION_README.md`

### P1-009: Verify remappings for API_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/API_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/API_REFERENCE.md`

### P1-010: Fix broken links in CHECKLIST.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `CHECKLIST.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `CHECKLIST.md`

### P1-011: Add parallel job for .env.example
**Labels:** `phase-1`, `infra`
**Description:** Document how `Backend/.env.example` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/.env.example`

### P1-012: Review CORS policy for ddosGuard.js
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/middleware/ddosGuard.js` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/middleware/ddosGuard.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/middleware/ddosGuard.js`

### P1-013: Add vitest coverage for ERROR_BOUNDARY_DOCUMENTATION.md
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`

### P1-014: Document setup for COLLATERAL.md
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/COLLATERAL.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/COLLATERAL.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/COLLATERAL.md`

### P1-015: Add Foundry test for BUG_ANALYSIS_AND_FIXES.md
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/BUG_ANALYSIS_AND_FIXES.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/BUG_ANALYSIS_AND_FIXES.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/BUG_ANALYSIS_AND_FIXES.md`

### P1-016: Cross-link ADR in CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `CIRCUIT_BREAKER_IMPLEMENTATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`

### P1-017: Configure env matrix in upgradeManager.js
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/jobs/upgradeManager.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/jobs/upgradeManager.js`

### P1-018: Review reentrancy surface in rateLimiter.js
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/middleware/rateLimiter.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/rateLimiter.js`

### P1-019: Validate env usage in ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` fits the app shell
**Related:** `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`

### P1-020: Add health check for DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P1-021: Add invariant test for Burnable.sol
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/Burnable.sol`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/Burnable.sol`

### P1-022: Add phase checklist to CIRCUIT_BREAKER_QUICK_REFERENCE.md
**Labels:** `phase-1`, `docs`
**Description:** Link `CIRCUIT_BREAKER_QUICK_REFERENCE.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `CIRCUIT_BREAKER_QUICK_REFERENCE.md`

### P1-023: Configure secrets mapping for package-lock.json
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Backend/package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/package-lock.json`

### P1-024: Fuzz abuse path in AuditLog.js
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/models/AuditLog.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/models/AuditLog.js`

### P1-025: Add empty state to ERROR_BOUNDARY_QUICKSTART.md
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/ERROR_BOUNDARY_QUICKSTART.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/ERROR_BOUNDARY_QUICKSTART.md`

### P1-026: Ensure package scripts cover DEPOSIT_SERVICE_README.md
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/DEPOSIT_SERVICE_README.md`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P1-027: Add event coverage test for CODE_REVIEW_REPORT.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/CODE_REVIEW_REPORT.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/CODE_REVIEW_REPORT.md`
**Related:** `Contracts/CODE_REVIEW_REPORT.md`

### P1-028: Add glossary entry in CIRCUIT_BREAKER_VERIFICATION.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `CIRCUIT_BREAKER_VERIFICATION.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `CIRCUIT_BREAKER_VERIFICATION.md` verified on a clean checkout
**Related:** `CIRCUIT_BREAKER_VERIFICATION.md`

### P1-029: Add CI job for package.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Backend/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package.json`

### P1-030: Review rate limits for beta.js
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/routes/beta.js` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/beta.js`
**Related:** `Backend/routes/beta.js`

### P1-031: Wire wallet connect flow in ERROR_BOUNDARY_SUMMARY.md
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ERROR_BOUNDARY_SUMMARY.md`

### P1-032: Add smoke test for IMPLEMENTATION.md
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/IMPLEMENTATION.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/IMPLEMENTATION.md`

### P1-033: Align ABI export for FLASHBORROW_DOCUMENTATION.md
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/FLASHBORROW_DOCUMENTATION.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_DOCUMENTATION.md`
**Related:** `Contracts/FLASHBORROW_DOCUMENTATION.md`

### P1-034: Document env matrix in DELIVERY_SUMMARY.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `DELIVERY_SUMMARY.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `DELIVERY_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `DELIVERY_SUMMARY.md`

### P1-035: Add smoke test post-build for deploy.js
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Backend/scripts/deploy.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/scripts/deploy.js`

### P1-036: Pen-test endpoint behind blacklist.js
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/routes/blacklist.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/blacklist.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/routes/blacklist.js`

### P1-037: Fix TypeScript path alias in README.md
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/README.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/README.md`

### P1-038: Add missing module export in LIQUIDATION.md
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/LIQUIDATION.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/LIQUIDATION.md`
**Related:** `Backend/LIQUIDATION.md`

### P1-039: Verify remappings for FLASHBORROW_README.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/FLASHBORROW_README.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_README.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/FLASHBORROW_README.md`

### P1-040: Fix broken links in DOES_IT_WORK_ANSWER.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `DOES_IT_WORK_ANSWER.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `DOES_IT_WORK_ANSWER.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `DOES_IT_WORK_ANSWER.md`

### P1-041: Add parallel job for deployService.js
**Labels:** `phase-1`, `infra`
**Description:** Document how `Backend/services/deployService.js` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P1-042: Review CORS policy for circuitBreaker.js
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/routes/circuitBreaker.js` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/routes/circuitBreaker.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/routes/circuitBreaker.js`

### P1-043: Add vitest coverage for SETTINGS_DOCUMENTATION.md
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/SETTINGS_DOCUMENTATION.md` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/SETTINGS_DOCUMENTATION.md`

### P1-044: Document setup for MARGIN.md
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/MARGIN.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/MARGIN.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/MARGIN.md`

### P1-045: Add Foundry test for FlashLoanProtection.sol
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/FlashLoanProtection.sol` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/FlashLoanProtection.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/FlashLoanProtection.sol`

### P1-046: Cross-link ADR in FEATURE_SUMMARY.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `FEATURE_SUMMARY.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `FEATURE_SUMMARY.md`

### P1-047: Configure env matrix in upgradeCoordinator.js
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/services/upgradeCoordinator.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P1-048: Review reentrancy surface in multisig.js
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/routes/multisig.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/multisig.js`

### P1-049: Validate env usage in SETTINGS_QUICKSTART.md
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/SETTINGS_QUICKSTART.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_QUICKSTART.md` fits the app shell
**Related:** `Frontend/SETTINGS_QUICKSTART.md`

### P1-050: Add health check for README.md
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/README.md` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/README.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/README.md`

### P1-051: Add invariant test for GAS_OPTIMIZATION_REPORT.md
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/GAS_OPTIMIZATION_REPORT.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/GAS_OPTIMIZATION_REPORT.md`

### P1-052: Add phase checklist to FINAL_VERIFICATION_REPORT.md
**Labels:** `phase-1`, `docs`
**Description:** Link `FINAL_VERIFICATION_REPORT.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `FINAL_VERIFICATION_REPORT.md`

### P1-053: Configure secrets mapping for deploy.test.js
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Backend/tests/deploy.test.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tests/deploy.test.js`

### P1-054: Fuzz abuse path in whitelist.js
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/routes/whitelist.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/routes/whitelist.js`

### P1-055: Add empty state to SETTINGS_SUMMARY.md
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/SETTINGS_SUMMARY.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/SETTINGS_SUMMARY.md`

### P1-056: Ensure package scripts cover RISK.md
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/RISK.md`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/RISK.md`

### P1-057: Add event coverage test for INTEGRATION_GUIDE.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/INTEGRATION_GUIDE.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/INTEGRATION_GUIDE.md`
**Related:** `Contracts/INTEGRATION_GUIDE.md`

### P1-058: Add glossary entry in FLASHBORROW_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
**Related:** `FLASHBORROW_IMPLEMENTATION_SUMMARY.md`

### P1-059: Add CI job for tsconfig.build.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Backend/tsconfig.build.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tsconfig.build.json`

### P1-060: Review rate limits for auditTrail.js
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/services/auditTrail.js` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/auditTrail.js`
**Related:** `Backend/services/auditTrail.js`

### P1-061: Wire wallet connect flow in TRADING_INTERFACE_DOCUMENTATION.md
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`

### P1-062: Add smoke test for TRADE_REPORTS.md
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/TRADE_REPORTS.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/TRADE_REPORTS.md`

### P1-063: Align ABI export for Liquidation.sol
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/Liquidation.sol`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/Liquidation.sol`
- [ ] `forge build` succeeds with `Contracts/Liquidation.sol`
**Related:** `Contracts/Liquidation.sol`

### P1-064: Document env matrix in FLASHBORROW_VERIFICATION.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `FLASHBORROW_VERIFICATION.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_VERIFICATION.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `FLASHBORROW_VERIFICATION.md`

### P1-065: Add smoke test post-build for tsconfig.json
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Backend/tsconfig.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.json`

### P1-066: Pen-test endpoint behind betaAccess.js
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/services/betaAccess.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/betaAccess.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/services/betaAccess.js`

### P1-067: Fix TypeScript path alias in TRADING_INTERFACE_QUICKSTART.md
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/TRADING_INTERFACE_QUICKSTART.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/TRADING_INTERFACE_QUICKSTART.md`

### P1-068: Add missing module export in TRADE_REPORTS_SETUP.md
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/TRADE_REPORTS_SETUP.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/TRADE_REPORTS_SETUP.md`
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P1-069: Verify remappings for MARKET_CAP_IMPLEMENTATION.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_CAP_IMPLEMENTATION.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_CAP_IMPLEMENTATION.md`

### P1-070: Fix broken links in README.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `Frontend/README.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `Frontend/README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `Frontend/README.md`

### P1-071: Add parallel job for test.yml
**Labels:** `phase-1`, `infra`
**Description:** Document how `Contracts/.github/workflows/test.yml` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/.github/workflows/test.yml`

### P1-072: Review CORS policy for blacklistService.js
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/services/blacklistService.js` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/services/blacklistService.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/services/blacklistService.js`

### P1-073: Add vitest coverage for TRADING_INTERFACE_SUMMARY.md
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/TRADING_INTERFACE_SUMMARY.md` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/TRADING_INTERFACE_SUMMARY.md`

### P1-074: Document setup for UPTIME_MONITORING.md
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/UPTIME_MONITORING.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/UPTIME_MONITORING.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/UPTIME_MONITORING.md`

### P1-075: Add Foundry test for MARKET_DELEGATION_API_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/MARKET_DELEGATION_API_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_DELEGATION_API_REFERENCE.md`

### P1-076: Cross-link ADR in IMPLEMENTATION_CHECKLIST.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_CHECKLIST.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_CHECKLIST.md`

### P1-077: Configure env matrix in foundry.toml
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/foundry.toml`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/foundry.toml`

### P1-078: Review reentrancy surface in multisigService.js
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/services/multisigService.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/multisigService.js`

### P1-079: Validate env usage in WEBSOCKET_IMPLEMENTATION.md
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/WEBSOCKET_IMPLEMENTATION.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_IMPLEMENTATION.md` fits the app shell
**Related:** `Frontend/WEBSOCKET_IMPLEMENTATION.md`

### P1-080: Add health check for pagerduty.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/config/pagerduty.js` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/config/pagerduty.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/config/pagerduty.js`

### P1-081: Add invariant test for MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`

### P1-082: Add phase checklist to IMPLEMENTATION_COMPLETE.md
**Labels:** `phase-1`, `docs`
**Description:** Link `IMPLEMENTATION_COMPLETE.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `IMPLEMENTATION_COMPLETE.md`

### P1-083: Configure secrets mapping for package-lock.json
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Contracts/package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/package-lock.json`

### P1-084: Fuzz abuse path in whitelistService.js
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/services/whitelistService.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/services/whitelistService.js`

### P1-085: Add empty state to WEBSOCKET_INTEGRATION_EXAMPLES.md
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`

### P1-086: Ensure package scripts cover rateLimits.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/config/rateLimits.js`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/config/rateLimits.js`

### P1-087: Add event coverage test for MARKET_DELEGATION_QUICK_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`
**Related:** `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`

### P1-088: Add glossary entry in IMPLEMENTATION_REPORT.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_REPORT.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_REPORT.md` verified on a clean checkout
**Related:** `IMPLEMENTATION_REPORT.md`

### P1-089: Add CI job for package.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Contracts/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package.json`

### P1-090: Review rate limits for auth.controller.ts
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/src/auth/auth.controller.ts` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.controller.ts`
**Related:** `Backend/src/auth/auth.controller.ts`

### P1-091: Wire wallet connect flow in WEBSOCKET_QUICKSTART.md
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/WEBSOCKET_QUICKSTART.md`

### P1-092: Add smoke test for eslint.config.mjs
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/eslint.config.mjs`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/eslint.config.mjs`

### P1-093: Align ABI export for MARKET_DELEGATION_README.md
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_DELEGATION_README.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_README.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_README.md`
**Related:** `Contracts/MARKET_DELEGATION_README.md`

### P1-094: Document env matrix in IMPLEMENTATION_SUCCESS.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `IMPLEMENTATION_SUCCESS.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_SUCCESS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `IMPLEMENTATION_SUCCESS.md`

### P1-095: Add smoke test post-build for DeployMarketCap.s.sol
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Contracts/script/DeployMarketCap.s.sol` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P1-096: Pen-test endpoint behind auth.module.ts
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/src/auth/auth.module.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/auth.module.ts`

### P1-097: Fix TypeScript path alias in WEBSOCKET_SUMMARY.md
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/WEBSOCKET_SUMMARY.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/WEBSOCKET_SUMMARY.md`

### P1-098: Add missing module export in heartbeatServer.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/heartbeatServer.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/heartbeatServer.js`
**Related:** `Backend/heartbeatServer.js`

### P1-099: Verify remappings for MARKET_RELAY_IMPLEMENTATION.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_RELAY_IMPLEMENTATION.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_RELAY_IMPLEMENTATION.md`

### P1-100: Fix broken links in IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `IMPLEMENTATION_SUMMARY.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `IMPLEMENTATION_SUMMARY.md`

### P1-101: Add parallel job for DeployRevokeFunction.s.sol
**Labels:** `phase-1`, `infra`
**Description:** Document how `Contracts/script/DeployRevokeFunction.s.sol` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P1-102: Review CORS policy for auth.service.ts
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/auth.service.ts` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/auth/auth.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/auth/auth.service.ts`

### P1-103: Add vitest coverage for page.tsx
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/analytics/page.tsx` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/analytics/page.tsx`

### P1-104: Document setup for arbitrageMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/arbitrageMonitor.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/arbitrageMonitor.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P1-105: Add Foundry test for MARKET_RELAY_INTEGRATION_GUIDE.md
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`

### P1-106: Cross-link ADR in IMPLEMENTATION_VERIFIED.txt
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_VERIFIED.txt` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_VERIFIED.txt`

### P1-107: Configure env matrix in DeployVoteWeight.s.sol
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/script/DeployVoteWeight.s.sol`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P1-108: Review reentrancy surface in auth.dto.ts
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/dto/auth.dto.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P1-109: Validate env usage in page.tsx
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api-keys/page.tsx` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api-keys/page.tsx` fits the app shell
**Related:** `Frontend/app/api-keys/page.tsx`

### P1-110: Add health check for batchExecutor.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/jobs/batchExecutor.js` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/batchExecutor.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/batchExecutor.js`

### P1-111: Add invariant test for MARKET_RELAY_QUICK_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`

### P1-112: Add phase checklist to LIQUIDATION_IMPLEMENTATION.md
**Labels:** `phase-1`, `docs`
**Description:** Link `LIQUIDATION_IMPLEMENTATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `LIQUIDATION_IMPLEMENTATION.md`

### P1-113: Configure secrets mapping for hardhat.config.js
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Frontend/localnet/hardhat.config.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/localnet/hardhat.config.js`

### P1-114: Fuzz abuse path in user.entity.ts
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/src/auth/entities/user.entity.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P1-115: Add empty state to route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/app/api/ipfs/gateway/[hash]/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/gateway/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/ipfs/gateway/[hash]/route.ts`

### P1-116: Ensure package scripts cover complianceChecker.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/jobs/complianceChecker.js`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/complianceChecker.js`

### P1-117: Add event coverage test for MARKET_RELAY_README.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_RELAY_README.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_README.md`
**Related:** `Contracts/MARKET_RELAY_README.md`

### P1-118: Add glossary entry in LIQUIDATION_QUICK_START.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `LIQUIDATION_QUICK_START.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `LIQUIDATION_QUICK_START.md` verified on a clean checkout
**Related:** `LIQUIDATION_QUICK_START.md`

### P1-119: Add CI job for package.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Frontend/localnet/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/package.json`

### P1-120: Review rate limits for jwt-auth.guard.ts
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/src/auth/guards/jwt-auth.guard.ts` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/guards/jwt-auth.guard.ts`
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P1-121: Wire wallet connect flow in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/pin/[hash]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/pin/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ipfs/pin/[hash]/route.ts`

### P1-122: Add smoke test for heartbeatMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/heartbeatMonitor.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P1-123: Align ABI export for MARKET_RELAY_SECURITY_ANALYSIS.md
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
**Related:** `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

### P1-124: Document env matrix in MARKET_DELEGATION_CHECKLIST.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `MARKET_DELEGATION_CHECKLIST.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MARKET_DELEGATION_CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `MARKET_DELEGATION_CHECKLIST.md`

### P1-125: Add smoke test post-build for deploy.js
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Frontend/localnet/scripts/deploy.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/scripts/deploy.js`

### P1-126: Pen-test endpoint behind jwt.strategy.ts
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/src/auth/strategies/jwt.strategy.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/strategies/jwt.strategy.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P1-127: Fix TypeScript path alias in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/ipfs/retrieve/[hash]/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`

### P1-128: Add missing module export in liquidationMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/liquidationMonitor.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/liquidationMonitor.js`
**Related:** `Backend/jobs/liquidationMonitor.js`

### P1-129: Verify remappings for MarketMinter.sol
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/MarketMinter.sol` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MarketMinter.sol`
- [ ] `forge build` succeeds with `Contracts/MarketMinter.sol`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MarketMinter.sol`

### P1-130: Fix broken links in MARKET_DELEGATION_COMPLETE.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `MARKET_DELEGATION_COMPLETE.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `MARKET_DELEGATION_COMPLETE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `MARKET_DELEGATION_COMPLETE.md`

### P1-131: Add parallel job for package-lock.json
**Labels:** `phase-1`, `infra`
**Description:** Document how `Frontend/package-lock.json` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Frontend/package-lock.json`

### P1-132: Review CORS policy for market-audit.dto.ts
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/dto/market-audit.dto.ts` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/dto/market-audit.dto.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/dto/market-audit.dto.ts`

### P1-133: Add vitest coverage for route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/ipfs/upload-json/route.ts` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/ipfs/upload-json/route.ts`

### P1-134: Document setup for sanityCheck.js
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/sanityCheck.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/sanityCheck.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/sanityCheck.js`

### P1-135: Add Foundry test for QUICK_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/QUICK_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/QUICK_REFERENCE.md`

### P1-136: Cross-link ADR in MARKET_RELAY_DELIVERY_SUMMARY.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `MARKET_RELAY_DELIVERY_SUMMARY.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `MARKET_RELAY_DELIVERY_SUMMARY.md`

### P1-137: Configure env matrix in package.json
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/package.json`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Frontend/package.json`

### P1-138: Review reentrancy surface in market-audit.controller.ts
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/market-audit.controller.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/market-audit/market-audit.controller.ts`

### P1-139: Validate env usage in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/market-audit/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-audit/route.ts` fits the app shell
**Related:** `Frontend/app/api/market-audit/route.ts`

### P1-140: Add health check for snapshotCapture.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/jobs/snapshotCapture.js` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/snapshotCapture.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/snapshotCapture.js`

### P1-141: Add invariant test for README.md
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/README.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/README.md`

### P1-142: Add phase checklist to MARKET_RELAY_FILES_CHECKLIST.md
**Labels:** `phase-1`, `docs`
**Description:** Link `MARKET_RELAY_FILES_CHECKLIST.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `MARKET_RELAY_FILES_CHECKLIST.md`

### P1-143: Configure secrets mapping for tsconfig.json
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Frontend/tsconfig.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/tsconfig.json`

### P1-144: Fuzz abuse path in market-audit.entity.ts
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/src/market-audit/market-audit.entity.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/market-audit/market-audit.entity.ts`

### P1-145: Add empty state to route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/app/api/market-sentiment/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-sentiment/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/market-sentiment/route.ts`

### P1-146: Ensure package scripts cover tradeExecutor.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/jobs/tradeExecutor.js`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/tradeExecutor.js`

### P1-147: Add event coverage test for README_MARKETCAP.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/README_MARKETCAP.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_MARKETCAP.md`
**Related:** `Contracts/README_MARKETCAP.md`

### P1-148: Add glossary entry in MINTING_PAUSABLE_IMPLEMENTATION.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `MINTING_PAUSABLE_IMPLEMENTATION.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MINTING_PAUSABLE_IMPLEMENTATION.md` verified on a clean checkout
**Related:** `MINTING_PAUSABLE_IMPLEMENTATION.md`

### P1-149: Add CI job for package-lock.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `package-lock.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `package-lock.json`

### P1-150: Review rate limits for market-audit.module.ts
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/src/market-audit/market-audit.module.ts` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.module.ts`
**Related:** `Backend/src/market-audit/market-audit.module.ts`

### P1-151: Wire wallet connect flow in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/execute/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/execute/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/multisig/execute/route.ts`

### P1-152: Add smoke test for upgradeManager.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/upgradeManager.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/upgradeManager.js`

### P1-153: Align ABI export for README_VOTE_DELEGATION.md
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/README_VOTE_DELEGATION.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_VOTE_DELEGATION.md`
- [ ] `forge build` succeeds with `Contracts/README_VOTE_DELEGATION.md`
**Related:** `Contracts/README_VOTE_DELEGATION.md`

### P1-154: Document env matrix in PHASES.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `PHASES.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASES.md`

### P1-155: Add smoke test post-build for package.json
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `package.json`

### P1-156: Pen-test endpoint behind market-audit.service.spec.ts
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/src/market-audit/market-audit.service.spec.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.spec.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/market-audit/market-audit.service.spec.ts`

### P1-157: Fix TypeScript path alias in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/multisig/propose/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/multisig/propose/route.ts`

### P1-158: Add missing module export in backwardCompat.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/backwardCompat.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/backwardCompat.js`
**Related:** `Backend/middleware/backwardCompat.js`

### P1-159: Verify remappings for REVOKE_FUNCTION_API_REFERENCE.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_API_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`

### P1-160: Fix broken links in PHASE_1.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `PHASE_1.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `PHASE_1.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PHASE_1.md`

### P1-161: Add parallel job for ci.yml
**Labels:** `phase-1`, `infra`
**Description:** Document how `.github/workflows/ci.yml` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `.github/workflows/ci.yml`

### P1-162: Review CORS policy for market-audit.service.ts
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/market-audit.service.ts` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/market-audit.service.ts`

### P1-163: Add vitest coverage for route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/multisig/sign/route.ts` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/multisig/sign/route.ts`

### P1-164: Document setup for ddosGuard.js
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/ddosGuard.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/ddosGuard.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/ddosGuard.js`

### P1-165: Add Foundry test for REVOKE_FUNCTION_DOCUMENTATION.md
**Labels:** `phase-1`, `contracts`
**Description:** Phase 1 ensures `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`

### P1-166: Cross-link ADR in PHASE_2.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `PHASE_2.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `PHASE_2.md`

### P1-167: Configure env matrix in .env.example
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/.env.example`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/.env.example`

### P1-168: Review reentrancy surface in rate-limiter.config.ts
**Labels:** `phase-1`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/rate-limiter/rate-limiter.config.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/rate-limiter/rate-limiter.config.ts`

### P1-169: Validate env usage in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/multisig/status/[txId]/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/status/[txId]/route.ts` fits the app shell
**Related:** `Frontend/app/api/multisig/status/[txId]/route.ts`

### P1-170: Add health check for deprecation.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/middleware/deprecation.js` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/middleware/deprecation.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/deprecation.js`

### P1-171: Add invariant test for REVOKE_FUNCTION_FEATURES.md
**Labels:** `phase-1`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_FEATURES.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/REVOKE_FUNCTION_FEATURES.md`

### P1-172: Add phase checklist to PHASE_3.md
**Labels:** `phase-1`, `docs`
**Description:** Link `PHASE_3.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `PHASE_3.md`

### P1-173: Configure secrets mapping for upgradeManager.js
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Backend/jobs/upgradeManager.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/jobs/upgradeManager.js`

### P1-174: Fuzz abuse path in rate-limiter.decorator.ts
**Labels:** `phase-1`, `security`
**Description:** Security: review `Backend/src/rate-limiter/rate-limiter.decorator.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/rate-limiter/rate-limiter.decorator.ts`

### P1-175: Add empty state to route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Phase 1 requires `Frontend/app/api/multisig/wallet/[walletId]/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/wallet/[walletId]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/multisig/wallet/[walletId]/route.ts`

### P1-176: Ensure package scripts cover permissions.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/middleware/permissions.js`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/permissions.js`

### P1-177: Add event coverage test for REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md
**Labels:** `phase-1`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md` in README or contract comments. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`
**Related:** `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`

### P1-178: Add glossary entry in PHASE_4.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `PHASE_4.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_4.md` verified on a clean checkout
**Related:** `PHASE_4.md`

### P1-179: Add CI job for package-lock.json
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Backend/package-lock.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package-lock.json`

### P1-180: Review rate limits for rate-limiter.guard.ts
**Labels:** `phase-1`, `security`
**Description:** Phase 1 security baseline — `Backend/src/rate-limiter/rate-limiter.guard.ts` must not expose admin routes or keys without guards. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.guard.ts`
**Related:** `Backend/src/rate-limiter/rate-limiter.guard.ts`

### P1-181: Wire wallet connect flow in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ping/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ping/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ping/route.ts`

### P1-182: Add smoke test for rateLimiter.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/rateLimiter.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/rateLimiter.js`

### P1-183: Align ABI export for REVOKE_FUNCTION_QUICK_START.md
**Labels:** `phase-1`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_QUICK_START.md`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_QUICK_START.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_QUICK_START.md`
**Related:** `Contracts/REVOKE_FUNCTION_QUICK_START.md`

### P1-184: Document env matrix in PHASE_5.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `PHASE_5.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_5.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASE_5.md`

### P1-185: Add smoke test post-build for package.json
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Backend/package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/package.json`

### P1-186: Pen-test endpoint behind rate-limiter.module.ts
**Labels:** `phase-1`, `security`
**Description:** Align `Backend/src/rate-limiter/rate-limiter.module.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/rate-limiter/rate-limiter.module.ts`

### P1-187: Fix TypeScript path alias in route.ts
**Labels:** `phase-1`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/trending-markets/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/trending-markets/route.ts`

### P1-188: Add missing module export in throttle.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/throttle.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/throttle.js`
**Related:** `Backend/middleware/throttle.js`

### P1-189: Verify remappings for REVOKE_FUNCTION_README.md
**Labels:** `phase-1`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_README.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_README.md`

### P1-190: Fix broken links in PR_INSTRUCTIONS.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `PR_INSTRUCTIONS.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `PR_INSTRUCTIONS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_INSTRUCTIONS.md`

### P1-191: Add parallel job for deploy.js
**Labels:** `phase-1`, `infra`
**Description:** Document how `Backend/scripts/deploy.js` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/scripts/deploy.js`

### P1-192: Review CORS policy for rate-limiter.service.ts
**Labels:** `phase-1`, `security`
**Description:** Document trust assumptions for `Backend/src/rate-limiter/rate-limiter.service.ts` (oracles, multisig, beta access). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/rate-limiter/rate-limiter.service.ts`

### P1-193: Add vitest coverage for page.tsx
**Labels:** `phase-1`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/archive/page.tsx` before beta. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/archive/page.tsx`

### P1-194: Document setup for tradeValidation.js
**Labels:** `phase-1`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/tradeValidation.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/tradeValidation.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/tradeValidation.js`

### P1-195: Add troubleshooting for PR_TEMPLATE.md
**Labels:** `phase-1`, `docs`
**Description:** Phase 1 docs pass — verify `PR_TEMPLATE.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Commands in `PR_TEMPLATE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_TEMPLATE.md`

### P1-196: Add cache step for deployService.js
**Labels:** `phase-1`, `infra`
**Description:** Document how `Backend/services/deployService.js` maps to staging vs production env vars. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P1-197: Add smoke test for version.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/version.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/version.js`

### P1-198: Add CONTRIBUTING note for PUSH_INSTRUCTIONS.md
**Labels:** `phase-1`, `docs`
**Description:** Remove outdated implementation claims in `PUSH_INSTRUCTIONS.md` that contradict the codebase. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PUSH_INSTRUCTIONS.md` verified on a clean checkout
**Related:** `PUSH_INSTRUCTIONS.md`

### P1-199: Document deploy path for upgradeCoordinator.js
**Labels:** `phase-1`, `infra`
**Description:** Infra: `Backend/services/upgradeCoordinator.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/services/upgradeCoordinator.js`

### P1-200: Add health check for 001_init_markets.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; `Backend/migrations/001_init_markets.js` must match the canonical run path in README. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/migrations/001_init_markets.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/migrations/001_init_markets.js`

### P1-201: Refresh stale claims in RATE_LIMITER_IMPLEMENTATION.md
**Labels:** `phase-1`, `docs`
**Description:** Reduce onboarding time: `RATE_LIMITER_IMPLEMENTATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `RATE_LIMITER_IMPLEMENTATION.md`

### P1-202: Add branch protection rule for deploy.test.js
**Labels:** `phase-1`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/tests/deploy.test.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/tests/deploy.test.js`

### P1-203: Add missing module export in AuditLog.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/models/AuditLog.js`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/models/AuditLog.js`
**Related:** `Backend/models/AuditLog.js`

### P1-204: Add onboarding step to README.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `README.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `README.md`

### P1-205: Stabilize pipeline for tsconfig.build.json
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Backend/tsconfig.build.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.build.json`

### P1-206: Ensure package scripts cover Balance.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around `Backend/models/Balance.js`; eliminate silent failures on `npm run start:dev`. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/models/Balance.js`

### P1-207: Summarize implementation status in README_IMPLEMENTATION.md
**Labels:** `phase-1`, `docs`
**Description:** Link `README_IMPLEMENTATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `README_IMPLEMENTATION.md`

### P1-208: Add monitoring hook for tsconfig.json
**Labels:** `phase-1`, `infra`
**Description:** Coordinate `Backend/tsconfig.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tsconfig.json`

### P1-209: Update setup section in RELEASE_NOTES.md
**Labels:** `phase-1`, `docs`
**Description:** Documentation: `RELEASE_NOTES.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `RELEASE_NOTES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `RELEASE_NOTES.md`

### P1-210: Pin toolchain version in test.yml
**Labels:** `phase-1`, `infra`
**Description:** Phase 1 CI — ensure `Contracts/.github/workflows/test.yml` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 1: stabilize foundations.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/.github/workflows/test.yml`
