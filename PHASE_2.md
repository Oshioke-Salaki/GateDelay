# Phase 2: Core market wiring

> **Theme:** Core market wiring
> **Goal:** End-to-end wiring for MarketFactory, MarketMaker, LMSR, Trading, OrderBook/CLOB decision, resolution, and backend trade engine.

> **Area distribution:** frontend 37, backend 39, contracts 38, docs 32, infra 32, security 32 (210 issues)

Parent index: [PHASES.md](PHASES.md)

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).
Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.

### P2-001: Map contract events to UI in ARBITRAGE_DEMO.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ARBITRAGE_DEMO.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ARBITRAGE_DEMO.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ARBITRAGE_DEMO.md`

### P2-002: Sync market state in .env.example
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/.env.example`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/.env.example`

### P2-003: Add Foundry integration test for test.yml
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/.github/workflows/test.yml` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/.github/workflows/test.yml`
- [ ] `forge build` succeeds with `Contracts/.github/workflows/test.yml`
**Related:** `Contracts/.github/workflows/test.yml`

### P2-004: Add architecture diagram for BUG_ANALYSIS_REPORT.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `BUG_ANALYSIS_REPORT.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `BUG_ANALYSIS_REPORT.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `BUG_ANALYSIS_REPORT.md`

### P2-005: Wire artifact upload for ci.yml
**Labels:** `phase-2`, `infra`
**Description:** Document how `.github/workflows/ci.yml` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `.github/workflows/ci.yml`

### P2-006: Review secrets exposure in rateLimits.js
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/config/rateLimits.js` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/config/rateLimits.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/config/rateLimits.js`

### P2-007: Surface trade errors in ERROR_BOUNDARY_CHECKLIST.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_CHECKLIST.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/ERROR_BOUNDARY_CHECKLIST.md`

### P2-008: Document setup for API_PROTECTION_README.md
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/API_PROTECTION_README.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/API_PROTECTION_README.md`
**Related:** `Backend/API_PROTECTION_README.md`

### P2-009: Add Foundry test for API_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/API_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/API_REFERENCE.md`

### P2-010: Add runbook section to CHECKLIST.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `CHECKLIST.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `CHECKLIST.md`

### P2-011: Document rollback for .env.example
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/.env.example`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/.env.example`

### P2-012: Add beta gate check in ddosGuard.js
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/middleware/ddosGuard.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/middleware/ddosGuard.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/middleware/ddosGuard.js`

### P2-013: Validate env usage in ERROR_BOUNDARY_DOCUMENTATION.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/ERROR_BOUNDARY_DOCUMENTATION.md`

### P2-014: Add health check for COLLATERAL.md
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/COLLATERAL.md` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/COLLATERAL.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/COLLATERAL.md`

### P2-015: Add invariant test for BUG_ANALYSIS_AND_FIXES.md
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/BUG_ANALYSIS_AND_FIXES.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/BUG_ANALYSIS_AND_FIXES.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/BUG_ANALYSIS_AND_FIXES.md`

### P2-016: Align README with CIRCUIT_BREAKER_IMPLEMENTATION.md
**Labels:** `phase-2`, `docs`
**Description:** Link `CIRCUIT_BREAKER_IMPLEMENTATION.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `CIRCUIT_BREAKER_IMPLEMENTATION.md`

### P2-017: Add Docker build for upgradeManager.js
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Backend/jobs/upgradeManager.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/jobs/upgradeManager.js`

### P2-018: Harden auth flow in rateLimiter.js
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/middleware/rateLimiter.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/middleware/rateLimiter.js`

### P2-019: Add empty state to ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md` fits the app shell
**Related:** `Frontend/ERROR_BOUNDARY_INTEGRATION_EXAMPLES.md`

### P2-020: Ensure package scripts cover DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P2-021: Add event coverage test for Burnable.sol
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/Burnable.sol` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/Burnable.sol`

### P2-022: Document API contract in CIRCUIT_BREAKER_QUICK_REFERENCE.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `CIRCUIT_BREAKER_QUICK_REFERENCE.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `CIRCUIT_BREAKER_QUICK_REFERENCE.md`

### P2-023: Add health probe for package-lock.json
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Backend/package-lock.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/package-lock.json`

### P2-024: Review oracle trust in AuditLog.js
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/models/AuditLog.js` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/models/AuditLog.js`

### P2-025: Connect WebSocket prices in ERROR_BOUNDARY_QUICKSTART.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/ERROR_BOUNDARY_QUICKSTART.md`

### P2-026: Add WebSocket feed in DEPOSIT_SERVICE_README.md
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/DEPOSIT_SERVICE_README.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P2-027: Emit settlement events from CODE_REVIEW_REPORT.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/CODE_REVIEW_REPORT.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/CODE_REVIEW_REPORT.md`
**Related:** `Contracts/CODE_REVIEW_REPORT.md`

### P2-028: Update setup section in CIRCUIT_BREAKER_VERIFICATION.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `CIRCUIT_BREAKER_VERIFICATION.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `CIRCUIT_BREAKER_VERIFICATION.md` verified on a clean checkout
**Related:** `CIRCUIT_BREAKER_VERIFICATION.md`

### P2-029: Pin toolchain version in package.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `Backend/package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package.json`

### P2-030: Add input validation to beta.js
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/routes/beta.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/beta.js`
**Related:** `Backend/routes/beta.js`

### P2-031: Connect wallet signing in ERROR_BOUNDARY_SUMMARY.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/ERROR_BOUNDARY_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/ERROR_BOUNDARY_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/ERROR_BOUNDARY_SUMMARY.md`

### P2-032: Add order placement through IMPLEMENTATION.md
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/IMPLEMENTATION.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/IMPLEMENTATION.md`

### P2-033: Verify forge build for FLASHBORROW_DOCUMENTATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/FLASHBORROW_DOCUMENTATION.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_DOCUMENTATION.md`
**Related:** `Contracts/FLASHBORROW_DOCUMENTATION.md`

### P2-034: Add architecture diagram for DELIVERY_SUMMARY.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `DELIVERY_SUMMARY.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `DELIVERY_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `DELIVERY_SUMMARY.md`

### P2-035: Wire artifact upload for deploy.js
**Labels:** `phase-2`, `infra`
**Description:** Document how `Backend/scripts/deploy.js` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/scripts/deploy.js`

### P2-036: Review secrets exposure in blacklist.js
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/routes/blacklist.js` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/routes/blacklist.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/routes/blacklist.js`

### P2-037: Add error boundary around README.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/README.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/README.md`

### P2-038: Remove dead code in LIQUIDATION.md
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/LIQUIDATION.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/LIQUIDATION.md`
**Related:** `Backend/LIQUIDATION.md`

### P2-039: Pin dependency version in FLASHBORROW_README.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/FLASHBORROW_README.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/FLASHBORROW_README.md`
- [ ] `forge build` succeeds with `Contracts/FLASHBORROW_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/FLASHBORROW_README.md`

### P2-040: Add runbook section to DOES_IT_WORK_ANSWER.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `DOES_IT_WORK_ANSWER.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `DOES_IT_WORK_ANSWER.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `DOES_IT_WORK_ANSWER.md`

### P2-041: Document rollback for deployService.js
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/services/deployService.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/services/deployService.js`

### P2-042: Add beta gate check in circuitBreaker.js
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/routes/circuitBreaker.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/routes/circuitBreaker.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/routes/circuitBreaker.js`

### P2-043: Stabilize hydration in SETTINGS_DOCUMENTATION.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/SETTINGS_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/SETTINGS_DOCUMENTATION.md`

### P2-044: Fix lint violations in MARGIN.md
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/MARGIN.md` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/MARGIN.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/MARGIN.md`

### P2-045: Cross-check LMSR/CLOB usage in FlashLoanProtection.sol
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/FlashLoanProtection.sol`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/FlashLoanProtection.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/FlashLoanProtection.sol`

### P2-046: Align README with FEATURE_SUMMARY.md
**Labels:** `phase-2`, `docs`
**Description:** Link `FEATURE_SUMMARY.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `FEATURE_SUMMARY.md`

### P2-047: Add Docker build for upgradeCoordinator.js
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Backend/services/upgradeCoordinator.js` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/services/upgradeCoordinator.js`

### P2-048: Harden auth flow in multisig.js
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/routes/multisig.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/routes/multisig.js`

### P2-049: Replace mock market data in SETTINGS_QUICKSTART.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/SETTINGS_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_QUICKSTART.md` fits the app shell
**Related:** `Frontend/SETTINGS_QUICKSTART.md`

### P2-050: Expose REST endpoint in README.md
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/README.md`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/README.md`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/README.md`

### P2-051: Resolve LMSR vs CLOB in GAS_OPTIMIZATION_REPORT.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/GAS_OPTIMIZATION_REPORT.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/GAS_OPTIMIZATION_REPORT.md`

### P2-052: Document API contract in FINAL_VERIFICATION_REPORT.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `FINAL_VERIFICATION_REPORT.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `FINAL_VERIFICATION_REPORT.md`

### P2-053: Add health probe for deploy.test.js
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Backend/tests/deploy.test.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/tests/deploy.test.js`

### P2-054: Review oracle trust in whitelist.js
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/routes/whitelist.js` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/routes/whitelist.js`

### P2-055: Add resolution status to SETTINGS_SUMMARY.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/SETTINGS_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/SETTINGS_SUMMARY.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/SETTINGS_SUMMARY.md`

### P2-056: Connect AviationStack to RISK.md
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/RISK.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/RISK.md`

### P2-057: Verify Resolution flow in INTEGRATION_GUIDE.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/INTEGRATION_GUIDE.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/INTEGRATION_GUIDE.md`
**Related:** `Contracts/INTEGRATION_GUIDE.md`

### P2-058: Update setup section in FLASHBORROW_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
**Related:** `FLASHBORROW_IMPLEMENTATION_SUMMARY.md`

### P2-059: Pin toolchain version in tsconfig.build.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `Backend/tsconfig.build.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/tsconfig.build.json`

### P2-060: Add input validation to auditTrail.js
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/services/auditTrail.js` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/auditTrail.js`
**Related:** `Backend/services/auditTrail.js`

### P2-061: Replace mock data in TRADING_INTERFACE_DOCUMENTATION.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/TRADING_INTERFACE_DOCUMENTATION.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/TRADING_INTERFACE_DOCUMENTATION.md`

### P2-062: Validate env vars for TRADE_REPORTS.md
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/TRADE_REPORTS.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/TRADE_REPORTS.md`

### P2-063: Add deployment script for Liquidation.sol
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/Liquidation.sol` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/Liquidation.sol`
- [ ] `forge build` succeeds with `Contracts/Liquidation.sol`
**Related:** `Contracts/Liquidation.sol`

### P2-064: Add architecture diagram for FLASHBORROW_VERIFICATION.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `FLASHBORROW_VERIFICATION.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `FLASHBORROW_VERIFICATION.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `FLASHBORROW_VERIFICATION.md`

### P2-065: Wire artifact upload for tsconfig.json
**Labels:** `phase-2`, `infra`
**Description:** Document how `Backend/tsconfig.json` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/tsconfig.json`

### P2-066: Review secrets exposure in betaAccess.js
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/services/betaAccess.js` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/services/betaAccess.js`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/services/betaAccess.js`

### P2-067: Document component props in TRADING_INTERFACE_QUICKSTART.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/TRADING_INTERFACE_QUICKSTART.md`

### P2-068: Consolidate duplicate logic in TRADE_REPORTS_SETUP.md
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/TRADE_REPORTS_SETUP.md` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/TRADE_REPORTS_SETUP.md`
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P2-069: Add gas snapshot for MARKET_CAP_IMPLEMENTATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/MARKET_CAP_IMPLEMENTATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_CAP_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_CAP_IMPLEMENTATION.md`

### P2-070: Add runbook section to README.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `Frontend/README.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `Frontend/README.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `Frontend/README.md`

### P2-071: Document rollback for test.yml
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/.github/workflows/test.yml`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/.github/workflows/test.yml`

### P2-072: Add beta gate check in blacklistService.js
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/services/blacklistService.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/services/blacklistService.js`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/services/blacklistService.js`

### P2-073: Wire trade UI to API in TRADING_INTERFACE_SUMMARY.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/TRADING_INTERFACE_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/TRADING_INTERFACE_SUMMARY.md`

### P2-074: Index on-chain logs in UPTIME_MONITORING.md
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/UPTIME_MONITORING.md` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/UPTIME_MONITORING.md`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/UPTIME_MONITORING.md`

### P2-075: Integrate Trading.sol with MARKET_DELEGATION_API_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_DELEGATION_API_REFERENCE.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_DELEGATION_API_REFERENCE.md`

### P2-076: Align README with IMPLEMENTATION_CHECKLIST.md
**Labels:** `phase-2`, `docs`
**Description:** Link `IMPLEMENTATION_CHECKLIST.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_CHECKLIST.md`

### P2-077: Add Docker build for foundry.toml
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Contracts/foundry.toml` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/foundry.toml`

### P2-078: Harden auth flow in multisigService.js
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/services/multisigService.js` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/services/multisigService.js`

### P2-079: Sync position state in WEBSOCKET_IMPLEMENTATION.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_IMPLEMENTATION.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_IMPLEMENTATION.md` fits the app shell
**Related:** `Frontend/WEBSOCKET_IMPLEMENTATION.md`

### P2-080: Decode Trading events in pagerduty.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/config/pagerduty.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/config/pagerduty.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/config/pagerduty.js`

### P2-081: Bridge PositionTracker in MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`

### P2-082: Document API contract in IMPLEMENTATION_COMPLETE.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `IMPLEMENTATION_COMPLETE.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `IMPLEMENTATION_COMPLETE.md`

### P2-083: Add health probe for package-lock.json
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Contracts/package-lock.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Contracts/package-lock.json`

### P2-084: Review oracle trust in whitelistService.js
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/services/whitelistService.js` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/services/whitelistService.js`

### P2-085: Wire wallet connect flow in WEBSOCKET_INTEGRATION_EXAMPLES.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/WEBSOCKET_INTEGRATION_EXAMPLES.md`

### P2-086: Add smoke test for rateLimits.js
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/config/rateLimits.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/config/rateLimits.js`

### P2-087: Align ABI export for MARKET_DELEGATION_QUICK_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`
**Related:** `Contracts/MARKET_DELEGATION_QUICK_REFERENCE.md`

### P2-088: Update setup section in IMPLEMENTATION_REPORT.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `IMPLEMENTATION_REPORT.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_REPORT.md` verified on a clean checkout
**Related:** `IMPLEMENTATION_REPORT.md`

### P2-089: Pin toolchain version in package.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `Contracts/package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Contracts/package.json`

### P2-090: Add input validation to auth.controller.ts
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/src/auth/auth.controller.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.controller.ts`
**Related:** `Backend/src/auth/auth.controller.ts`

### P2-091: Fix TypeScript path alias in WEBSOCKET_QUICKSTART.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_QUICKSTART.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/WEBSOCKET_QUICKSTART.md` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/WEBSOCKET_QUICKSTART.md`

### P2-092: Add missing module export in eslint.config.mjs
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/eslint.config.mjs`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/eslint.config.mjs`

### P2-093: Verify remappings for MARKET_DELEGATION_README.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_DELEGATION_README.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_DELEGATION_README.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_DELEGATION_README.md`
**Related:** `Contracts/MARKET_DELEGATION_README.md`

### P2-094: Add architecture diagram for IMPLEMENTATION_SUCCESS.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `IMPLEMENTATION_SUCCESS.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `IMPLEMENTATION_SUCCESS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `IMPLEMENTATION_SUCCESS.md`

### P2-095: Wire artifact upload for DeployMarketCap.s.sol
**Labels:** `phase-2`, `infra`
**Description:** Document how `Contracts/script/DeployMarketCap.s.sol` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Contracts/script/DeployMarketCap.s.sol`

### P2-096: Review secrets exposure in auth.module.ts
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/auth.module.ts` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/auth.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/auth.module.ts`

### P2-097: Add vitest coverage for WEBSOCKET_SUMMARY.md
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/WEBSOCKET_SUMMARY.md`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/WEBSOCKET_SUMMARY.md`

### P2-098: Wire MarketFactory events to heartbeatServer.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/heartbeatServer.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/heartbeatServer.js`
**Related:** `Backend/heartbeatServer.js`

### P2-099: Connect LMSR pricing in MARKET_RELAY_IMPLEMENTATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/MARKET_RELAY_IMPLEMENTATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_IMPLEMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MARKET_RELAY_IMPLEMENTATION.md`

### P2-100: Add runbook section to IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `IMPLEMENTATION_SUMMARY.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `IMPLEMENTATION_SUMMARY.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `IMPLEMENTATION_SUMMARY.md`

### P2-101: Document rollback for DeployRevokeFunction.s.sol
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Contracts/script/DeployRevokeFunction.s.sol`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Contracts/script/DeployRevokeFunction.s.sol`

### P2-102: Add beta gate check in auth.service.ts
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/auth/auth.service.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/auth/auth.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/auth/auth.service.ts`

### P2-103: Display live order book in page.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/analytics/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/analytics/page.tsx`

### P2-104: Implement settlement hook in arbitrageMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/jobs/arbitrageMonitor.js` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/arbitrageMonitor.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P2-105: Add market lifecycle to MARKET_RELAY_INTEGRATION_GUIDE.md
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/MARKET_RELAY_INTEGRATION_GUIDE.md`

### P2-106: Align README with IMPLEMENTATION_VERIFIED.txt
**Labels:** `phase-2`, `docs`
**Description:** Link `IMPLEMENTATION_VERIFIED.txt` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `IMPLEMENTATION_VERIFIED.txt`

### P2-107: Add Docker build for DeployVoteWeight.s.sol
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Contracts/script/DeployVoteWeight.s.sol` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Contracts/script/DeployVoteWeight.s.sol`

### P2-108: Harden auth flow in auth.dto.ts
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/src/auth/dto/auth.dto.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P2-109: Add loading skeleton to page.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api-keys/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api-keys/page.tsx` fits the app shell
**Related:** `Frontend/app/api-keys/page.tsx`

### P2-110: Unify Express/Nest path for batchExecutor.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/jobs/batchExecutor.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/batchExecutor.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/batchExecutor.js`

### P2-111: Fix compiler warning in MARKET_RELAY_QUICK_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/MARKET_RELAY_QUICK_REFERENCE.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/MARKET_RELAY_QUICK_REFERENCE.md`

### P2-112: Document API contract in LIQUIDATION_IMPLEMENTATION.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `LIQUIDATION_IMPLEMENTATION.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `LIQUIDATION_IMPLEMENTATION.md`

### P2-113: Add health probe for hardhat.config.js
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Frontend/localnet/hardhat.config.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/localnet/hardhat.config.js`

### P2-114: Review oracle trust in user.entity.ts
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/src/auth/entities/user.entity.ts` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P2-115: Add smoke test for route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/gateway/[hash]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/gateway/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/ipfs/gateway/[hash]/route.ts`

### P2-116: Resolve TypeScript errors in complianceChecker.js
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/complianceChecker.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/complianceChecker.js`

### P2-117: Add fuzz harness for MARKET_RELAY_README.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/MARKET_RELAY_README.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_README.md`
**Related:** `Contracts/MARKET_RELAY_README.md`

### P2-118: Update setup section in LIQUIDATION_QUICK_START.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `LIQUIDATION_QUICK_START.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `LIQUIDATION_QUICK_START.md` verified on a clean checkout
**Related:** `LIQUIDATION_QUICK_START.md`

### P2-119: Pin toolchain version in package.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `Frontend/localnet/package.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Frontend/localnet/package.json`

### P2-120: Add input validation to jwt-auth.guard.ts
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/src/auth/guards/jwt-auth.guard.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/guards/jwt-auth.guard.ts`
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P2-121: Fix responsive layout in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/pin/[hash]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ipfs/pin/[hash]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ipfs/pin/[hash]/route.ts`

### P2-122: Add integration test for heartbeatMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/heartbeatMonitor.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P2-123: Wire MarketFactory to MARKET_RELAY_SECURITY_ANALYSIS.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
- [ ] `forge build` succeeds with `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`
**Related:** `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

### P2-124: Add architecture diagram for MARKET_DELEGATION_CHECKLIST.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `MARKET_DELEGATION_CHECKLIST.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MARKET_DELEGATION_CHECKLIST.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `MARKET_DELEGATION_CHECKLIST.md`

### P2-125: Wire artifact upload for deploy.js
**Labels:** `phase-2`, `infra`
**Description:** Document how `Frontend/localnet/scripts/deploy.js` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Frontend/localnet/scripts/deploy.js`

### P2-126: Review secrets exposure in jwt.strategy.ts
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/src/auth/strategies/jwt.strategy.ts` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/auth/strategies/jwt.strategy.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P2-127: Bridge order placement in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/ipfs/retrieve/[hash]/route.ts`

### P2-128: Map contract ABI in liquidationMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/jobs/liquidationMonitor.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/liquidationMonitor.js`
**Related:** `Backend/jobs/liquidationMonitor.js`

### P2-129: Deploy script update for MarketMinter.sol
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/MarketMinter.sol` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/MarketMinter.sol`
- [ ] `forge build` succeeds with `Contracts/MarketMinter.sol`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/MarketMinter.sol`

### P2-130: Add runbook section to MARKET_DELEGATION_COMPLETE.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `MARKET_DELEGATION_COMPLETE.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `MARKET_DELEGATION_COMPLETE.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `MARKET_DELEGATION_COMPLETE.md`

### P2-131: Document rollback for package-lock.json
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Frontend/package-lock.json`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Frontend/package-lock.json`

### P2-132: Add beta gate check in market-audit.dto.ts
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/dto/market-audit.dto.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/dto/market-audit.dto.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/dto/market-audit.dto.ts`

### P2-133: Fix Next.js boot error in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ipfs/upload-json/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/ipfs/upload-json/route.ts`

### P2-134: Fix broken import in sanityCheck.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/jobs/sanityCheck.js` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/jobs/sanityCheck.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/jobs/sanityCheck.js`

### P2-135: Document NatSpec in QUICK_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/QUICK_REFERENCE.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/QUICK_REFERENCE.md`

### P2-136: Align README with MARKET_RELAY_DELIVERY_SUMMARY.md
**Labels:** `phase-2`, `docs`
**Description:** Link `MARKET_RELAY_DELIVERY_SUMMARY.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `MARKET_RELAY_DELIVERY_SUMMARY.md`

### P2-137: Add Docker build for package.json
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Frontend/package.json` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Frontend/package.json`

### P2-138: Harden auth flow in market-audit.controller.ts
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/src/market-audit/market-audit.controller.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/market-audit/market-audit.controller.ts`

### P2-139: Align route layout for route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/market-audit/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-audit/route.ts` fits the app shell
**Related:** `Frontend/app/api/market-audit/route.ts`

### P2-140: Stabilize boot sequence of snapshotCapture.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/jobs/snapshotCapture.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/jobs/snapshotCapture.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/snapshotCapture.js`

### P2-141: Resolve import path in README.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/README.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/README.md`

### P2-142: Document API contract in MARKET_RELAY_FILES_CHECKLIST.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `MARKET_RELAY_FILES_CHECKLIST.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `MARKET_RELAY_FILES_CHECKLIST.md`

### P2-143: Add health probe for tsconfig.json
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Frontend/tsconfig.json` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Frontend/tsconfig.json`

### P2-144: Review oracle trust in market-audit.entity.ts
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/src/market-audit/market-audit.entity.ts` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/market-audit/market-audit.entity.ts`

### P2-145: Connect WebSocket hook in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/market-sentiment/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/market-sentiment/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/market-sentiment/route.ts`

### P2-146: Add startup logging to tradeExecutor.js
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/jobs/tradeExecutor.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/jobs/tradeExecutor.js`

### P2-147: Stabilize `forge test` for README_MARKETCAP.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/README_MARKETCAP.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_MARKETCAP.md`
**Related:** `Contracts/README_MARKETCAP.md`

### P2-148: Update setup section in MINTING_PAUSABLE_IMPLEMENTATION.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `MINTING_PAUSABLE_IMPLEMENTATION.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `MINTING_PAUSABLE_IMPLEMENTATION.md` verified on a clean checkout
**Related:** `MINTING_PAUSABLE_IMPLEMENTATION.md`

### P2-149: Pin toolchain version in package-lock.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `package-lock.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `package-lock.json`

### P2-150: Add input validation to market-audit.module.ts
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/src/market-audit/market-audit.module.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.module.ts`
**Related:** `Backend/src/market-audit/market-audit.module.ts`

### P2-151: Map contract events to UI in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/execute/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/execute/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/multisig/execute/route.ts`

### P2-152: Sync market state in upgradeManager.js
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/jobs/upgradeManager.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/jobs/upgradeManager.js`

### P2-153: Add Foundry integration test for README_VOTE_DELEGATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/README_VOTE_DELEGATION.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/README_VOTE_DELEGATION.md`
- [ ] `forge build` succeeds with `Contracts/README_VOTE_DELEGATION.md`
**Related:** `Contracts/README_VOTE_DELEGATION.md`

### P2-154: Add architecture diagram for PHASES.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `PHASES.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASES.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASES.md`

### P2-155: Wire artifact upload for package.json
**Labels:** `phase-2`, `infra`
**Description:** Document how `package.json` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `package.json`

### P2-156: Review secrets exposure in market-audit.service.spec.ts
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/src/market-audit/market-audit.service.spec.ts` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.spec.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/market-audit/market-audit.service.spec.ts`

### P2-157: Surface trade errors in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/propose/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/multisig/propose/route.ts`

### P2-158: Document setup for backwardCompat.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/backwardCompat.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/backwardCompat.js`
**Related:** `Backend/middleware/backwardCompat.js`

### P2-159: Add Foundry test for REVOKE_FUNCTION_API_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/REVOKE_FUNCTION_API_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_API_REFERENCE.md`

### P2-160: Add runbook section to PHASE_1.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `PHASE_1.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `PHASE_1.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PHASE_1.md`

### P2-161: Document rollback for ci.yml
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `.github/workflows/ci.yml`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `.github/workflows/ci.yml`

### P2-162: Add beta gate check in market-audit.service.ts
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/market-audit/market-audit.service.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/market-audit/market-audit.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/market-audit/market-audit.service.ts`

### P2-163: Validate env usage in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/sign/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/api/multisig/sign/route.ts`

### P2-164: Add health check for ddosGuard.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/middleware/ddosGuard.js` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/ddosGuard.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/ddosGuard.js`

### P2-165: Add invariant test for REVOKE_FUNCTION_DOCUMENTATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/REVOKE_FUNCTION_DOCUMENTATION.md`

### P2-166: Align README with PHASE_2.md
**Labels:** `phase-2`, `docs`
**Description:** Link `PHASE_2.md` to ADR 0001 and phase roadmap in `PHASES.md` where relevant. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
**Related:** `PHASE_2.md`

### P2-167: Add Docker build for .env.example
**Labels:** `phase-2`, `infra`
**Description:** Coordinate `Backend/.env.example` with `Backend/services/upgradeCoordinator.js` for deploy sequencing. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
**Related:** `Backend/.env.example`

### P2-168: Harden auth flow in rate-limiter.config.ts
**Labels:** `phase-2`, `security`
**Description:** Security: review `Backend/src/rate-limiter/rate-limiter.config.ts` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
**Related:** `Backend/src/rate-limiter/rate-limiter.config.ts`

### P2-169: Add empty state to route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/status/[txId]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/status/[txId]/route.ts` fits the app shell
**Related:** `Frontend/app/api/multisig/status/[txId]/route.ts`

### P2-170: Ensure package scripts cover deprecation.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/middleware/deprecation.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/middleware/deprecation.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/deprecation.js`

### P2-171: Add event coverage test for REVOKE_FUNCTION_FEATURES.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/REVOKE_FUNCTION_FEATURES.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/REVOKE_FUNCTION_FEATURES.md`

### P2-172: Document API contract in PHASE_3.md
**Labels:** `phase-2`, `docs`
**Description:** Remove outdated implementation claims in `PHASE_3.md` that contradict the codebase. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Env vars and ports match `.env.example` files
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
**Related:** `PHASE_3.md`

### P2-173: Add health probe for upgradeManager.js
**Labels:** `phase-2`, `infra`
**Description:** Infra: `Backend/jobs/upgradeManager.js` must be part of reproducible local and CI builds for GateDelay. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rollback or retry documented for deploy steps
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
**Related:** `Backend/jobs/upgradeManager.js`

### P2-174: Review oracle trust in rate-limiter.decorator.ts
**Labels:** `phase-2`, `security`
**Description:** Phase 2 security baseline — `Backend/src/rate-limiter/rate-limiter.decorator.ts` must not expose admin routes or keys without guards. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Threat notes recorded in docs or inline comments
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
**Related:** `Backend/src/rate-limiter/rate-limiter.decorator.ts`

### P2-175: Connect WebSocket prices in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/multisig/wallet/[walletId]/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/multisig/wallet/[walletId]/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/api/multisig/wallet/[walletId]/route.ts`

### P2-176: Add WebSocket feed in permissions.js
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/middleware/permissions.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/middleware/permissions.js`

### P2-177: Emit settlement events from REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`
**Related:** `Contracts/REVOKE_FUNCTION_INTEGRATION_CHECKLIST.md`

### P2-178: Update setup section in PHASE_4.md
**Labels:** `phase-2`, `docs`
**Description:** Documentation: `PHASE_4.md` must accurately describe current build/run steps for GateDelay contributors. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Phase ownership noted where applicable
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_4.md` verified on a clean checkout
**Related:** `PHASE_4.md`

### P2-179: Pin toolchain version in package-lock.json
**Labels:** `phase-2`, `infra`
**Description:** Phase 2 CI — ensure `Backend/package-lock.json` gates merges on lint/test for its area (Backend, Frontend, or Contracts). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Smoke test passes after build
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
**Related:** `Backend/package-lock.json`

### P2-180: Add input validation to rate-limiter.guard.ts
**Labels:** `phase-2`, `security`
**Description:** Align `Backend/src/rate-limiter/rate-limiter.guard.ts` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Security review completed with no critical findings
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.guard.ts`
**Related:** `Backend/src/rate-limiter/rate-limiter.guard.ts`

### P2-181: Connect wallet signing in route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/ping/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/api/ping/route.ts` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/api/ping/route.ts`

### P2-182: Add order placement through rateLimiter.js
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/rateLimiter.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/rateLimiter.js`

### P2-183: Verify forge build for REVOKE_FUNCTION_QUICK_START.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/REVOKE_FUNCTION_QUICK_START.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_QUICK_START.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_QUICK_START.md`
**Related:** `Contracts/REVOKE_FUNCTION_QUICK_START.md`

### P2-184: Add architecture diagram for PHASE_5.md
**Labels:** `phase-2`, `docs`
**Description:** Phase 2 docs pass — verify `PHASE_5.md` matches `Backend/`, `Frontend/`, and `Contracts/` reality. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Reviewed by a contributor unfamiliar with the repo
- [ ] Commands in `PHASE_5.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
**Related:** `PHASE_5.md`

### P2-185: Wire artifact upload for package.json
**Labels:** `phase-2`, `infra`
**Description:** Document how `Backend/package.json` maps to staging vs production env vars. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] CI workflow green on PR touching related code
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
**Related:** `Backend/package.json`

### P2-186: Review secrets exposure in rate-limiter.module.ts
**Labels:** `phase-2`, `security`
**Description:** Document trust assumptions for `Backend/src/rate-limiter/rate-limiter.module.ts` (oracles, multisig, beta access). _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Rate limits or access guards verified
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.module.ts`
- [ ] Negative-path test or checklist item added
**Related:** `Backend/src/rate-limiter/rate-limiter.module.ts`

### P2-187: Add error boundary around route.ts
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/api/trending-markets/route.ts`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/api/trending-markets/route.ts`

### P2-188: Remove dead code in throttle.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/middleware/throttle.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/throttle.js`
**Related:** `Backend/middleware/throttle.js`

### P2-189: Pin dependency version in REVOKE_FUNCTION_README.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/REVOKE_FUNCTION_README.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge build` succeeds with `Contracts/REVOKE_FUNCTION_README.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/REVOKE_FUNCTION_README.md`

### P2-190: Add runbook section to PR_INSTRUCTIONS.md
**Labels:** `phase-2`, `docs`
**Description:** Reduce onboarding time: `PR_INSTRUCTIONS.md` should answer "how do I run wallet + trade flow locally?" _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Commands in `PR_INSTRUCTIONS.md` verified on a clean checkout
- [ ] Links resolve and point to existing files
- [ ] Env vars and ports match `.env.example` files
**Related:** `PR_INSTRUCTIONS.md`

### P2-191: Document rollback for deploy.js
**Labels:** `phase-2`, `infra`
**Description:** Add smoke verification after build steps involving `Backend/scripts/deploy.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Toolchain versions documented and pinned
- [ ] Secrets not committed; `.env.example` covers required keys
- [ ] Rollback or retry documented for deploy steps
**Related:** `Backend/scripts/deploy.js`

### P2-192: Add beta gate check in rate-limiter.service.ts
**Labels:** `phase-2`, `security`
**Description:** Add negative-path tests for abuse scenarios involving `Backend/src/rate-limiter/rate-limiter.service.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No secrets or private keys in `Backend/src/rate-limiter/rate-limiter.service.ts`
- [ ] Negative-path test or checklist item added
- [ ] Threat notes recorded in docs or inline comments
**Related:** `Backend/src/rate-limiter/rate-limiter.service.ts`

### P2-193: Stabilize hydration in page.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/archive/page.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
**Related:** `Frontend/app/archive/page.tsx`

### P2-194: Fix lint violations in tradeValidation.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 stabilizes the repo; `Backend/middleware/tradeValidation.js` must match the canonical run path in README. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/middleware/tradeValidation.js`
- [ ] README documents env vars and scripts for this module
**Related:** `Backend/middleware/tradeValidation.js`

### P2-195: Cross-check LMSR/CLOB usage in RoleManager.sol
**Labels:** `phase-2`, `contracts`
**Description:** Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `Contracts/RoleManager.sol`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge build` succeeds with `Contracts/RoleManager.sol`
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
**Related:** `Contracts/RoleManager.sol`

### P2-196: Fix responsive layout in page.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Phase 2 wiring: `Frontend/app/audit/page.tsx` must consume live backend/chain data instead of `Frontend/data/mockMarkets.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README or `Frontend/README.md` documents how `Frontend/app/audit/page.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
**Related:** `Frontend/app/audit/page.tsx`

### P2-197: Add integration test for version.js
**Labels:** `phase-2`, `backend`
**Description:** Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `Backend/middleware/version.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
**Related:** `Backend/middleware/version.js`

### P2-198: Wire MarketFactory to VERIFICATION_REPORT.md
**Labels:** `phase-2`, `contracts`
**Description:** Contracts foundations: `Contracts/VERIFICATION_REPORT.md` must compile and pass `forge test` in `Contracts/` before market wiring. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/VERIFICATION_REPORT.md`
- [ ] `forge build` succeeds with `Contracts/VERIFICATION_REPORT.md`
**Related:** `Contracts/VERIFICATION_REPORT.md`

### P2-199: Replace mock market data in BridgeClient.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/bridge/BridgeClient.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No hard-coded localhost URLs left in production path
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/bridge/BridgeClient.tsx` fits the app shell
**Related:** `Frontend/app/bridge/BridgeClient.tsx`

### P2-200: Expose REST endpoint in 001_init_markets.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/migrations/001_init_markets.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/migrations/001_init_markets.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/migrations/001_init_markets.js`

### P2-201: Resolve LMSR vs CLOB in VOTEWEIGHT_CHECKLIST.md
**Labels:** `phase-2`, `contracts`
**Description:** Document deploy order and constructor args for `Contracts/VOTEWEIGHT_CHECKLIST.md` in README or contract comments. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `forge test` passes for tests covering this contract
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
**Related:** `Contracts/VOTEWEIGHT_CHECKLIST.md`

### P2-202: Bridge order placement in page.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Phase 2 wiring: `Frontend/app/bridge/page.tsx` must consume live backend/chain data instead of `Frontend/data/mockMarkets.ts`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Wallet connect and navigation work on first load
- [ ] Vitest or manual checklist covers the happy path
- [ ] No hard-coded localhost URLs left in production path
**Related:** `Frontend/app/bridge/page.tsx`

### P2-203: Map contract ABI in AuditLog.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/models/AuditLog.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/models/AuditLog.js`
**Related:** `Backend/models/AuditLog.js`

### P2-204: Deploy script update for VOTEWEIGHT_DOCUMENTATION.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/VOTEWEIGHT_DOCUMENTATION.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/VOTEWEIGHT_DOCUMENTATION.md`
- [ ] `forge build` succeeds with `Contracts/VOTEWEIGHT_DOCUMENTATION.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/VOTEWEIGHT_DOCUMENTATION.md`

### P2-205: Add resolution status to ConnectKitBridge.tsx
**Labels:** `phase-2`, `frontend`
**Description:** Contributors hit friction in `Frontend/app/components/ConnectKitBridge.tsx`; reduce setup steps and surface clear errors instead of blank screens. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm run dev` in `Frontend/` renders pages using this file without console errors
- [ ] README or `Frontend/README.md` documents how `Frontend/app/components/ConnectKitBridge.tsx` fits the app shell
- [ ] Wallet connect and navigation work on first load
**Related:** `Frontend/app/components/ConnectKitBridge.tsx`

### P2-206: Connect AviationStack to Balance.js
**Labels:** `phase-2`, `backend`
**Description:** Unify legacy Express routes and Nest modules touching `Backend/models/Balance.js`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
- [ ] `npm test` or smoke script succeeds for this area
**Related:** `Backend/models/Balance.js`

### P2-207: Verify Resolution flow in VOTEWEIGHT_IMPLEMENTATION_SUMMARY.md
**Labels:** `phase-2`, `contracts`
**Description:** Eliminate flaky or skipped tests involving `Contracts/VOTEWEIGHT_IMPLEMENTATION_SUMMARY.md`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] NatSpec or README notes constructor/deploy requirements
- [ ] ABI artifacts generated and referenced by Backend if applicable
- [ ] No critical compiler warnings in `Contracts/VOTEWEIGHT_IMPLEMENTATION_SUMMARY.md`
**Related:** `Contracts/VOTEWEIGHT_IMPLEMENTATION_SUMMARY.md`

### P2-208: Document setup for Collateral.js
**Labels:** `phase-2`, `backend`
**Description:** Backend foundations: ensure `Backend/models/Collateral.js` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] `npm test` or smoke script succeeds for this area
- [ ] Change covered by test or documented manual checklist
- [ ] Local dev server starts without errors involving `Backend/models/Collateral.js`
**Related:** `Backend/models/Collateral.js`

### P2-209: Add Foundry test for VOTEWEIGHT_QUICK_REFERENCE.md
**Labels:** `phase-2`, `contracts`
**Description:** Phase 2 ensures `Contracts/VOTEWEIGHT_QUICK_REFERENCE.md` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] No critical compiler warnings in `Contracts/VOTEWEIGHT_QUICK_REFERENCE.md`
- [ ] `forge build` succeeds with `Contracts/VOTEWEIGHT_QUICK_REFERENCE.md`
- [ ] `forge test` passes for tests covering this contract
**Related:** `Contracts/VOTEWEIGHT_QUICK_REFERENCE.md`

### P2-210: Unify Express/Nest path for Dispute.js
**Labels:** `phase-2`, `backend`
**Description:** Contributors report friction around `Backend/models/Dispute.js`; eliminate silent failures on `npm run start:dev`. _(Phase 2: core market wiring.)_
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving `Backend/models/Dispute.js`
- [ ] README documents env vars and scripts for this module
- [ ] No critical console errors on boot
**Related:** `Backend/models/Dispute.js`
