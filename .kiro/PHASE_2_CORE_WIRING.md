# Phase 2: Core Market Wiring - Task Spec

**Created**: August 27, 2026  
**Branch**: `phase-2/setup-core-wiring`  
**Session Type**: Spec  
**Autonomy Mode**: Autopilot  
**Source**: PHASE_2.md  

---

## Overview

This spec documents four high-priority Phase 2 infrastructure and frontend tasks required for core market wiring:

1. **P2-125 (Infra)**: Document deploy.js env var mapping for staging vs production
2. **P2-043 (Frontend)**: Reduce setup friction in SETTINGS_DOCUMENTATION.md  
3. **P2-118 (Docs)**: Verify LIQUIDATION_QUICK_START.md build/run steps
4. **P2-042 (Security)**: Add negative-path tests for circuitBreaker.js abuse scenarios

All tasks target **P2-Core Market Wiring** and must meet acceptance criteria with CI green.

---

## Task 1: Infrastructure Documentation - Deploy Script Env Mapping

**ID**: P2-125  
**Labels**: `phase-2`, `infra`  
**Owner**: TBD  
**Related File**: `Frontend/localnet/scripts/deploy.js`  

### Description
Frontend/localnet/scripts/deploy.js must clearly map environment variables for staging vs production deployment pipelines. Contributors need to understand which vars control localnet testing, staging testnet, and production mainnet targets.

### Acceptance Criteria

- [ ] **CI workflow green** on PR touching `Frontend/localnet/scripts/deploy.js`
- [ ] **Toolchain versions documented and pinned** (Node, Hardhat, ethers.js, contract compiler)
- [ ] **Secrets not committed**; `.env.example` covers all required keys
- [ ] Env var mapping document added with:
  - [ ] Local development env vars (localnet, localhost:8545)
  - [ ] Staging env vars (testnet RPC URL, faucet keys, etc.)
  - [ ] Production env vars (mainnet RPC URL, minimal permissions)
  - [ ] Default fallbacks and safety checks documented

### Success Criteria
- PR merged with CI passing
- `.env.example` updated with all required keys
- Deployment script includes inline comments mapping vars to environment
- No hardcoded RPC URLs or private keys in source

### Implementation Notes
- Current script deploys MockERC20, MockRouter, and mints tokens to localhost
- Deploy output includes contract addresses for mockMarkets.ts
- Need to abstract RPC_URL, PRIVATE_KEY, NETWORK env vars
- Document how each env controls contract deployment, network selection, and output handling

---

## Task 2: Frontend Settings Documentation - Reduce Setup Friction

**ID**: P2-043  
**Labels**: `phase-2`, `frontend`  
**Owner**: TBD  
**Related File**: `Frontend/SETTINGS_DOCUMENTATION.md`  

### Description
Contributors encounter setup friction when implementing settings. The documentation is comprehensive but contributors report:
- Missing happy-path quick start
- Hard-coded localhost URLs in production code paths
- Blank screens on settings errors (no error surface to UI)
- Unclear relationship between SettingsService, hooks, and components

This task surfaces clear errors and reduces setup steps.

### Acceptance Criteria

- [ ] **Happy path covered**: Either Vitest test or manual checklist proving basic flow
- [ ] **No hardcoded localhost URLs** in production code paths (`!process.env.NODE_ENV === 'production'`)
- [ ] **npm run dev in Frontend/** renders pages without console errors
- [ ] Error states surfaced to UI (toast, error boundaries, or similar)
- [ ] Quick-start section added (under 10 steps to working settings)

### Success Criteria
- Settings page loads without errors
- All components render correctly
- Settings persist to localStorage
- Error messages appear in UI, not console only

### Implementation Notes
- Review all `useSettings`, `useSettingCategory`, `useSetting` hook usage
- Check for hardcoded `localhost:3000`, `localhost:4000` in settings sync code
- Add error boundary or error toast for failed backend sync
- Create `.env.example` for Frontend with `VITE_API_URL`, `VITE_BACKEND_URL` (defaults to localhost)
- Add "Getting Started" section to SETTINGS_DOCUMENTATION.md:
  1. Copy `.env.example` to `.env.local`
  2. Verify `useSettings` is imported from hooks
  3. Call `updateSettings()` to test persistence
  4. Settings appear on page reload

---

## Task 3: Documentation - LIQUIDATION_QUICK_START Verification

**ID**: P2-118  
**Labels**: `phase-2`, `docs`  
**Owner**: TBD  
**Related File**: `LIQUIDATION_QUICK_START.md`  

### Description
LIQUIDATION_QUICK_START.md provides build/run instructions for the Liquidation system. Contributors unfamiliar with the codebase need to verify:
- Build commands work on clean checkout
- Test commands pass
- Deployment steps are accurate
- Phase ownership (which phase/owner maintains each section)

This task ensures the guide is current and contributor-tested.

### Acceptance Criteria

- [ ] **Phase ownership noted** where applicable (e.g., "Phase 1: Deploy", "Phase 2: Integration")
- [ ] **Reviewed by unfamiliar contributor** (someone new to the repo tests the steps)
- [ ] **All build/run/test commands verified** on clean checkout:
  - [ ] `cd Contracts && forge test --match-path test/Liquidation.t.sol -vv` passes
  - [ ] Contract deployment steps match current contract signature
  - [ ] Integration steps reference correct contract methods

### Success Criteria
- All commands run successfully on fresh clone
- No manual corrections or workarounds needed
- Documentation is current with Liquidation.sol (tests match, struct names match)

### Implementation Notes
- Test on clean checkout: `git clone`, `cd Contracts`, run test command
- Verify 31 tests pass (documented in quick start)
- Check struct names (LiquidationCondition, LiquidationExecution) match actual contract
- Verify oracle, collateral, margin calculator references are current
- Add "Phase Ownership" table at top: which phase added/maintains each component

---

## Task 4: Security - Negative-Path Tests for circuitBreaker.js

**ID**: P2-042  
**Labels**: `phase-2`, `security`  
**Owner**: TBD  
**Related File**: `Backend/routes/circuitBreaker.js`  

### Description
circuitBreaker.js provides API endpoints to trip, reset, isolate, and configure circuit breakers. Abuse scenarios need negative-path testing:
- Unauth users resetting breakers
- Rate-limit bypass attempts  
- Invalid serviceName injection
- Config tampering (updating with malicious payloads)

This task hardens the route against abuse and documents threat model.

### Acceptance Criteria

- [ ] **No secrets or private keys** in Backend/routes/circuitBreaker.js (audit inline)
- [ ] **Negative-path test or checklist** added covering:
  - [ ] Missing serviceName validation (empty, null, SQL-like injection)
  - [ ] Unauthorized POST /trip, /reset, /config (should require auth middleware)
  - [ ] Rate-limit test (rapid /trip calls should be throttled)
  - [ ] Invalid config payloads (negative timeouts, out-of-bounds BPS values)
  - [ ] DoS: /reset-all called repeatedly should be protected
- [ ] **Threat notes recorded** in docs or inline comments documenting:
  - [ ] Auth/authorization requirements per endpoint
  - [ ] Rate-limit strategy (e.g., IP-based, per-service limit)
  - [ ] Input validation strategy (serviceName whitelist?)
  - [ ] Config bounds and validation rules

### Success Criteria
- Test file created: `Backend/tests/routes/circuitBreaker.negative.test.js`
- Negative tests fail on current code (or documented as future work)
- Threat model documented in `Backend/CIRCUIT_BREAKER_THREAT_MODEL.md`
- CI passes (tests should not break happy path)

### Implementation Notes
- Current route has error handler but missing auth/validation middleware
- POST /trip, /reset, /reset-all, /isolate, /config should require auth
- serviceName should be validated against registered service list
- Rate limiting should apply to destructive endpoints (/trip, /reset, /config)
- Config validation: ensure thresholds, timeouts are within bounds
- Add middleware check example in comments

---

## Workflow

### Phase: Requirements
All four tasks are pre-scoped with acceptance criteria above.

### Phase: Design  
**Decision points:**

1. **P2-125 (Deploy.js)**
   - Decision: Env var naming convention (e.g., `REACT_APP_` prefix for Frontend?)
   - Decision: .env.example location (root? Frontend/? Backend/?)

2. **P2-043 (Settings)**
   - Decision: Error handling pattern (toast vs error boundary vs both?)
   - Decision: Persist settings to backend or localStorage only?

3. **P2-118 (Liquidation Docs)**
   - Decision: Test on MacOS or Windows? (affects shell commands)
   - Decision: Phase ownership: who maintains liquidation docs going forward?

4. **P2-042 (CircuitBreaker Security)**
   - Decision: Auth middleware (JWT token? API key?)
   - Decision: Rate limit: per-IP, per-user, or per-service?

### Phase: Implementation
Execute tasks in order of dependency:
1. **P2-125** (Infra) - No dependencies
2. **P2-043** (Frontend) - No hard dependencies  
3. **P2-118** (Docs) - No hard dependencies
4. **P2-042** (Security) - Can run in parallel with others

### Phase: Verification
- [ ] All 4 tasks have PRs merged to main
- [ ] CI green on all related files
- [ ] No regression in existing tests
- [ ] Acceptance criteria checklist complete for each task

---

## File Modifications Summary

### Create
- `Frontend/localnet/scripts/.env.example` (Deploy.js)
- `Frontend/localnet/scripts/DEPLOY_ENV_MAPPING.md` (Deploy.js)
- `Backend/tests/routes/circuitBreaker.negative.test.js` (CircuitBreaker)
- `Backend/CIRCUIT_BREAKER_THREAT_MODEL.md` (CircuitBreaker)

### Modify
- `Frontend/localnet/scripts/deploy.js` - Add env var comments, update RPC URL handling
- `Frontend/SETTINGS_DOCUMENTATION.md` - Add quick-start section, error handling guide
- `LIQUIDATION_QUICK_START.md` - Add phase ownership, verify commands, update for current contract
- `Backend/routes/circuitBreaker.js` - Add security middleware, input validation, inline threat notes

### No Changes
- `.env` files (keep untracked)
- Backend config or core services

---

## Success Criteria (Overall)

- [ ] All 4 tasks have merged PRs
- [ ] CI workflow green
- [ ] No secrets committed
- [ ] Documentation complete and reviewed
- [ ] Negative tests added or scheduled
- [ ] Phase 2 core wiring unblocked for next tasks

---

## Related Issues

- **P2-125**: Sync market state via compressionService.js (upstream: Phase 1)
- **P2-043**: Resolve LMSR vs CLOB for Notification.js (upstream: ADR 0001)
- **P2-118**: Integrate Trading.sol with MarketSnapshot.js (upstream: P2-042)
- **P2-042**: Connect LMSR pricing in circuitBreaker.js (upstream: ADR 0001)

---

## Notes

- All tasks target **Phase 2: Core market wiring**
- No Phase 1 blockers identified
- Parallel execution recommended for independent tasks
- Security task (P2-042) may uncover permission middleware gap—handle in this task or defer

---

**Next Steps:**
1. Review and confirm acceptance criteria with team
2. Assign owners to each task
3. Create GitHub issues from template in PHASES.md
4. Start with P2-125 (Deploy.js infra)

