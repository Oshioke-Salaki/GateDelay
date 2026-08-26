# Phase 2: Core market wiring

> **Theme:** Core market wiring
> **Goal:** End-to-end wiring for MarketFactory, MarketMaker, LMSR, Trading, OrderBook/CLOB decision, resolution, and backend trade engine.

Parent index: [PHASES.md](PHASES.md)

## Ownership and related docs

| | |
|---|---|
| **Phase owner** | Phase 2 (GitHub label `phase-2`) — core market wiring |
| **Roadmap** | [PHASES.md](PHASES.md) |
| **Trading model** | [ADR 0001: LMSR vs CLOB](docs/adr/0001-lmsr-vs-clob-ambiguity.md) — proposed; **this phase decides** |
| **Foundations** | [PHASE_1.md](PHASE_1.md) |
| **Local env / ports** | [`Backend/.env.example`](Backend/.env.example) (`PORT=4000`, `FRONTEND_URL=http://localhost:3000`, `HEARTBEAT_PORT=4001`, `RPC_URL=http://127.0.0.1:8545`) |

Until ADR 0001 is closed, treat `MarketMaker` + `Trading` + `LMSR` (`Contracts/src/`) as the canonical prediction-market path. `Contracts/src/OrderBook.sol` is isolated CLOB code, not the live market lifecycle.

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).

### P2-001: Connect LMSR pricing in API_PROTECTION_README.md
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/API_PROTECTION_README.md; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/API_PROTECTION_README.md`

### P2-002: Integrate Trading.sol with COLLATERAL.md
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/COLLATERAL.md.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/COLLATERAL.md`

### P2-003: Resolve LMSR vs CLOB for DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/DEPOSIT_SERVICE_DOCUMENTATION.md.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P2-004: Index on-chain events from DEPOSIT_SERVICE_README.md
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/DEPOSIT_SERVICE_README.md so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P2-005: Sync market state via IMPLEMENTATION.md
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/IMPLEMENTATION.md is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/IMPLEMENTATION.md`

### P2-006: Expose REST endpoint for LIQUIDATION.md
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/LIQUIDATION.md; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/LIQUIDATION.md`

### P2-007: Map contract ABI to MARGIN.md
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/MARGIN.md.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/MARGIN.md`

### P2-008: Add WebSocket feed for README.md
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/README.md.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/README.md`

### P2-009: Implement settlement hook in RISK.md
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/RISK.md so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/RISK.md`

### P2-010: Bridge frontend trade UI to TRADE_REPORTS.md
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/TRADE_REPORTS.md is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/TRADE_REPORTS.md`

### P2-011: Add resolution pipeline in TRADE_REPORTS_SETUP.md
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/TRADE_REPORTS_SETUP.md; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P2-012: Deploy script update for UPTIME_MONITORING.md
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/UPTIME_MONITORING.md.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/UPTIME_MONITORING.md`

### P2-013: Add Foundry test covering pagerduty.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/config/pagerduty.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/config/pagerduty.js`

### P2-014: Emit events from rateLimits.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/config/rateLimits.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/config/rateLimits.js`

### P2-015: Decode logs in eslint.config.mjs
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/eslint.config.mjs is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/eslint.config.mjs`

### P2-016: Add market lifecycle state to heartbeatServer.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/heartbeatServer.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/heartbeatServer.js`

### P2-017: Connect AviationStack data to arbitrageMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/jobs/arbitrageMonitor.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P2-018: Wire position tracking in batchExecutor.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/jobs/batchExecutor.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/jobs/batchExecutor.js`

### P2-019: Add order placement through complianceChecker.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/jobs/complianceChecker.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/jobs/complianceChecker.js`

### P2-020: Wire MarketFactory to heartbeatMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/jobs/heartbeatMonitor.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P2-021: Connect LMSR pricing in liquidationMonitor.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/jobs/liquidationMonitor.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/jobs/liquidationMonitor.js`

### P2-022: Integrate Trading.sol with sanityCheck.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/jobs/sanityCheck.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/jobs/sanityCheck.js`

### P2-023: Resolve LMSR vs CLOB for snapshotCapture.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/jobs/snapshotCapture.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/jobs/snapshotCapture.js`

### P2-024: Index on-chain events from tradeExecutor.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/jobs/tradeExecutor.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/jobs/tradeExecutor.js`

### P2-025: Sync market state via upgradeManager.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/jobs/upgradeManager.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/jobs/upgradeManager.js`

### P2-026: Expose REST endpoint for backwardCompat.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/middleware/backwardCompat.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/middleware/backwardCompat.js`

### P2-027: Map contract ABI to ddosGuard.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/middleware/ddosGuard.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/middleware/ddosGuard.js`

### P2-028: Add WebSocket feed for deprecation.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/middleware/deprecation.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/middleware/deprecation.js`

### P2-029: Implement settlement hook in permissions.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/middleware/permissions.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/middleware/permissions.js`

### P2-030: Bridge frontend trade UI to rateLimiter.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/middleware/rateLimiter.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/middleware/rateLimiter.js`

### P2-031: Add resolution pipeline in throttle.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/middleware/throttle.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/middleware/throttle.js`

### P2-032: Deploy script update for tradeValidation.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/middleware/tradeValidation.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/middleware/tradeValidation.js`

### P2-033: Add Foundry test covering version.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/middleware/version.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/middleware/version.js`

### P2-034: Emit events from 001_init_markets.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/migrations/001_init_markets.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/migrations/001_init_markets.js`

### P2-035: Decode logs in AuditLog.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/models/AuditLog.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/models/AuditLog.js`

### P2-036: Add market lifecycle state to Balance.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/models/Balance.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/models/Balance.js`

### P2-037: Connect AviationStack data to Collateral.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/models/Collateral.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/models/Collateral.js`

### P2-038: Wire position tracking in Dispute.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/models/Dispute.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/models/Dispute.js`

### P2-039: Add order placement through Liquidation.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/models/Liquidation.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/models/Liquidation.js`

### P2-040: Wire MarketFactory to MarginAccount.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/models/MarginAccount.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/models/MarginAccount.js`

### P2-041: Connect LMSR pricing in MarginCall.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/models/MarginCall.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/models/MarginCall.js`

### P2-042: Integrate Trading.sol with MarketSnapshot.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/models/MarketSnapshot.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/models/MarketSnapshot.js`

### P2-043: Resolve LMSR vs CLOB for Notification.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/models/Notification.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/models/Notification.js`

### P2-044: Index on-chain events from Order.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/models/Order.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/models/Order.js`

### P2-045: Sync market state via PriceHistory.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/models/PriceHistory.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/models/PriceHistory.js`

### P2-046: Expose REST endpoint for Referral.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/models/Referral.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/models/Referral.js`

### P2-047: Map contract ABI to RiskConfig.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/models/RiskConfig.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/models/RiskConfig.js`

### P2-048: Add WebSocket feed for RiskScore.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/models/RiskScore.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/models/RiskScore.js`

### P2-049: Implement settlement hook in TradeReport.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/models/TradeReport.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/models/TradeReport.js`

### P2-050: Bridge frontend trade UI to nest-cli.json
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/nest-cli.json is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/nest-cli.json`

### P2-051: Add resolution pipeline in package-lock.json
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/package-lock.json; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/package-lock.json`

### P2-052: Deploy script update for package.json
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/package.json.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/package.json`

### P2-053: Add Foundry test covering aggregatedTrades.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/aggregatedTrades.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/aggregatedTrades.js`

### P2-054: Emit events from alerts.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/alerts.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/alerts.js`

### P2-055: Decode logs in aml.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/aml.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/aml.js`

### P2-056: Add market lifecycle state to api.example.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/api.example.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/api.example.js`

### P2-057: Connect AviationStack data to approvals.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/approvals.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/approvals.js`

### P2-058: Wire position tracking in beta.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/beta.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/beta.js`

### P2-059: Add order placement through blacklist.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/blacklist.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/blacklist.js`

### P2-060: Wire MarketFactory to bridge.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/bridge.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/bridge.js`

### P2-061: Connect LMSR pricing in circuitBreaker.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/circuitBreaker.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/circuitBreaker.js`

### P2-062: Integrate Trading.sol with claims.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/claims.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/claims.js`

### P2-063: Resolve LMSR vs CLOB for collateral.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/collateral.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/collateral.js`

### P2-064: Index on-chain events from compression.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/compression.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/compression.js`

### P2-065: Sync market state via disputes.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/disputes.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/disputes.js`

### P2-066: Expose REST endpoint for escalation.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/escalation.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/escalation.js`

### P2-067: Map contract ABI to experiments.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/experiments.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/experiments.js`

### P2-068: Add WebSocket feed for exports.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/exports.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/exports.js`

### P2-069: Implement settlement hook in features.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/features.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/features.js`

### P2-070: Bridge frontend trade UI to freeze.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/freeze.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/freeze.js`

### P2-071: Add resolution pipeline in gas.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/gas.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/gas.js`

### P2-072: Deploy script update for governance.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/governance.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/governance.js`

### P2-073: Add Foundry test covering health.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/health.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/health.js`

### P2-074: Emit events from heartbeat.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/heartbeat.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/heartbeat.js`

### P2-075: Decode logs in imports.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/imports.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/imports.js`

### P2-076: Add market lifecycle state to insurance.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/insurance.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/insurance.js`

### P2-077: Connect AviationStack data to ipfs.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/ipfs.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/ipfs.js`

### P2-078: Wire position tracking in kyc.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/kyc.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/kyc.js`

### P2-079: Add order placement through legacy.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/legacy.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/legacy.js`

### P2-080: Wire MarketFactory to lending.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/lending.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/lending.js`

### P2-081: Connect LMSR pricing in marketAnalytics.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/marketAnalytics.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/marketAnalytics.js`

### P2-082: Integrate Trading.sol with migration.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/migration.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/migration.js`

### P2-083: Resolve LMSR vs CLOB for mining.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/mining.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/mining.js`

### P2-084: Index on-chain events from multisig.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/multisig.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/multisig.js`

### P2-085: Sync market state via oncall.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/oncall.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/oncall.js`

### P2-086: Expose REST endpoint for oracle.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/oracle.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/oracle.js`

### P2-087: Map contract ABI to pause.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/pause.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/pause.js`

### P2-088: Add WebSocket feed for permissions.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/permissions.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/permissions.js`

### P2-089: Implement settlement hook in referrals.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/referrals.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/referrals.js`

### P2-090: Bridge frontend trade UI to releases.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/releases.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/releases.js`

### P2-091: Add resolution pipeline in risk.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/risk.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/risk.js`

### P2-092: Deploy script update for rollback.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/rollback.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/rollback.js`

### P2-093: Add Foundry test covering runbooks.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/runbooks.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/runbooks.js`

### P2-094: Emit events from shutdown.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/shutdown.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/shutdown.js`

### P2-095: Decode logs in sla.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/sla.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/sla.js`

### P2-096: Add market lifecycle state to snapshots.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/snapshots.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/snapshots.js`

### P2-097: Connect AviationStack data to status.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/status.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/status.js`

### P2-098: Wire position tracking in swaps.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/swaps.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/swaps.js`

### P2-099: Add order placement through tradeReports.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/tradeReports.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/tradeReports.js`

### P2-100: Wire MarketFactory to trades.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/trades.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/trades.js`

### P2-101: Connect LMSR pricing in uptime.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/uptime.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/uptime.js`

### P2-102: Integrate Trading.sol with index.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/routes/v1/index.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/routes/v1/index.js`

### P2-103: Resolve LMSR vs CLOB for index.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/routes/v2/index.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/routes/v2/index.js`

### P2-104: Index on-chain events from voting.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/routes/voting.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/routes/voting.js`

### P2-105: Sync market state via whitelist.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/routes/whitelist.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/routes/whitelist.js`

### P2-106: Expose REST endpoint for yield.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/routes/yield.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/routes/yield.js`

### P2-107: Map contract ABI to deploy.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/scripts/deploy.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/scripts/deploy.js`

### P2-108: Add WebSocket feed for test.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/scripts/test.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/scripts/test.js`

### P2-109: Implement settlement hook in server.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/server.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/server.js`

### P2-110: Bridge frontend trade UI to abTesting.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/abTesting.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/abTesting.js`

### P2-111: Add resolution pipeline in alertRouting.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/alertRouting.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/alertRouting.js`

### P2-112: Deploy script update for amlService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/amlService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/amlService.js`

### P2-113: Add Foundry test covering analyticsService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/analyticsService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/analyticsService.js`

### P2-114: Emit events from approvalService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/approvalService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/approvalService.js`

### P2-115: Decode logs in arbitrageService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/arbitrageService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/arbitrageService.js`

### P2-116: Add market lifecycle state to auditTrail.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/auditTrail.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/auditTrail.js`

### P2-117: Connect AviationStack data to batchProcessor.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/batchProcessor.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/batchProcessor.js`

### P2-118: Wire position tracking in betaAccess.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/betaAccess.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/betaAccess.js`

### P2-119: Add order placement through blacklistService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/blacklistService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/blacklistService.js`

### P2-120: Wire MarketFactory to breakerService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/breakerService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/breakerService.js`

### P2-121: Connect LMSR pricing in bridgeService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/bridgeService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/bridgeService.js`

### P2-122: Integrate Trading.sol with claimService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/claimService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/claimService.js`

### P2-123: Resolve LMSR vs CLOB for collateralService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/collateralService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/collateralService.js`

### P2-124: Index on-chain events from complianceService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/complianceService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/complianceService.js`

### P2-125: Sync market state via compressionService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/compressionService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/compressionService.js`

### P2-126: Expose REST endpoint for ddosProtection.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/ddosProtection.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/ddosProtection.js`

### P2-127: Map contract ABI to deployService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/deployService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/deployService.js`

### P2-128: Add WebSocket feed for deprecationService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/deprecationService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/deprecationService.js`

### P2-129: Implement settlement hook in disputeService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/disputeService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/disputeService.js`

### P2-130: Bridge frontend trade UI to escalation.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/escalation.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/escalation.js`

### P2-131: Add resolution pipeline in exportService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/exportService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/exportService.js`

### P2-132: Deploy script update for featureFlagService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/featureFlagService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/featureFlagService.js`

### P2-133: Add Foundry test covering freezeService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/freezeService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/freezeService.js`

### P2-134: Emit events from gasOptimizer.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/gasOptimizer.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/gasOptimizer.js`

### P2-135: Decode logs in governanceService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/governanceService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/governanceService.js`

### P2-136: Add market lifecycle state to healthCheck.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/healthCheck.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/healthCheck.js`

### P2-137: Connect AviationStack data to heartbeat.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/heartbeat.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/heartbeat.js`

### P2-138: Wire position tracking in importService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/importService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/importService.js`

### P2-139: Add order placement through insuranceService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/insuranceService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/insuranceService.js`

### P2-140: Wire MarketFactory to ipfsService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/ipfsService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/ipfsService.js`

### P2-141: Connect LMSR pricing in kycService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/kycService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/kycService.js`

### P2-142: Integrate Trading.sol with lendingService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/lendingService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/lendingService.js`

### P2-143: Resolve LMSR vs CLOB for liquidationService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/liquidationService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/liquidationService.js`

### P2-144: Index on-chain events from marginEngine.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/marginEngine.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/marginEngine.js`

### P2-145: Sync market state via migrationService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/migrationService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/migrationService.js`

### P2-146: Expose REST endpoint for miningService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/miningService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/miningService.js`

### P2-147: Map contract ABI to multisigService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/multisigService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/multisigService.js`

### P2-148: Add WebSocket feed for oncallService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/oncallService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/oncallService.js`

### P2-149: Implement settlement hook in oracleService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/oracleService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/oracleService.js`

### P2-150: Bridge frontend trade UI to pagerduty.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/pagerduty.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/pagerduty.js`

### P2-151: Add resolution pipeline in pauseService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/pauseService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/pauseService.js`

### P2-152: Deploy script update for permissionService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/permissionService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/permissionService.js`

### P2-153: Add Foundry test covering referralService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/referralService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/referralService.js`

### P2-154: Emit events from releaseService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/releaseService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/releaseService.js`

### P2-155: Decode logs in riskService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/riskService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/riskService.js`

### P2-156: Add market lifecycle state to rollbackService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/rollbackService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/rollbackService.js`

### P2-157: Connect AviationStack data to runbookService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/runbookService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/runbookService.js`

### P2-158: Wire position tracking in sanityChecker.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/sanityChecker.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/sanityChecker.js`

### P2-159: Add order placement through schedulerService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/schedulerService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/schedulerService.js`

### P2-160: Wire MarketFactory to shutdownService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/shutdownService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/shutdownService.js`

### P2-161: Connect LMSR pricing in slaTracker.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/slaTracker.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/slaTracker.js`

### P2-162: Integrate Trading.sol with snapshotService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/snapshotService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/snapshotService.js`

### P2-163: Resolve LMSR vs CLOB for statusService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/statusService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/statusService.js`

### P2-164: Index on-chain events from swapService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/swapService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/swapService.js`

### P2-165: Sync market state via syncService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/syncService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/syncService.js`

### P2-166: Expose REST endpoint for throttleService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/throttleService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/throttleService.js`

### P2-167: Map contract ABI to timeService.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/timeService.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/timeService.js`

### P2-168: Add WebSocket feed for tradeAggregator.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/tradeAggregator.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/tradeAggregator.js`

### P2-169: Implement settlement hook in tradeEngine.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/tradeEngine.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/tradeEngine.js`

### P2-170: Bridge frontend trade UI to tradeReportService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/tradeReportService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/tradeReportService.js`

### P2-171: Add resolution pipeline in tradeValidator.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/tradeValidator.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/tradeValidator.js`

### P2-172: Deploy script update for upgradeCoordinator.js
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/services/upgradeCoordinator.js.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/services/upgradeCoordinator.js`

### P2-173: Add Foundry test covering uptimeService.js
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/services/uptimeService.js.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/services/uptimeService.js`

### P2-174: Emit events from votingService.js
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/services/votingService.js so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/services/votingService.js`

### P2-175: Decode logs in whitelistService.js
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/services/whitelistService.js is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/services/whitelistService.js`

### P2-176: Add market lifecycle state to yieldService.js
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/services/yieldService.js; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/services/yieldService.js`

### P2-177: Connect AviationStack data to ai.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/ai/ai.controller.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/ai/ai.controller.ts`

### P2-178: Wire position tracking in ai.module.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/ai/ai.module.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/ai/ai.module.ts`

### P2-179: Add order placement through ai.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/ai/ai.service.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/ai/ai.service.ts`

### P2-180: Wire MarketFactory to analysis.dto.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/ai/dto/analysis.dto.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/ai/dto/analysis.dto.ts`

### P2-181: Connect LMSR pricing in analytics.module.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/analytics/analytics.module.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/analytics/analytics.module.ts`

### P2-182: Integrate Trading.sol with volume-analytics.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/analytics/volume-analytics.controller.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/analytics/volume-analytics.controller.ts`

### P2-183: Resolve LMSR vs CLOB for volume-analytics.entity.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/analytics/volume-analytics.entity.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/analytics/volume-analytics.entity.ts`

### P2-184: Index on-chain events from volume-analytics.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/analytics/volume-analytics.service.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/analytics/volume-analytics.service.ts`

### P2-185: Sync market state via api-keys.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/api-keys/api-keys.controller.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/api-keys/api-keys.controller.ts`

### P2-186: Expose REST endpoint for api-keys.entity.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/api-keys/api-keys.entity.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/api-keys/api-keys.entity.ts`

### P2-187: Map contract ABI to api-keys.module.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/api-keys/api-keys.module.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/api-keys/api-keys.module.ts`

### P2-188: Add WebSocket feed for api-keys.service.spec.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/api-keys/api-keys.service.spec.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/api-keys/api-keys.service.spec.ts`

### P2-189: Implement settlement hook in api-keys.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/api-keys/api-keys.service.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/api-keys/api-keys.service.ts`

### P2-190: Bridge frontend trade UI to api-keys.dto.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/api-keys/dto/api-keys.dto.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/api-keys/dto/api-keys.dto.ts`

### P2-191: Add resolution pipeline in app.controller.spec.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/app.controller.spec.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/app.controller.spec.ts`

### P2-192: Deploy script update for app.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/app.controller.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/app.controller.ts`

### P2-193: Add Foundry test covering app.module.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/app.module.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/app.module.ts`

### P2-194: Emit events from app.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/app.service.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/app.service.ts`

### P2-195: Decode logs in approval.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/approval/approval.controller.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/approval/approval.controller.ts`

### P2-196: Add market lifecycle state to approval.entity.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/approval/approval.entity.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/approval/approval.entity.ts`

### P2-197: Connect AviationStack data to approval.module.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/approval/approval.module.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/approval/approval.module.ts`

### P2-198: Wire position tracking in approval.service.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/approval/approval.service.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/approval/approval.service.ts`

### P2-199: Add order placement through approval.dto.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/approval/dto/approval.dto.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/approval/dto/approval.dto.ts`

### P2-200: Wire MarketFactory to auth.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/auth/auth.controller.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/auth/auth.controller.ts`

### P2-201: Connect LMSR pricing in auth.module.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/auth/auth.module.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/auth/auth.module.ts`

### P2-202: Integrate Trading.sol with auth.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/auth/auth.service.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/auth/auth.service.ts`

### P2-203: Resolve LMSR vs CLOB for auth.dto.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/auth/dto/auth.dto.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P2-204: Index on-chain events from user.entity.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/auth/entities/user.entity.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P2-205: Sync market state via jwt-auth.guard.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/auth/guards/jwt-auth.guard.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P2-206: Expose REST endpoint for jwt.strategy.ts
**Labels:** `phase-2`, `backend`
**Description:** ADR 0001 (LMSR vs CLOB) affects Backend/src/auth/strategies/jwt.strategy.ts; implement the chosen model consistently across layers.
**Acceptance criteria:**
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P2-207: Map contract ABI to blockchain.controller.ts
**Labels:** `phase-2`, `backend`
**Description:** Market data must flow from contracts through Backend services to Frontend components via Backend/src/blockchain/blockchain.controller.ts.
**Acceptance criteria:**
- [ ] Foundry/integration test proves happy path
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
**Related:** `Backend/src/blockchain/blockchain.controller.ts`

### P2-208: Add WebSocket feed for blockchain.module.ts
**Labels:** `phase-2`, `backend`
**Description:** End-to-end trade: create market → place order → settle → resolve, touching Backend/src/blockchain/blockchain.module.ts.
**Acceptance criteria:**
- [ ] Event indexing or polling documented
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
**Related:** `Backend/src/blockchain/blockchain.module.ts`

### P2-209: Implement settlement hook in blockchain.service.ts
**Labels:** `phase-2`, `backend`
**Description:** Wire Backend/src/blockchain/blockchain.service.ts so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.
**Acceptance criteria:**
- [ ] Error states surfaced to UI
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
**Related:** `Backend/src/blockchain/blockchain.service.ts`

### P2-210: Bridge frontend trade UI to nonce.dto.ts
**Labels:** `phase-2`, `backend`
**Description:** Phase 2 connects on-chain markets to backend and frontend; Backend/src/blockchain/dto/nonce.dto.ts is part of the core trading path.
**Acceptance criteria:**
- [ ] On-chain action reflected in backend within acceptable latency
- [ ] Frontend displays live data instead of mocks where applicable
- [ ] Foundry/integration test proves happy path
**Related:** `Backend/src/blockchain/dto/nonce.dto.ts`
