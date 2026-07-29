# GateDelay — Phase status

High-level sequencing for collaborators.

## Current snapshot

| Area | Status |
|------|--------|
| **Trading model** | **Ambiguous** — LMSR (`MarketMaker` / `Trading`) and CLOB (`OrderBook`) both exist; see [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md). **Phase 2 decides.** |
| Backends | NestJS modules under `Backend/src/` plus legacy Express `Backend/server.js` — single runtime path still being unified (Phase 1) |
| Frontend | Next.js app under `Frontend/`; some market/trade UI still mock-driven |
| Contracts | Foundry project under `Contracts/` |

## Phase map

| Phase | Theme |
|-------|--------|
| 1 | Stabilize foundations — docs, build/run, critical broken paths |
| 2 | Core market wiring — Factory / MarketMaker / LMSR / trading / resolution end-to-end |
| 3 | Product surface complete |
| 4 | Hardening — security, tests, rate limits, monitoring |
| 5 | Deployment and shipping |

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

## Architecture decisions

| ADR | Title | Status |
|-----|-------|--------|
| [0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) | LMSR vs CLOB / OrderBook ambiguity | Proposed — decision deferred to Phase 2 |
