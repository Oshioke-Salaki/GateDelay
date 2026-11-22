# ADR 0001: LMSR vs CLOB / OrderBook ownership

- **Status:** Accepted
- **Date:** 2026-09-26
- **Issue:** P1-020 / #580

## Context

GateDelay needs a single, coherent on-chain trading model for flight-delay prediction markets. The repository currently contains **two independent mechanisms** that are not wired together:

| Component | Path | Role today |
|-----------|------|------------|
| `LMSR` | `Contracts/src/LMSR.sol` | Pure math library (cost, spot price) using WAD fixed-point `exp`/`ln` |
| `MarketMaker` | `Contracts/src/MarketMaker.sol` | Prediction-market contract that holds outcome quantities and uses `LMSR` for buy/sell pricing and redemption |
| `Trading` | `Contracts/src/Trading.sol` | Fee/rebate wrapper around `MarketMaker.buy` / `MarketMaker.sell` (LMSR path) |
| `OrderBook` | `Contracts/src/OrderBook.sol` | Standalone central limit order book (CLOB) for a generic base/quote ERC-20 pair |

`MarketMaker` → `Trading` is the **intended prediction-market stack** today: traders buy and sell outcome shares priced by LMSR, with optional fees on the buy path.

`OrderBook` is a **separate experiment**: limit/market orders, price levels, and maker/taker matching. It does **not** import or call `MarketMaker`, `Trading`, or `LMSR`. There is no factory or deployment script that connects an `OrderBook` instance to a GateDelay market.

Documentation and UI elsewhere sometimes refer to “hybrid AMM” or order matching without clarifying which path is authoritative.

## Decision

**LMSR via `MarketMaker` is the canonical execution model for GateDelay
prediction-market trades.** Outcome shares are bought and sold against the
market's collateral pool at LMSR-derived prices. `Trading` is not the canonical
settlement boundary until its sell quote/proceeds logic is corrected and
audited; integrations must not route sells through its current
`executeSell` implementation.

`OrderBook` is a separate, optional CLOB venue for explicitly configured
generic base/quote token pairs. It is not an alternative execution path for a
GateDelay prediction market. It has no shared outcome positions, market IDs,
pricing, resolution, or settlement with `MarketMaker`. A market must never
silently switch between LMSR and CLOB, and there is no hybrid LMSR-quote/CLOB-
fill behavior.

This closes the model-selection gate in [PHASE_2.md](../reports/PHASE_2.md).
End-to-end implementation remains tracked work; accepting the model does not
mean the backend or frontend is already wired to it.

## Current intended usage (as implemented)

### Canonical prediction-market flow: LMSR

- Create markets via `MarketMaker.createMarket(description, numOutcomes, b)`.
- Quote prices with `MarketMaker.getPrice` / `getCostToBuy` (delegates to `LMSR.price` / `LMSR.cost`).
- Execute buys and sells against the configured market's `MarketMaker.buy` / `sell`; the trader's wallet signs the state-changing transaction. `MarketMaker` owns positions and collateral settlement.
- Backend services may provide market metadata, read-only quotes, transaction status, and indexed contract events. They must not independently match, settle, or represent an off-chain order as a successful on-chain trade.
- Frontend trade controls must identify the LMSR market/outcome, show the contract quote and transaction state, and submit only the corresponding wallet transaction. Missing configuration or a failed/unavailable contract must fail closed with an unavailable/error state, never fall back to CLOB or demo values as executable prices.
- Resolve and redeem through `MarketMaker.resolve` / `redeem`.

`Trading.executeBuy` may only be introduced as an explicit fee-wrapped buy route
after its deployment and fee policy are configured. Do not use
`Trading.executeSell` for canonical sells until its proceeds calculation is
fixed and tested against `MarketMaker.sell`.

### Separate CLOB flow

- Deploy with two ERC-20 addresses (`token0` base, `token1` quote).
- Place limit/market orders via `placeLimitOrder` / `placeMarketOrder`.
- Route only an explicitly identified CLOB venue/pair through this contract. Its orders and fills must be labeled as CLOB activity and must not mutate or imply prediction-market outcome positions.
- Backend CLOB matching services and CLOB UI are separate from the LMSR route; do not forward prediction-market order submissions to them.

### Current integration status

- The Nest `trade-engine` persists and matches off-chain orders; `order-matcher` is in-memory. Neither is an LMSR adapter or proof of on-chain settlement. Keep them out of the canonical prediction-market execution path until replaced or explicitly scoped to a separate CLOB venue.
- Frontend `/trade/[id]` currently uses a local demo market catalog and fixture order book. Its submit handler shows a local toast; it makes no backend or contract call. It is not a live LMSR or CLOB integration.
- Contract addresses, chain configuration, transaction submission, and event indexing must be explicitly wired before presenting the core trading flow as live.

## Known ambiguity / gaps

- **Dual models in one repo** have no bridge contract or shared market ID space; this is an intentional separation, not a hybrid.
- **`Trading.executeSell`** uses `getCostToBuy` as a proceeds proxy (documented in-contract); sell-side fee logic is intentionally skipped and the wrapper is excluded from canonical sells until fixed.
- **Backend and frontend execution wiring remains incomplete.** Existing off-chain CLOB services and UI fixtures must not be presented as live LMSR trades.
- Remove or qualify legacy “Hybrid AMM” claims unless a concrete, separately reviewed integration is implemented.

## Consequences

- New core prediction-market integrations must follow LMSR ownership and the routing rules above.
- Phase 2 implements the accepted LMSR flow end-to-end and keeps CLOB paths explicitly separate or disabled for prediction markets.
- Tests: `Contracts/test/LMSR.t.sol`, `MarketMaker.t.sol`, `Trading.t.sol` cover the LMSR path; `Contracts/test/OrderBook.t.sol` covers CLOB in isolation.

## References

- `Contracts/src/LMSR.sol`
- `Contracts/src/MarketMaker.sol`
- `Contracts/src/Trading.sol`
- `Contracts/src/OrderBook.sol`
- [PHASES.md](../reports/PHASES.md) — project phase index
- [PHASE_2.md](../reports/PHASE_2.md) — Phase 2 implements the accepted LMSR model (`phase-2`)
