# Phase 1: Stabilize foundations

> **Theme:** Stabilize foundations
> **Goal:** Docs, build/run reproducibility, unify Backend runtime paths, fix critical boot/blocker bugs, and establish contributor onboarding.

Parent index: [PHASES.md](PHASES.md)

## Local wallet + trade runbook

This section answers: **how do I run the wallet + trade flow locally?**

**Phase ownership:** The runbook is a Phase 2 documentation task (`phase-2`). It describes **Phase 1 surfaces** (app boot, NestJS API, Next.js shell, Particle wallet chrome) plus the **Phase 2 pieces you need for a local trade attempt** (Nest `trade-engine` HTTP API, LMSR `MarketMaker.buy` from the UI when a contract address is set). Live market wiring and the LMSR vs CLOB choice remain Phase 2 — see [PHASE_2.md](PHASE_2.md) and [PHASES.md](PHASES.md).

Full install notes: [CONTRIBUTING.md](CONTRIBUTING.md). Env source of truth: [`Backend/.env.example`](Backend/.env.example). Frontend has no `.env.example`; use the template in CONTRIBUTING.md.

### Prerequisites

| Tool | Used for |
|------|----------|
| [Node.js](https://nodejs.org/) 20+ (`Frontend/package.json` engines) | Backend and Frontend |
| [Foundry](https://getfoundry.sh/) (`forge`, `anvil`) | `Contracts/` build/test and optional local RPC |
| [Git](https://git-scm.com/) | clone |
| MongoDB | Backend persistence (`MONGODB_URI`) |
| Redis | queues / throttling / cache (`REDIS_URL` / `REDIS_HOST` / `REDIS_PORT`) |

There is no `docker-compose` in this repository. Start MongoDB and Redis yourself (local install or your own containers).

### Ports (from the repo, not guesses)

| Service | Port | Source |
|---------|------|--------|
| Frontend (Next.js) | **3000** | `next dev` default; `FRONTEND_URL` in [`Backend/.env.example`](Backend/.env.example) |
| Backend (NestJS) | **4000** | `PORT=4000` in [`Backend/.env.example`](Backend/.env.example) |
| Nest fallback | **3000** | `Backend/src/main.ts`: `process.env.PORT ?? 3000` if `.env` is missing |
| Heartbeat | **4001** | `HEARTBEAT_PORT=4001` in `.env.example` |
| MongoDB | **27017** | `MONGODB_URI=mongodb://127.0.0.1:27017/gatedelay` |
| Redis | **6379** | `REDIS_URL` / `REDIS_PORT` |
| Anvil / local RPC | **8545** | `RPC_URL=http://127.0.0.1:8545` |

If Backend and Frontend both try **3000**, set Backend `PORT` (copy `.env.example`) or run `npm run dev -- -p 3001` in `Frontend/`.

### Install

From the repository root after `git clone`.

```bash
cd Backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
```

Edit `Backend/.env` and replace placeholder secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `WEBHOOK_SECRET`, …). Keep `PORT=4000` unless you have a reason not to.

```bash
cd ../Frontend
npm install
```

Create `Frontend/.env.local` (not committed):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

NEXT_PUBLIC_PROJECT_ID=
NEXT_PUBLIC_CLIENT_KEY=
NEXT_PUBLIC_APP_ID=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

NEXT_PUBLIC_MARKET_MAKER_ADDRESS=
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
```

Use `http://localhost:3000` for `NEXT_PUBLIC_*` Backend URLs only if Nest is running with `PORT` unset.

Optional contracts (Phase 1 build check; not required to open the UI):

```bash
cd ../Contracts
forge build
forge test
```

### Startup order

1. MongoDB on `27017` and Redis on `6379`.
2. Optional: `anvil` from `Contracts/` if you need the `.env.example` RPC at `http://127.0.0.1:8545`.
3. Backend: `cd Backend && npm run start:dev`
4. Frontend: `cd Frontend && npm run dev`

Verify Backend: `GET http://localhost:4000/api` — Nest global prefix is `api` (`Backend/src/main.ts`); `AppController` serves that route. Swagger: `http://localhost:4000/api/docs`.

Verify Frontend: open `http://localhost:3000`. You should see the home page and the navbar (`Frontend/components/layout/Navigation.tsx`), not a blank screen.

Canonical Nest entry is `npm run start:dev`. Legacy Express is `npm run express:start` (`Backend/server.js`) — do not mix the two for this runbook.

### Wallet flow (Phase 1 UI)

1. Fill Particle ConnectKit values in `Frontend/.env.local` (`NEXT_PUBLIC_PROJECT_ID`, `NEXT_PUBLIC_CLIENT_KEY`, `NEXT_PUBLIC_APP_ID`) and restart `npm run dev`.
2. Click **Connect Wallet** in the navbar (`Frontend/app/components/WalletButton.tsx` → `Frontend/components/wallet/ConnectModal.tsx`).
3. Complete Particle ConnectKit (injected wallet, social, or WalletConnect as configured).

**Without Particle env vars** the shell still renders. Connect Wallet shows an empty-state message pointing at `Frontend/.env.local` / CONTRIBUTING.md. That is expected Phase 1 behavior, not a Phase 2 market bug.

**Check:** the button becomes a truncated address + Disconnect after a successful connect.

### Trade flow

Two different “trade” paths exist. Do not treat them as one pipeline.

**A. UI (mostly Phase 1 mock + optional LMSR call)**

1. Home (`Frontend/app/page.tsx`): sample markets link to `/markets/{id}`; **Quick trade** is `Frontend/components/trade/QuickTradeWidget.tsx`.
2. Market page: `/markets/1` (and other ids) — mock market data; `buy` on `NEXT_PUBLIC_MARKET_MAKER_ADDRESS` via wagmi when the wallet is connected.
3. Dedicated trade page: `/trade/market-1` (also `market-2`, `market-3`) — mock `TradingInterface`.

On-chain `MarketMaker.buy` only happens if ConnectKit/wagmi is mounted **and** `NEXT_PUBLIC_MARKET_MAKER_ADDRESS` is a real deployed address. Leaving it empty uses `0x000…0000` in the widget — transactions will not succeed. Deploying/wiring that contract is Phase 2 ([PHASE_2.md](PHASE_2.md)).

**B. Backend trade-engine (Phase 2 Nest module, needed for the HTTP order API)**

After register/login (MongoDB required):

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dev@localhost\",\"password\":\"password1\",\"name\":\"Dev\"}"

curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dev@localhost\",\"password\":\"password1\"}"
```

Place an order (`Backend/src/trade-engine/trade-engine.controller.ts`, JWT required). Login returns `{ accessToken, refreshToken, user }`. Auth users are **in-memory** (`Backend/src/auth/auth.service.ts`) — a Backend restart forgets them. **Orders** persist in MongoDB via `TradeEngineService`.

```bash
curl -s -X POST http://localhost:4000/api/trade-engine/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d "{\"pair\":\"YES-NO\",\"type\":\"Market\",\"side\":\"Buy\",\"amount\":\"1\"}"
```

`PlaceOrderDto` fields: `pair`, `type` (`Market` \| `Limit` \| `Stop-Loss`), `side` (`Buy` \| `Sell`), `amount`, optional `price` / `stopPrice`. List orders: `GET /api/trade-engine/orders`.

This HTTP engine is **not** the same as clicking Quick Trade. Phase 1 gets both processes running; Phase 2 wires them to live markets.

### What “success” looks like

- [ ] `GET http://localhost:4000/api` returns the Nest hello body
- [ ] `http://localhost:3000` shows navbar + home markets
- [ ] Connect Wallet either opens options (Particle configured) or the documented empty state
- [ ] `/markets/1` and `/trade/market-1` render (mock data is OK for Phase 1)
- [ ] Optional: login + `POST /api/trade-engine/orders` returns **201** when MongoDB and JWT secrets are valid

### Troubleshooting (only what this repo supports)

| Symptom | Likely cause |
|---------|----------------|
| Backend exits on Redis/Mongo | Start those services or fix `MONGODB_URI` / `REDIS_*` |
| `EADDRINUSE` on 3000 | Copy `.env.example` so Backend uses 4000, or move Frontend to 3001 |
| Wallet modal empty | Missing Particle keys in `.env.local` |
| Quick trade / market `buy` fails | No wallet provider, or `NEXT_PUBLIC_MARKET_MAKER_ADDRESS` still zero |
| `POST /api/trade-engine/orders` 401 | Missing/invalid JWT; register/login first |
| WebSocket `/test-websocket` never connects | Gateway requires JWT; see [Frontend/WEBSOCKET_QUICKSTART.md](Frontend/WEBSOCKET_QUICKSTART.md) |

---

## Issues (210 tracked)

Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).

### P1-001: Fix broken import in API_PROTECTION_README.md
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/API_PROTECTION_README.md must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/API_PROTECTION_README.md`

### P1-002: Unify Express/Nest path for COLLATERAL.md
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/COLLATERAL.md; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/COLLATERAL.md`

### P1-003: Add smoke test for DEPOSIT_SERVICE_DOCUMENTATION.md
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/DEPOSIT_SERVICE_DOCUMENTATION.md.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/DEPOSIT_SERVICE_DOCUMENTATION.md`

### P1-004: Validate env vars for DEPOSIT_SERVICE_README.md
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/DEPOSIT_SERVICE_README.md before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/DEPOSIT_SERVICE_README.md`

### P1-005: Remove dead code in IMPLEMENTATION.md
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/IMPLEMENTATION.md is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/IMPLEMENTATION.md`

### P1-006: Align README with LIQUIDATION.md
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/LIQUIDATION.md must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/LIQUIDATION.md`

### P1-007: Add health check for MARGIN.md
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/MARGIN.md; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/MARGIN.md`

### P1-008: Stabilize boot sequence of README.md
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/README.md.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/README.md`

### P1-009: Resolve TypeScript errors in RISK.md
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/RISK.md before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/RISK.md`

### P1-010: Add missing module export in TRADE_REPORTS.md
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/TRADE_REPORTS.md is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/TRADE_REPORTS.md`

### P1-011: Consolidate duplicate logic in TRADE_REPORTS_SETUP.md
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/TRADE_REPORTS_SETUP.md must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/TRADE_REPORTS_SETUP.md`

### P1-012: Add CONTRIBUTING note for UPTIME_MONITORING.md
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/UPTIME_MONITORING.md; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/UPTIME_MONITORING.md`

### P1-013: Fix lint violations in pagerduty.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/config/pagerduty.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/config/pagerduty.js`

### P1-014: Ensure package scripts cover rateLimits.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/config/rateLimits.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/config/rateLimits.js`

### P1-015: Add startup logging to eslint.config.mjs
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/eslint.config.mjs is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/eslint.config.mjs`

### P1-016: Verify dependency versions in heartbeatServer.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/heartbeatServer.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/heartbeatServer.js`

### P1-017: Add .env.example entry for arbitrageMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/jobs/arbitrageMonitor.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/jobs/arbitrageMonitor.js`

### P1-018: Fix path alias in batchExecutor.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/jobs/batchExecutor.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/jobs/batchExecutor.js`

### P1-019: Add basic integration test for complianceChecker.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/jobs/complianceChecker.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/jobs/complianceChecker.js`

### P1-020: Document setup for heartbeatMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/jobs/heartbeatMonitor.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/heartbeatMonitor.js`

### P1-021: Fix broken import in liquidationMonitor.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/jobs/liquidationMonitor.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/jobs/liquidationMonitor.js`

### P1-022: Unify Express/Nest path for sanityCheck.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/jobs/sanityCheck.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/jobs/sanityCheck.js`

### P1-023: Add smoke test for snapshotCapture.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/jobs/snapshotCapture.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/jobs/snapshotCapture.js`

### P1-024: Validate env vars for tradeExecutor.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/jobs/tradeExecutor.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/jobs/tradeExecutor.js`

### P1-025: Remove dead code in upgradeManager.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/jobs/upgradeManager.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/jobs/upgradeManager.js`

### P1-026: Align README with backwardCompat.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/middleware/backwardCompat.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/middleware/backwardCompat.js`

### P1-027: Add health check for ddosGuard.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/middleware/ddosGuard.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/middleware/ddosGuard.js`

### P1-028: Stabilize boot sequence of deprecation.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/middleware/deprecation.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/middleware/deprecation.js`

### P1-029: Resolve TypeScript errors in permissions.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/middleware/permissions.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/middleware/permissions.js`

### P1-030: Add missing module export in rateLimiter.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/middleware/rateLimiter.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/middleware/rateLimiter.js`

### P1-031: Consolidate duplicate logic in throttle.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/middleware/throttle.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/middleware/throttle.js`

### P1-032: Add CONTRIBUTING note for tradeValidation.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/middleware/tradeValidation.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/middleware/tradeValidation.js`

### P1-033: Fix lint violations in version.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/middleware/version.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/middleware/version.js`

### P1-034: Ensure package scripts cover 001_init_markets.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/migrations/001_init_markets.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/migrations/001_init_markets.js`

### P1-035: Add startup logging to AuditLog.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/models/AuditLog.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/models/AuditLog.js`

### P1-036: Verify dependency versions in Balance.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/models/Balance.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/models/Balance.js`

### P1-037: Add .env.example entry for Collateral.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/models/Collateral.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/models/Collateral.js`

### P1-038: Fix path alias in Dispute.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/models/Dispute.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/models/Dispute.js`

### P1-039: Add basic integration test for Liquidation.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/models/Liquidation.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/models/Liquidation.js`

### P1-040: Document setup for MarginAccount.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/models/MarginAccount.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/models/MarginAccount.js`

### P1-041: Fix broken import in MarginCall.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/models/MarginCall.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/models/MarginCall.js`

### P1-042: Unify Express/Nest path for MarketSnapshot.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/models/MarketSnapshot.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/models/MarketSnapshot.js`

### P1-043: Add smoke test for Notification.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/models/Notification.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/models/Notification.js`

### P1-044: Validate env vars for Order.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/models/Order.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/models/Order.js`

### P1-045: Remove dead code in PriceHistory.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/models/PriceHistory.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/models/PriceHistory.js`

### P1-046: Align README with Referral.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/models/Referral.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/models/Referral.js`

### P1-047: Add health check for RiskConfig.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/models/RiskConfig.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/models/RiskConfig.js`

### P1-048: Stabilize boot sequence of RiskScore.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/models/RiskScore.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/models/RiskScore.js`

### P1-049: Resolve TypeScript errors in TradeReport.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/models/TradeReport.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/models/TradeReport.js`

### P1-050: Add missing module export in nest-cli.json
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/nest-cli.json is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/nest-cli.json`

### P1-051: Consolidate duplicate logic in package-lock.json
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/package-lock.json must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/package-lock.json`

### P1-052: Add CONTRIBUTING note for package.json
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/package.json; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/package.json`

### P1-053: Fix lint violations in aggregatedTrades.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/aggregatedTrades.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/aggregatedTrades.js`

### P1-054: Ensure package scripts cover alerts.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/alerts.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/alerts.js`

### P1-055: Add startup logging to aml.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/aml.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/aml.js`

### P1-056: Verify dependency versions in api.example.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/api.example.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/api.example.js`

### P1-057: Add .env.example entry for approvals.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/approvals.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/approvals.js`

### P1-058: Fix path alias in beta.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/beta.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/beta.js`

### P1-059: Add basic integration test for blacklist.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/blacklist.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/blacklist.js`

### P1-060: Document setup for bridge.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/bridge.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/bridge.js`

### P1-061: Fix broken import in circuitBreaker.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/circuitBreaker.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/circuitBreaker.js`

### P1-062: Unify Express/Nest path for claims.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/claims.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/claims.js`

### P1-063: Add smoke test for collateral.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/collateral.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/collateral.js`

### P1-064: Validate env vars for compression.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/compression.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/compression.js`

### P1-065: Remove dead code in disputes.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/disputes.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/disputes.js`

### P1-066: Align README with escalation.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/escalation.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/escalation.js`

### P1-067: Add health check for experiments.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/experiments.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/experiments.js`

### P1-068: Stabilize boot sequence of exports.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/exports.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/exports.js`

### P1-069: Resolve TypeScript errors in features.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/features.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/features.js`

### P1-070: Add missing module export in freeze.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/freeze.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/freeze.js`

### P1-071: Consolidate duplicate logic in gas.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/gas.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/gas.js`

### P1-072: Add CONTRIBUTING note for governance.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/governance.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/governance.js`

### P1-073: Fix lint violations in health.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/health.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/health.js`

### P1-074: Ensure package scripts cover heartbeat.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/heartbeat.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/heartbeat.js`

### P1-075: Add startup logging to imports.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/imports.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/imports.js`

### P1-076: Verify dependency versions in insurance.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/insurance.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/insurance.js`

### P1-077: Add .env.example entry for ipfs.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/ipfs.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/ipfs.js`

### P1-078: Fix path alias in kyc.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/kyc.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/kyc.js`

### P1-079: Add basic integration test for legacy.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/legacy.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/legacy.js`

### P1-080: Document setup for lending.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/lending.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/lending.js`

### P1-081: Fix broken import in marketAnalytics.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/marketAnalytics.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/marketAnalytics.js`

### P1-082: Unify Express/Nest path for migration.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/migration.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/migration.js`

### P1-083: Add smoke test for mining.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/mining.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/mining.js`

### P1-084: Validate env vars for multisig.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/multisig.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/multisig.js`

### P1-085: Remove dead code in oncall.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/oncall.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/oncall.js`

### P1-086: Align README with oracle.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/oracle.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/oracle.js`

### P1-087: Add health check for pause.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/pause.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/pause.js`

### P1-088: Stabilize boot sequence of permissions.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/permissions.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/permissions.js`

### P1-089: Resolve TypeScript errors in referrals.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/referrals.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/referrals.js`

### P1-090: Add missing module export in releases.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/releases.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/releases.js`

### P1-091: Consolidate duplicate logic in risk.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/risk.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/risk.js`

### P1-092: Add CONTRIBUTING note for rollback.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/rollback.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/rollback.js`

### P1-093: Fix lint violations in runbooks.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/runbooks.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/runbooks.js`

### P1-094: Ensure package scripts cover shutdown.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/shutdown.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/shutdown.js`

### P1-095: Add startup logging to sla.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/sla.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/sla.js`

### P1-096: Verify dependency versions in snapshots.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/snapshots.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/snapshots.js`

### P1-097: Add .env.example entry for status.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/status.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/status.js`

### P1-098: Fix path alias in swaps.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/swaps.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/swaps.js`

### P1-099: Add basic integration test for tradeReports.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/tradeReports.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/tradeReports.js`

### P1-100: Document setup for trades.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/trades.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/trades.js`

### P1-101: Fix broken import in uptime.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/uptime.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/uptime.js`

### P1-102: Unify Express/Nest path for index.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/routes/v1/index.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/routes/v1/index.js`

### P1-103: Add smoke test for index.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/routes/v2/index.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/routes/v2/index.js`

### P1-104: Validate env vars for voting.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/routes/voting.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/routes/voting.js`

### P1-105: Remove dead code in whitelist.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/routes/whitelist.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/routes/whitelist.js`

### P1-106: Align README with yield.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/routes/yield.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/routes/yield.js`

### P1-107: Add health check for deploy.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/scripts/deploy.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/scripts/deploy.js`

### P1-108: Stabilize boot sequence of test.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/scripts/test.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/scripts/test.js`

### P1-109: Resolve TypeScript errors in server.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/server.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/server.js`

### P1-110: Add missing module export in abTesting.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/abTesting.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/abTesting.js`

### P1-111: Consolidate duplicate logic in alertRouting.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/alertRouting.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/alertRouting.js`

### P1-112: Add CONTRIBUTING note for amlService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/amlService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/amlService.js`

### P1-113: Fix lint violations in analyticsService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/analyticsService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/analyticsService.js`

### P1-114: Ensure package scripts cover approvalService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/approvalService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/approvalService.js`

### P1-115: Add startup logging to arbitrageService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/arbitrageService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/arbitrageService.js`

### P1-116: Verify dependency versions in auditTrail.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/auditTrail.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/auditTrail.js`

### P1-117: Add .env.example entry for batchProcessor.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/batchProcessor.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/batchProcessor.js`

### P1-118: Fix path alias in betaAccess.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/betaAccess.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/betaAccess.js`

### P1-119: Add basic integration test for blacklistService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/blacklistService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/blacklistService.js`

### P1-120: Document setup for breakerService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/breakerService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/breakerService.js`

### P1-121: Fix broken import in bridgeService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/bridgeService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/bridgeService.js`

### P1-122: Unify Express/Nest path for claimService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/claimService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/claimService.js`

### P1-123: Add smoke test for collateralService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/collateralService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/collateralService.js`

### P1-124: Validate env vars for complianceService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/complianceService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/complianceService.js`

### P1-125: Remove dead code in compressionService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/compressionService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/compressionService.js`

### P1-126: Align README with ddosProtection.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/ddosProtection.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/ddosProtection.js`

### P1-127: Add health check for deployService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/deployService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/deployService.js`

### P1-128: Stabilize boot sequence of deprecationService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/deprecationService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/deprecationService.js`

### P1-129: Resolve TypeScript errors in disputeService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/disputeService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/disputeService.js`

### P1-130: Add missing module export in escalation.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/escalation.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/escalation.js`

### P1-131: Consolidate duplicate logic in exportService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/exportService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/exportService.js`

### P1-132: Add CONTRIBUTING note for featureFlagService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/featureFlagService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/featureFlagService.js`

### P1-133: Fix lint violations in freezeService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/freezeService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/freezeService.js`

### P1-134: Ensure package scripts cover gasOptimizer.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/gasOptimizer.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/gasOptimizer.js`

### P1-135: Add startup logging to governanceService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/governanceService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/governanceService.js`

### P1-136: Verify dependency versions in healthCheck.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/healthCheck.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/healthCheck.js`

### P1-137: Add .env.example entry for heartbeat.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/heartbeat.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/heartbeat.js`

### P1-138: Fix path alias in importService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/importService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/importService.js`

### P1-139: Add basic integration test for insuranceService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/insuranceService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/insuranceService.js`

### P1-140: Document setup for ipfsService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/ipfsService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/ipfsService.js`

### P1-141: Fix broken import in kycService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/kycService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/kycService.js`

### P1-142: Unify Express/Nest path for lendingService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/lendingService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/lendingService.js`

### P1-143: Add smoke test for liquidationService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/liquidationService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/liquidationService.js`

### P1-144: Validate env vars for marginEngine.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/marginEngine.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/marginEngine.js`

### P1-145: Remove dead code in migrationService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/migrationService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/migrationService.js`

### P1-146: Align README with miningService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/miningService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/miningService.js`

### P1-147: Add health check for multisigService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/multisigService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/multisigService.js`

### P1-148: Stabilize boot sequence of oncallService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/oncallService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/oncallService.js`

### P1-149: Resolve TypeScript errors in oracleService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/oracleService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/oracleService.js`

### P1-150: Add missing module export in pagerduty.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/pagerduty.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/pagerduty.js`

### P1-151: Consolidate duplicate logic in pauseService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/pauseService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/pauseService.js`

### P1-152: Add CONTRIBUTING note for permissionService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/permissionService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/permissionService.js`

### P1-153: Fix lint violations in referralService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/referralService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/referralService.js`

### P1-154: Ensure package scripts cover releaseService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/releaseService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/releaseService.js`

### P1-155: Add startup logging to riskService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/riskService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/riskService.js`

### P1-156: Verify dependency versions in rollbackService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/rollbackService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/rollbackService.js`

### P1-157: Add .env.example entry for runbookService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/runbookService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/runbookService.js`

### P1-158: Fix path alias in sanityChecker.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/sanityChecker.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/sanityChecker.js`

### P1-159: Add basic integration test for schedulerService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/schedulerService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/schedulerService.js`

### P1-160: Document setup for shutdownService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/shutdownService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/shutdownService.js`

### P1-161: Fix broken import in slaTracker.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/slaTracker.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/slaTracker.js`

### P1-162: Unify Express/Nest path for snapshotService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/snapshotService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/snapshotService.js`

### P1-163: Add smoke test for statusService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/statusService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/statusService.js`

### P1-164: Validate env vars for swapService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/swapService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/swapService.js`

### P1-165: Remove dead code in syncService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/syncService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/syncService.js`

### P1-166: Align README with throttleService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/throttleService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/throttleService.js`

### P1-167: Add health check for timeService.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/timeService.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/timeService.js`

### P1-168: Stabilize boot sequence of tradeAggregator.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/tradeAggregator.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/tradeAggregator.js`

### P1-169: Resolve TypeScript errors in tradeEngine.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/tradeEngine.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/tradeEngine.js`

### P1-170: Add missing module export in tradeReportService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/tradeReportService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/tradeReportService.js`

### P1-171: Consolidate duplicate logic in tradeValidator.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/tradeValidator.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/tradeValidator.js`

### P1-172: Add CONTRIBUTING note for upgradeCoordinator.js
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/services/upgradeCoordinator.js; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/services/upgradeCoordinator.js`

### P1-173: Fix lint violations in uptimeService.js
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/services/uptimeService.js.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/services/uptimeService.js`

### P1-174: Ensure package scripts cover votingService.js
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/services/votingService.js before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/services/votingService.js`

### P1-175: Add startup logging to whitelistService.js
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/services/whitelistService.js is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/services/whitelistService.js`

### P1-176: Verify dependency versions in yieldService.js
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/services/yieldService.js must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/services/yieldService.js`

### P1-177: Add .env.example entry for ai.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/ai/ai.controller.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/ai/ai.controller.ts`

### P1-178: Fix path alias in ai.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/ai/ai.module.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/ai/ai.module.ts`

### P1-179: Add basic integration test for ai.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/ai/ai.service.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/ai/ai.service.ts`

### P1-180: Document setup for analysis.dto.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/ai/dto/analysis.dto.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/ai/dto/analysis.dto.ts`

### P1-181: Fix broken import in analytics.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/analytics/analytics.module.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/analytics/analytics.module.ts`

### P1-182: Unify Express/Nest path for volume-analytics.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/analytics/volume-analytics.controller.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/analytics/volume-analytics.controller.ts`

### P1-183: Add smoke test for volume-analytics.entity.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/analytics/volume-analytics.entity.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/analytics/volume-analytics.entity.ts`

### P1-184: Validate env vars for volume-analytics.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/analytics/volume-analytics.service.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/analytics/volume-analytics.service.ts`

### P1-185: Remove dead code in api-keys.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/api-keys/api-keys.controller.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/api-keys/api-keys.controller.ts`

### P1-186: Align README with api-keys.entity.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/api-keys/api-keys.entity.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/api-keys/api-keys.entity.ts`

### P1-187: Add health check for api-keys.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/api-keys/api-keys.module.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/api-keys/api-keys.module.ts`

### P1-188: Stabilize boot sequence of api-keys.service.spec.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/api-keys/api-keys.service.spec.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/api-keys/api-keys.service.spec.ts`

### P1-189: Resolve TypeScript errors in api-keys.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/api-keys/api-keys.service.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/api-keys/api-keys.service.ts`

### P1-190: Add missing module export in api-keys.dto.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/api-keys/dto/api-keys.dto.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/api-keys/dto/api-keys.dto.ts`

### P1-191: Consolidate duplicate logic in app.controller.spec.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/app.controller.spec.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/app.controller.spec.ts`

### P1-192: Add CONTRIBUTING note for app.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/app.controller.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/app.controller.ts`

### P1-193: Fix lint violations in app.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/app.module.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/app.module.ts`

### P1-194: Ensure package scripts cover app.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/app.service.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/app.service.ts`

### P1-195: Add startup logging to approval.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/approval/approval.controller.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/approval/approval.controller.ts`

### P1-196: Verify dependency versions in approval.entity.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/approval/approval.entity.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/approval/approval.entity.ts`

### P1-197: Add .env.example entry for approval.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/approval/approval.module.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/approval/approval.module.ts`

### P1-198: Fix path alias in approval.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/approval/approval.service.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/approval/approval.service.ts`

### P1-199: Add basic integration test for approval.dto.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/approval/dto/approval.dto.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/approval/dto/approval.dto.ts`

### P1-200: Document setup for auth.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/auth/auth.controller.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/auth/auth.controller.ts`

### P1-201: Fix broken import in auth.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/auth/auth.module.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/auth/auth.module.ts`

### P1-202: Unify Express/Nest path for auth.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/auth/auth.service.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/auth/auth.service.ts`

### P1-203: Add smoke test for auth.dto.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/auth/dto/auth.dto.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/auth/dto/auth.dto.ts`

### P1-204: Validate env vars for user.entity.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/auth/entities/user.entity.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/auth/entities/user.entity.ts`

### P1-205: Remove dead code in jwt-auth.guard.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/auth/guards/jwt-auth.guard.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/auth/guards/jwt-auth.guard.ts`

### P1-206: Align README with jwt.strategy.ts
**Labels:** `phase-1`, `backend`
**Description:** Phase 1 stabilizes the repo; Backend/src/auth/strategies/jwt.strategy.ts must be verified against the canonical build/run path described in README.
**Acceptance criteria:**
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
**Related:** `Backend/src/auth/strategies/jwt.strategy.ts`

### P1-207: Add health check for blockchain.controller.ts
**Labels:** `phase-1`, `backend`
**Description:** Contributors report friction around Backend/src/blockchain/blockchain.controller.ts; reduce setup time and eliminate silent failures on first run.
**Acceptance criteria:**
- [ ] No critical console errors on boot
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
**Related:** `Backend/src/blockchain/blockchain.controller.ts`

### P1-208: Stabilize boot sequence of blockchain.module.ts
**Labels:** `phase-1`, `backend`
**Description:** Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching Backend/src/blockchain/blockchain.module.ts.
**Acceptance criteria:**
- [ ] npm/forge scripts succeed for this area
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
**Related:** `Backend/src/blockchain/blockchain.module.ts`

### P1-209: Resolve TypeScript errors in blockchain.service.ts
**Labels:** `phase-1`, `backend`
**Description:** Add minimal verification so CI can detect regressions in Backend/src/blockchain/blockchain.service.ts before Phase 2 market wiring begins.
**Acceptance criteria:**
- [ ] Change is covered by at least a smoke test or manual checklist item
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
**Related:** `Backend/src/blockchain/blockchain.service.ts`

### P1-210: Add missing module export in nonce.dto.ts
**Labels:** `phase-1`, `backend`
**Description:** Foundations work: ensure Backend/src/blockchain/dto/nonce.dto.ts is documented, buildable, and free of critical boot errors blocking local development.
**Acceptance criteria:**
- [ ] Local dev server starts without errors involving this path
- [ ] README or inline docs reference this path accurately
- [ ] No critical console errors on boot
**Related:** `Backend/src/blockchain/dto/nonce.dto.ts`
