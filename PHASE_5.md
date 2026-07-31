# Phase 5: Deployment & shipping

> **Theme:** Deployment & shipping
> **Goal:** CI/CD pipelines, staging/prod deploys, contract upgrades, release notes, beta gating, and production cutover.

> **Area distribution:** frontend 33, backend 35, contracts 32, docs 32, infra 46, security 32 (210 issues)

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).
Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.

### P5-001: Align route layout for ARBITRAGE_DEMO.md
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/ARBITRAGE_DEMO.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ARBITRAGE_DEMO.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ARBITRAGE_DEMO.md`

### P5-002: Stabilize boot sequence of .env.example
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/.env.example`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/.env.example`

### P5-003: Resolve import path in test.yml
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/.github/workflows/test.yml` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/.github/workflows/test.yml`
- [ ] `forge build` succeeds with `Contracts/.github/workflows/test.yml`
**Related:** `Contracts/.github/workflows/test.yml`

### P5-004: Document API contract in BUG_ANALYSIS_REPORT.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `BUG_ANALYSIS_REPORT.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `BUG_ANALYSIS_REPORT.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `BUG_ANALYSIS_REPORT.md`

### P5-005: Add CI job for ci.yml
**Labels:** `phase-5`, `infra`
**Description:** Infra: `.github/workflows/ci.yml` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `.github/workflows/ci.yml`

### P5-006: Review oracle trust in rateLimits.js
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/config/rateLimits.js` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/config/rateLimits.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/config/rateLimits.js`

### P5-007: Connect WebSocket hook in ERROR_BOUNDARY_CHECKLIST.md
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_CHECKLIST.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/ERROR_BOUNDARY_CHECKLIST.md`

### P5-008: Add startup logging to API_PROTECTION_README.md
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/API_PROTECTION_README.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/API_PROTECTION_README.md`
**Related:** `Backend/API_PROTECTION_README.md`

### P5-009: Stabilize `forge test` for API_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/API_REFERENCE.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/API_REFERENCE.md`

### P5-010: Update setup section in CHECKLIST.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `CHECKLIST.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `CHECKLIST.md`

### P5-011: Add smoke test post-build for .env.example
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Backend/.env.example` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/.env.example`

### P5-012: Add input validation to ddosGuard.js
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/middleware/ddosGuard.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/middleware/ddosGuard.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/middleware/ddosGuard.js`

### P5-013: Replace mock data in ERROR_BOUNDARY_DOCUMENTATION.md
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`

### P5-014: Validate env vars for COLLATERAL.md
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/COLLATERAL.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/COLLATERAL.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/COLLATERAL.md`

### P5-015: Add deployment script for BUG_ANALYSIS_AND_FIXES.md
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/BUG_ANALYSIS_AND_FIXES.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/BUG_ANALYSIS_AND_FIXES.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/BUG_ANALYSIS_AND_FIXES.md`

### P5-016: Add architecture diagram for CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `CIRCUIT_BREAKER_IMPLEMENTATION.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`

### P5-017: Add parallel job for upgradeManager.js
**Labels:** `phase-5`, `infra`
**Description:** Document how `Backend/jobs/upgradeManager.js` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/jobs/upgradeManager.js`

### P5-018: Review secrets exposure in rateLimiter.js
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/middleware/rateLimiter.js` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/rateLimiter.js`

### P5-019: Document component props in ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` fits the app shell
**Related:** `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`

### P5-020: Consolidate duplicate logic in DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P5-021: Add gas snapshot for Burnable.sol
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/Burnable.sol` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/Burnable.sol`

### P5-022: Add runbook section to CIRCUIT_BREAKER_QUICK_REFERENCE.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `CIRCUIT_BREAKER_QUICK_REFERENCE.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `CIRCUIT_BREAKER_QUICK_REFERENCE.md`

### P5-023: Configure CDN for package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/package-lock.json`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/package-lock.json`

### P5-024: Add beta gate check in AuditLog.js
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/models/AuditLog.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/models/AuditLog.js`

### P5-025: Fix Next.js boot error in ERROR_BOUNDARY_QUICKSTART.md
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/ERROR_BOUNDARY_QUICKSTART.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/ERROR_BOUNDARY_QUICKSTART.md`

### P5-026: Fix broken import in DEPOSIT_SERVICE_README.md
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/DEPOSIT_SERVICE_README.md` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P5-027: Document NatSpec in CODE_REVIEW_REPORT.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/CODE_REVIEW_REPORT.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/CODE_REVIEW_REPORT.md`
**Related:** `Contracts/CODE_REVIEW_REPORT.md`

### P5-028: Align README with CIRCUIT_BREAKER_VERIFICATION.md
**Labels:** `phase-5`, `docs`
**Description:** Link `CIRCUIT_BREAKER_VERIFICATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `CIRCUIT_BREAKER_VERIFICATION.md` verified on a clean checkout
**Related:** `CIRCUIT_BREAKER_VERIFICATION.md`

### P5-029: Ship release notes for package.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Backend/package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package.json`

### P5-030: Harden auth flow in beta.js
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/routes/beta.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/beta.js`
**Related:** `Backend/routes/beta.js`

### P5-031: Align route layout for ERROR_BOUNDARY_SUMMARY.md
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/ERROR_BOUNDARY_SUMMARY.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ERROR_BOUNDARY_SUMMARY.md`

### P5-032: Stabilize boot sequence of IMPLEMENTATION.md
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/IMPLEMENTATION.md`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/IMPLEMENTATION.md`

### P5-033: Resolve import path in FLASHBORROW_DOCUMENTATION.md
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/FLASHBORROW_DOCUMENTATION.md` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_DOCUMENTATION.md`
**Related:** `Contracts/FLASHBORROW_DOCUMENTATION.md`

### P5-034: Document API contract in DELIVERY_SUMMARY.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `DELIVERY_SUMMARY.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `DELIVERY_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `DELIVERY_SUMMARY.md`

### P5-035: Document deploy path for deploy.js
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Backend/scripts/deploy.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/scripts/deploy.js`

### P5-036: Review oracle trust in blacklist.js
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/routes/blacklist.js` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/blacklist.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/routes/blacklist.js`

### P5-037: Connect WebSocket hook in README.md
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/README.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/README.md`

### P5-038: Add startup logging to LIQUIDATION.md
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/LIQUIDATION.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/LIQUIDATION.md`
**Related:** `Backend/LIQUIDATION.md`

### P5-039: Stabilize `forge test` for FLASHBORROW_README.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/FLASHBORROW_README.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_README.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/FLASHBORROW_README.md`

### P5-040: Update setup section in DOES_IT_WORK_ANSWER.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `DOES_IT_WORK_ANSWER.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `DOES_IT_WORK_ANSWER.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `DOES_IT_WORK_ANSWER.md`

### P5-041: Stabilize pipeline for deployService.js
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Backend/services/deployService.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P5-042: Add input validation to circuitBreaker.js
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/routes/circuitBreaker.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/routes/circuitBreaker.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/routes/circuitBreaker.js`

### P5-043: Replace mock data in SETTINGS_DOCUMENTATION.md
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/SETTINGS_DOCUMENTATION.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/SETTINGS_DOCUMENTATION.md`

### P5-044: Validate env vars for MARGIN.md
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/MARGIN.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/MARGIN.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/MARGIN.md`

### P5-045: Add deployment script for FlashLoanProtection.sol
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/FlashLoanProtection.sol` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/FlashLoanProtection.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/FlashLoanProtection.sol`

### P5-046: Add architecture diagram for FEATURE_SUMMARY.md
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `FEATURE_SUMMARY.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `FEATURE_SUMMARY.md`

### P5-047: Add contract verify step for upgradeCoordinator.js
**Labels:** `phase-5`, `infra`
**Description:** Document how `Backend/services/upgradeCoordinator.js` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P5-048: Review secrets exposure in multisig.js
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/routes/multisig.js` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/multisig.js`

### P5-049: Document component props in SETTINGS_QUICKSTART.md
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/SETTINGS_QUICKSTART.md` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_QUICKSTART.md` fits the app shell
**Related:** `Frontend/SETTINGS_QUICKSTART.md`

### P5-050: Consolidate duplicate logic in README.md
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/README.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/README.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/README.md`

### P5-051: Add gas snapshot for GAS_OPTIMIZATION_REPORT.md
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/GAS_OPTIMIZATION_REPORT.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/GAS_OPTIMIZATION_REPORT.md`

### P5-052: Add runbook section to FINAL_VERIFICATION_REPORT.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `FINAL_VERIFICATION_REPORT.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `FINAL_VERIFICATION_REPORT.md`

### P5-053: Add beta access gate to deploy.test.js
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/tests/deploy.test.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tests/deploy.test.js`

### P5-054: Add beta gate check in whitelist.js
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/routes/whitelist.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/routes/whitelist.js`

### P5-055: Fix Next.js boot error in SETTINGS_SUMMARY.md
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/SETTINGS_SUMMARY.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/SETTINGS_SUMMARY.md`

### P5-056: Fix broken import in RISK.md
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/RISK.md` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/RISK.md`

### P5-057: Document NatSpec in INTEGRATION_GUIDE.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/INTEGRATION_GUIDE.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/INTEGRATION_GUIDE.md`
**Related:** `Contracts/INTEGRATION_GUIDE.md`

### P5-058: Align README with FLASHBORROW_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-5`, `docs`
**Description:** Link `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
**Related:** `FLASHBORROW_IMPLEMENTATION_SUMMARY.md`

### P5-059: Add Docker build for tsconfig.build.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Backend/tsconfig.build.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tsconfig.build.json`

### P5-060: Harden auth flow in auditTrail.js
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/services/auditTrail.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/auditTrail.js`
**Related:** `Backend/services/auditTrail.js`

### P5-061: Align route layout for TRADING_INTERFACE_DOCUMENTATION.md
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`

### P5-062: Stabilize boot sequence of TRADE_REPORTS.md
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/TRADE_REPORTS.md`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/TRADE_REPORTS.md`

### P5-063: Resolve import path in Liquidation.sol
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/Liquidation.sol` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/Liquidation.sol`
- [ ] `forge build` succeeds with `Contracts/Liquidation.sol`
**Related:** `Contracts/Liquidation.sol`

### P5-064: Document API contract in FLASHBORROW_VERIFICATION.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `FLASHBORROW_VERIFICATION.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_VERIFICATION.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `FLASHBORROW_VERIFICATION.md`

### P5-065: Add health probe for tsconfig.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Backend/tsconfig.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.json`

### P5-066: Review oracle trust in betaAccess.js
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/services/betaAccess.js` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/betaAccess.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/services/betaAccess.js`

### P5-067: Connect WebSocket hook in TRADING_INTERFACE_QUICKSTART.md
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/TRADING_INTERFACE_QUICKSTART.md`

### P5-068: Add startup logging to TRADE_REPORTS_SETUP.md
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/TRADE_REPORTS_SETUP.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/TRADE_REPORTS_SETUP.md`
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P5-069: Stabilize `forge test` for MARKET_CAP_IMPLEMENTATION.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_CAP_IMPLEMENTATION.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_CAP_IMPLEMENTATION.md`

### P5-070: Update setup section in README.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `Frontend/README.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `Frontend/README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `Frontend/README.md`

### P5-071: Add production deploy for test.yml
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Contracts/.github/workflows/test.yml` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/.github/workflows/test.yml`

### P5-072: Add input validation to blacklistService.js
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/services/blacklistService.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/services/blacklistService.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/services/blacklistService.js`

### P5-073: Replace mock data in TRADING_INTERFACE_SUMMARY.md
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/TRADING_INTERFACE_SUMMARY.md` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/TRADING_INTERFACE_SUMMARY.md`

### P5-074: Validate env vars for UPTIME_MONITORING.md
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/UPTIME_MONITORING.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/UPTIME_MONITORING.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/UPTIME_MONITORING.md`

### P5-075: Add deployment script for MARKET_DELEGATION_API_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_DELEGATION_API_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_DELEGATION_API_REFERENCE.md`

### P5-076: Add architecture diagram for IMPLEMENTATION_CHECKLIST.md
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `IMPLEMENTATION_CHECKLIST.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_CHECKLIST.md`

### P5-077: Configure monitoring dashboard for foundry.toml
**Labels:** `phase-5`, `infra`
**Description:** Document how `Contracts/foundry.toml` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/foundry.toml`

### P5-078: Review secrets exposure in multisigService.js
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/services/multisigService.js` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/multisigService.js`

### P5-079: Document component props in WEBSOCKET_IMPLEMENTATION.md
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/WEBSOCKET_IMPLEMENTATION.md` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_IMPLEMENTATION.md` fits the app shell
**Related:** `Frontend/WEBSOCKET_IMPLEMENTATION.md`

### P5-080: Consolidate duplicate logic in pagerduty.js
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/config/pagerduty.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/config/pagerduty.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/config/pagerduty.js`

### P5-081: Add gas snapshot for MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`

### P5-082: Add runbook section to IMPLEMENTATION_COMPLETE.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_COMPLETE.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `IMPLEMENTATION_COMPLETE.md`

### P5-083: Configure env matrix in package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/package-lock.json`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/package-lock.json`

### P5-084: Add beta gate check in whitelistService.js
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/services/whitelistService.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/services/whitelistService.js`

### P5-085: Fix Next.js boot error in WEBSOCKET_INTEGRATION_EXAMPLES.md
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`

### P5-086: Fix broken import in rateLimits.js
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/config/rateLimits.js` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/config/rateLimits.js`

### P5-087: Document NatSpec in MARKET_DELEGATION_QUICK_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`
**Related:** `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`

### P5-088: Align README with IMPLEMENTATION_REPORT.md
**Labels:** `phase-5`, `docs`
**Description:** Link `IMPLEMENTATION_REPORT.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_REPORT.md` verified on a clean checkout
**Related:** `IMPLEMENTATION_REPORT.md`

### P5-089: Configure secrets mapping for package.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Contracts/package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package.json`

### P5-090: Harden auth flow in auth.controller.ts
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/src/auth/auth.controller.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.controller.ts`
**Related:** `Backend/src/auth/auth.controller.ts`

### P5-091: Align route layout for WEBSOCKET_QUICKSTART.md
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/WEBSOCKET_QUICKSTART.md` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/WEBSOCKET_QUICKSTART.md`

### P5-092: Stabilize boot sequence of eslint.config.mjs
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/eslint.config.mjs`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/eslint.config.mjs`

### P5-093: Resolve import path in MARKET_DELEGATION_README.md
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_DELEGATION_README.md` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_README.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_README.md`
**Related:** `Contracts/MARKET_DELEGATION_README.md`

### P5-094: Document API contract in IMPLEMENTATION_SUCCESS.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_SUCCESS.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_SUCCESS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `IMPLEMENTATION_SUCCESS.md`

### P5-095: Configure staging deploy for DeployMarketCap.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Contracts/script/DeployMarketCap.s.sol` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P5-096: Review oracle trust in auth.module.ts
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/src/auth/auth.module.ts` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/auth.module.ts`

### P5-097: Connect WebSocket hook in WEBSOCKET_SUMMARY.md
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/WEBSOCKET_SUMMARY.md`

### P5-098: Add startup logging to heartbeatServer.js
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/heartbeatServer.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/heartbeatServer.js`
**Related:** `Backend/heartbeatServer.js`

### P5-099: Stabilize `forge test` for MARKET_RELAY_IMPLEMENTATION.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_RELAY_IMPLEMENTATION.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_RELAY_IMPLEMENTATION.md`

### P5-100: Update setup section in IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `IMPLEMENTATION_SUMMARY.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `IMPLEMENTATION_SUMMARY.md`

### P5-101: Add migration runbook for DeployRevokeFunction.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Contracts/script/DeployRevokeFunction.s.sol` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P5-102: Add input validation to auth.service.ts
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/src/auth/auth.service.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/auth/auth.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/auth/auth.service.ts`

### P5-103: Replace mock data in page.tsx
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/analytics/page.tsx` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/analytics/page.tsx`

### P5-104: Validate env vars for arbitrageMonitor.js
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/arbitrageMonitor.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/arbitrageMonitor.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P5-105: Add deployment script for MARKET_RELAY_INTEGRATION_GUIDE.md
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`

### P5-106: Add architecture diagram for IMPLEMENTATION_VERIFIED.txt
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `IMPLEMENTATION_VERIFIED.txt` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_VERIFIED.txt`

### P5-107: Add cache step for DeployVoteWeight.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Document how `Contracts/script/DeployVoteWeight.s.sol` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P5-108: Review secrets exposure in auth.dto.ts
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/dto/auth.dto.ts` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P5-109: Document component props in page.tsx
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api-keys/page.tsx` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api-keys/page.tsx` fits the app shell
**Related:** `Frontend/app/api-keys/page.tsx`

### P5-110: Consolidate duplicate logic in batchExecutor.js
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/batchExecutor.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/batchExecutor.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/batchExecutor.js`

### P5-111: Add gas snapshot for MARKET_RELAY_QUICK_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/MARKET_RELAY_QUICK_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`

### P5-112: Add runbook section to LIQUIDATION_IMPLEMENTATION.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `LIQUIDATION_IMPLEMENTATION.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `LIQUIDATION_IMPLEMENTATION.md`

### P5-113: Add branch protection rule for hardhat.config.js
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/localnet/hardhat.config.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/localnet/hardhat.config.js`

### P5-114: Add beta gate check in user.entity.ts
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/entities/user.entity.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P5-115: Fix Next.js boot error in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/ipfs/gateway/[hash]/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/gateway/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/ipfs/gateway/[hash]/route.ts`

### P5-116: Fix broken import in complianceChecker.js
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/jobs/complianceChecker.js` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/complianceChecker.js`

### P5-117: Document NatSpec in MARKET_RELAY_README.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_RELAY_README.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_README.md`
**Related:** `Contracts/MARKET_RELAY_README.md`

### P5-118: Align README with LIQUIDATION_QUICK_START.md
**Labels:** `phase-5`, `docs`
**Description:** Link `LIQUIDATION_QUICK_START.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `LIQUIDATION_QUICK_START.md` verified on a clean checkout
**Related:** `LIQUIDATION_QUICK_START.md`

### P5-119: Add monitoring hook for package.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Frontend/localnet/package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/package.json`

### P5-120: Harden auth flow in jwt-auth.guard.ts
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/src/auth/guards/jwt-auth.guard.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/guards/jwt-auth.guard.ts`
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P5-121: Align route layout for route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/app/api/ipfs/pin/[hash]/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/pin/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ipfs/pin/[hash]/route.ts`

### P5-122: Stabilize boot sequence of heartbeatMonitor.js
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/jobs/heartbeatMonitor.js`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P5-123: Resolve import path in MARKET_RELAY_SECURITY_ANALYSIS.md
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
**Related:** `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

### P5-124: Document API contract in MARKET_DELEGATION_CHECKLIST.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `MARKET_DELEGATION_CHECKLIST.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MARKET_DELEGATION_CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `MARKET_DELEGATION_CHECKLIST.md`

### P5-125: Finalize env matrix for deploy.js
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Frontend/localnet/scripts/deploy.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/scripts/deploy.js`

### P5-126: Review oracle trust in jwt.strategy.ts
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/src/auth/strategies/jwt.strategy.ts` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/strategies/jwt.strategy.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P5-127: Connect WebSocket hook in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`

### P5-128: Add startup logging to liquidationMonitor.js
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/liquidationMonitor.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/liquidationMonitor.js`
**Related:** `Backend/jobs/liquidationMonitor.js`

### P5-129: Stabilize `forge test` for MarketMinter.sol
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MarketMinter.sol`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MarketMinter.sol`
- [ ] `forge build` succeeds with `Contracts/MarketMinter.sol`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MarketMinter.sol`

### P5-130: Update setup section in MARKET_DELEGATION_COMPLETE.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `MARKET_DELEGATION_COMPLETE.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `MARKET_DELEGATION_COMPLETE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `MARKET_DELEGATION_COMPLETE.md`

### P5-131: Pin toolchain version in package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Frontend/package-lock.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Frontend/package-lock.json`

### P5-132: Add input validation to market-audit.dto.ts
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/src/market-audit/dto/market-audit.dto.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/dto/market-audit.dto.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/dto/market-audit.dto.ts`

### P5-133: Replace mock data in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/ipfs/upload-json/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/ipfs/upload-json/route.ts`

### P5-134: Validate env vars for sanityCheck.js
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/sanityCheck.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/sanityCheck.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/sanityCheck.js`

### P5-135: Add deployment script for QUICK_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/QUICK_REFERENCE.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/QUICK_REFERENCE.md`

### P5-136: Add architecture diagram for MARKET_RELAY_DELIVERY_SUMMARY.md
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `MARKET_RELAY_DELIVERY_SUMMARY.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `MARKET_RELAY_DELIVERY_SUMMARY.md`

### P5-137: Wire artifact upload for package.json
**Labels:** `phase-5`, `infra`
**Description:** Document how `Frontend/package.json` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Frontend/package.json`

### P5-138: Review secrets exposure in market-audit.controller.ts
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/market-audit.controller.ts` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/market-audit/market-audit.controller.ts`

### P5-139: Document component props in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/market-audit/route.ts` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-audit/route.ts` fits the app shell
**Related:** `Frontend/app/api/market-audit/route.ts`

### P5-140: Consolidate duplicate logic in snapshotCapture.js
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/snapshotCapture.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/snapshotCapture.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/snapshotCapture.js`

### P5-141: Add gas snapshot for README.md
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/README.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/README.md`

### P5-142: Add runbook section to MARKET_RELAY_FILES_CHECKLIST.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `MARKET_RELAY_FILES_CHECKLIST.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `MARKET_RELAY_FILES_CHECKLIST.md`

### P5-143: Document rollback for tsconfig.json
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/tsconfig.json`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/tsconfig.json`

### P5-144: Add beta gate check in market-audit.entity.ts
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/market-audit.entity.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/market-audit/market-audit.entity.ts`

### P5-145: Fix Next.js boot error in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/market-sentiment/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-sentiment/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/market-sentiment/route.ts`

### P5-146: Fix broken import in tradeExecutor.js
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/jobs/tradeExecutor.js` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/tradeExecutor.js`

### P5-147: Document NatSpec in README_MARKETCAP.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/README_MARKETCAP.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_MARKETCAP.md`
**Related:** `Contracts/README_MARKETCAP.md`

### P5-148: Align README with MINTING_PAUSABLE_IMPLEMENTATION.md
**Labels:** `phase-5`, `docs`
**Description:** Link `MINTING_PAUSABLE_IMPLEMENTATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MINTING_PAUSABLE_IMPLEMENTATION.md` verified on a clean checkout
**Related:** `MINTING_PAUSABLE_IMPLEMENTATION.md`

### P5-149: Add canary deploy for package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `package-lock.json`

### P5-150: Harden auth flow in market-audit.module.ts
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/src/market-audit/market-audit.module.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.module.ts`
**Related:** `Backend/src/market-audit/market-audit.module.ts`

### P5-151: Align route layout for route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/app/api/multisig/execute/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/execute/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/multisig/execute/route.ts`

### P5-152: Stabilize boot sequence of upgradeManager.js
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/jobs/upgradeManager.js`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/upgradeManager.js`

### P5-153: Resolve import path in README_VOTE_DELEGATION.md
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/README_VOTE_DELEGATION.md` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_VOTE_DELEGATION.md`
- [ ] `forge build` succeeds with `Contracts/README_VOTE_DELEGATION.md`
**Related:** `Contracts/README_VOTE_DELEGATION.md`

### P5-154: Document API contract in PHASES.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `PHASES.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASES.md`

### P5-155: Add CI job for package.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `package.json`

### P5-156: Review oracle trust in market-audit.service.spec.ts
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/src/market-audit/market-audit.service.spec.ts` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.spec.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/market-audit/market-audit.service.spec.ts`

### P5-157: Connect WebSocket hook in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/propose/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/multisig/propose/route.ts`

### P5-158: Add startup logging to backwardCompat.js
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/backwardCompat.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/backwardCompat.js`
**Related:** `Backend/middleware/backwardCompat.js`

### P5-159: Stabilize `forge test` for REVOKE_FUNCTION_API_REFERENCE.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`

### P5-160: Update setup section in PHASE_1.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `PHASE_1.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `PHASE_1.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PHASE_1.md`

### P5-161: Add smoke test post-build for ci.yml
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `.github/workflows/ci.yml` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `.github/workflows/ci.yml`

### P5-162: Add input validation to market-audit.service.ts
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/src/market-audit/market-audit.service.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/market-audit.service.ts`

### P5-163: Replace mock data in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/api/multisig/sign/route.ts` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/multisig/sign/route.ts`

### P5-164: Validate env vars for ddosGuard.js
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/ddosGuard.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/ddosGuard.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/ddosGuard.js`

### P5-165: Add deployment script for REVOKE_FUNCTION_DOCUMENTATION.md
**Labels:** `phase-5`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`

### P5-166: Add architecture diagram for PHASE_2.md
**Labels:** `phase-5`, `docs`
**Description:** Phase 5 docs pass — verify `PHASE_2.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `PHASE_2.md`

### P5-167: Add parallel job for .env.example
**Labels:** `phase-5`, `infra`
**Description:** Document how `Backend/.env.example` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/.env.example`

### P5-168: Review secrets exposure in rate-limiter.config.ts
**Labels:** `phase-5`, `security`
**Description:** Document trust assumptions for `Backend/src/rate-limiter/rate-limiter.config.ts` (oracles, multisig, beta access). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/rate-limiter/rate-limiter.config.ts`

### P5-169: Document component props in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Add minimal UI verification so CI can catch regressions in `Frontend/app/api/multisig/status/[txId]/route.ts` before beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/status/[txId]/route.ts` fits the app shell
**Related:** `Frontend/app/api/multisig/status/[txId]/route.ts`

### P5-170: Consolidate duplicate logic in deprecation.js
**Labels:** `phase-5`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/deprecation.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/middleware/deprecation.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/deprecation.js`

### P5-171: Add gas snapshot for REVOKE_FUNCTION_FEATURES.md
**Labels:** `phase-5`, `contracts`
**Description:** Phase 5 ensures `Contracts/REVOKE_FUNCTION_FEATURES.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/REVOKE_FUNCTION_FEATURES.md`

### P5-172: Add runbook section to PHASE_3.md
**Labels:** `phase-5`, `docs`
**Description:** Reduce onboarding time: `PHASE_3.md` should answer "how do I run wallet + trade flow locally?" _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `PHASE_3.md`

### P5-173: Configure CDN for upgradeManager.js
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/jobs/upgradeManager.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/jobs/upgradeManager.js`

### P5-174: Add beta gate check in rate-limiter.decorator.ts
**Labels:** `phase-5`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/rate-limiter/rate-limiter.decorator.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/rate-limiter/rate-limiter.decorator.ts`

### P5-175: Fix Next.js boot error in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Frontend foundations: ensure `Frontend/app/api/multisig/wallet/[walletId]/route.ts` builds under `Frontend/` Next.js app without runtime errors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/wallet/[walletId]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/multisig/wallet/[walletId]/route.ts`

### P5-176: Fix broken import in permissions.js
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/middleware/permissions.js` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/permissions.js`

### P5-177: Document NatSpec in REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md
**Labels:** `phase-5`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`
**Related:** `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`

### P5-178: Align README with PHASE_4.md
**Labels:** `phase-5`, `docs`
**Description:** Link `PHASE_4.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_4.md` verified on a clean checkout
**Related:** `PHASE_4.md`

### P5-179: Ship release notes for package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Backend/package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package-lock.json`

### P5-180: Harden auth flow in rate-limiter.guard.ts
**Labels:** `phase-5`, `security`
**Description:** Security: review `Backend/src/rate-limiter/rate-limiter.guard.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.guard.ts`
**Related:** `Backend/src/rate-limiter/rate-limiter.guard.ts`

### P5-181: Align route layout for route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Phase 5 requires `Frontend/app/api/ping/route.ts` to match README quickstart — wallet, routes, and API base URL must work on first run. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ping/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ping/route.ts`

### P5-182: Stabilize boot sequence of rateLimiter.js
**Labels:** `phase-5`, `backend`
**Description:** Contributors report friction around `Backend/middleware/rateLimiter.js`; eliminate silent failures on `npm run start:dev`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/rateLimiter.js`

### P5-183: Resolve import path in REVOKE_FUNCTION_QUICK_START.md
**Labels:** `phase-5`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_QUICK_START.md` in README or contract comments. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_QUICK_START.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_QUICK_START.md`
**Related:** `Contracts/REVOKE_FUNCTION_QUICK_START.md`

### P5-184: Document API contract in PHASE_5.md
**Labels:** `phase-5`, `docs`
**Description:** Remove outdated implementation claims in `PHASE_5.md` that contradict the codebase. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_5.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASE_5.md`

### P5-185: Document deploy path for package.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Backend/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/package.json`

### P5-186: Review oracle trust in rate-limiter.module.ts
**Labels:** `phase-5`, `security`
**Description:** Phase 5 security baseline — `Backend/src/rate-limiter/rate-limiter.module.ts` must not expose admin routes or keys without guards. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/rate-limiter/rate-limiter.module.ts`

### P5-187: Connect WebSocket hook in route.ts
**Labels:** `phase-5`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/trending-markets/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/trending-markets/route.ts`

### P5-188: Add startup logging to throttle.js
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/throttle.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/throttle.js`
**Related:** `Backend/middleware/throttle.js`

### P5-189: Stabilize `forge test` for REVOKE_FUNCTION_README.md
**Labels:** `phase-5`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_README.md`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_README.md`

### P5-190: Update setup section in PR_INSTRUCTIONS.md
**Labels:** `phase-5`, `docs`
**Description:** Documentation: `PR_INSTRUCTIONS.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Commands in `PR_INSTRUCTIONS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_INSTRUCTIONS.md`

### P5-191: Stabilize pipeline for deploy.js
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Backend/scripts/deploy.js` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/scripts/deploy.js`

### P5-192: Add input validation to rate-limiter.service.ts
**Labels:** `phase-5`, `security`
**Description:** Align `Backend/src/rate-limiter/rate-limiter.service.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/rate-limiter/rate-limiter.service.ts`

### P5-193: Replace mock data in page.tsx
**Labels:** `phase-5`, `frontend`
**Description:** Unify mock vs live data paths touching `Frontend/app/archive/page.tsx` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/archive/page.tsx`

### P5-194: Validate env vars for tradeValidation.js
**Labels:** `phase-5`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/tradeValidation.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/tradeValidation.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/tradeValidation.js`

### P5-195: Configure staging deploy for deployService.js
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Backend/services/deployService.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/services/deployService.js`

### P5-196: Add health check for version.js
**Labels:** `phase-5`, `backend`
**Description:** Phase 5 stabilizes the repo; `Backend/middleware/version.js` must match the canonical run path in README. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/version.js`

### P5-197: Add contract verify step for upgradeCoordinator.js
**Labels:** `phase-5`, `infra`
**Description:** Document how `Backend/services/upgradeCoordinator.js` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P5-198: Resolve TypeScript errors in 001_init_markets.js
**Labels:** `phase-5`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/migrations/001_init_markets.js`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/migrations/001_init_markets.js`
**Related:** `Backend/migrations/001_init_markets.js`

### P5-199: Add canary deploy for deploy.test.js
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Backend/tests/deploy.test.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tests/deploy.test.js`

### P5-200: Finalize env matrix for tsconfig.build.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Backend/tsconfig.build.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.build.json`

### P5-201: Add migration runbook for tsconfig.json
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Backend/tsconfig.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/tsconfig.json`

### P5-202: Configure monitoring dashboard for test.yml
**Labels:** `phase-5`, `infra`
**Description:** Document how `Contracts/.github/workflows/test.yml` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/.github/workflows/test.yml`

### P5-203: Add beta access gate to foundry.toml
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/foundry.toml`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/foundry.toml`

### P5-204: Ship release notes for package-lock.json
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Contracts/package-lock.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package-lock.json`

### P5-205: Add CI job for package.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Contracts/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/package.json`

### P5-206: Pin toolchain version in DeployMarketCap.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Phase 5 CI — ensure `Contracts/script/DeployMarketCap.s.sol` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P5-207: Add cache step for DeployRevokeFunction.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Document how `Contracts/script/DeployRevokeFunction.s.sol` maps to staging vs production env vars. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P5-208: Configure env matrix in DeployVoteWeight.s.sol
**Labels:** `phase-5`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/script/DeployVoteWeight.s.sol`. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P5-209: Add Docker build for hardhat.config.js
**Labels:** `phase-5`, `infra`
**Description:** Coordinate `Frontend/localnet/hardhat.config.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/hardhat.config.js`

### P5-210: Document deploy path for package.json
**Labels:** `phase-5`, `infra`
**Description:** Infra: `Frontend/localnet/package.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 5: deployment & shipping.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/package.json`
