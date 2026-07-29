# ADR 0001: LMSR vs CLOB / OrderBook ambiguity

- **Status:** Proposed (decision deferred to Phase 2)
- **Date:** 2026-07-29
- **Issue:** P1-020 / #580

## Context

GateDelay needs a single, coherent on-chain trading model for flight-delay prediction markets. The repository currently contains **two independent mechanisms** that are not wired together:

| Component | Path | Role today |
|-----------|------|------------|
| `LMSR` | `Contracts/src/LMSR.sol` | Pure math library (cost, spot price) using WAD fixed-point `exp`/`ln` |
| `MarketMaker` | `Contracts/src/MarketMaker.sol` | Prediction-market contract that holds outcome quantities and uses `LMSR` for buy/sell pricing and redemption |
| `Trading` | `Contracts/src/Trading.sol` | Fee/rebate wrapper around `MarketMaker.buy` / `MarketMaker.sell` (LMSR path) |
| `OrderBook` | `Contracts/contracts/OrderBook.sol` | Standalone central limit order book (CLOB) for a generic base/quote ERC-20 pair |

`MarketMaker` → `Trading` is the **intended prediction-market stack** today: traders buy and sell outcome shares priced by LMSR, with optional fees on the buy path.

`OrderBook` is a **separate experiment**: limit/market orders, price levels, and maker/taker matching. It does **not** import or call `MarketMaker`, `Trading`, or `LMSR`. There is no factory or deployment script that connects an `OrderBook` instance to a GateDelay market.

Documentation and UI elsewhere sometimes refer to “hybrid AMM” or order matching without clarifying which path is authoritative.

## Decision

**Defer the architecture choice to Phase 2** (core market wiring — issues P2-016 “Order matcher vs LMSR decision gate” and P2-060 “Disable or sync OrderBook with LMSR decision” in the phase backlog).

Until Phase 2 closes that gate:

1. Treat **`MarketMaker` + `Trading` + `LMSR` as the canonical prediction-market trading path** for new integration work (backend trade-engine, frontend trade widgets, deployment).
2. Treat **`OrderBook` as isolated contract code** — useful for CLOB experiments and Forge tests, but not part of the live market lifecycle.
3. Do **not** assume hybrid behaviour (e.g. LMSR quotes backed by an order book) exists in the codebase; it does not.

## Current intended usage (as implemented)

### LMSR stack

- Create markets via `MarketMaker.createMarket(description, numOutcomes, b)`.
- Quote prices with `MarketMaker.getPrice` / `getCostToBuy` (delegates to `LMSR.price` / `LMSR.cost`).
- Trade via `MarketMaker.buy` / `sell` or the `Trading` wrapper for fee/rebate handling.
- Resolve and redeem through `MarketMaker.resolve` / `redeem`.

### OrderBook (standalone)

- Deploy with two ERC-20 addresses (`token0` base, `token1` quote).
- Place limit/market orders via `placeLimitOrder` / `placeMarketOrder`.
- No shared state with `MarketMaker` markets or outcome shares.

## Known ambiguity / gaps

- **Dual models in one repo** with no bridge contract or shared market ID space.
- **`Trading.executeSell`** uses `getCostToBuy` as a proceeds proxy (documented in-contract); sell-side fee logic is intentionally skipped.
- **Frontend / backend** may expose order-book or matcher concepts while on-chain wiring still targets LMSR — Phase 2 must align or disable conflicting surfaces.
- **README** describes “Hybrid AMM”; only the LMSR side is integrated end-to-end today.

## Consequences

- Phase 1 work should document this split (this ADR) and avoid inventing CLOB+LMSR behaviour in new code.
- Phase 2 must pick one primary model (or define an explicit hybrid with concrete integration points) and remove or gate the other from product paths.
- Tests: `Contracts/test/LMSR.t.sol`, `MarketMaker.t.sol`, `Trading.t.sol` cover the LMSR path; `Contracts/test/OrderBook.t.sol` covers CLOB in isolation.

## References

- `Contracts/src/LMSR.sol`
- `Contracts/src/MarketMaker.sol`
- `Contracts/src/Trading.sol`
- `Contracts/contracts/OrderBook.sol`
- [PHASES.md](../../PHASES.md) — project phase status
