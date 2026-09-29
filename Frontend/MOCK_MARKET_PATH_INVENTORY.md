# Frontend Mock Market Path Inventory

This inventory tracks pages and components that still depend on `Frontend/data/mockMarkets.ts` or otherwise synthesize market data locally instead of using API or on-chain sources.

## Direct `mockMarkets.ts` call sites

### 1. `pages/arbitrage-demo.tsx`
- Status: mock-only
- Source: direct import from `../data/mockMarkets`
- Current behavior: mounts `ArbitrageDisplay` with static sample markets
- Breakage risk: low for production because this is a demo route, but it is still hard-wired to sample data
- Phase 2 priority: P3
- Recommended wiring: load local-dev markets from a dedicated dev API endpoint or generated deployment artifact rather than editing `mockMarkets.ts`

## Adjacent mock-only market paths

These paths do not import `mockMarkets.ts` directly, but they still fabricate market data in the UI and should be tracked with the same follow-up workstream.

### 2. `app/favorites/page.tsx`
- Status: mock-only user-facing route
- Source: generates market cards from local storage IDs and random values
- Current behavior: favorites render synthetic titles, prices, liquidity, and volume instead of fetching the saved markets
- Breakage risk: high because `/favorites` looks like a real product surface
- Phase 2 priority: P1
- Recommended wiring: fetch favorited market IDs from the backend or chain indexer, then hydrate card details from the canonical market API

### 3. `components/trade/SimulationMode.tsx`
- Status: inline mock market selector
- Source: local object literal with three hard-coded prediction markets
- Current behavior: simulation mode always swaps between fake market titles and fixed YES/NO prices
- Breakage risk: medium because the component is explicitly a simulator, but the picker is disconnected from live markets
- Phase 2 priority: P2
- Recommended wiring: seed the simulator from fetched markets, then layer simulated execution on top of live metadata

## Dev-only helpers that reinforce the mock path

### 4. `localnet/scripts/deploy.js`
- Status: developer helper
- Source: prints JSON intended to be pasted into `Frontend/data/mockMarkets.ts`
- Current behavior: localnet deploy flow depends on manual copy/paste into the mock dataset
- Breakage risk: medium for contributors because it encourages drift between local deployments and UI data
- Phase 2 priority: P2
- Recommended wiring: emit a generated artifact such as `markets.local.json` and load it automatically in dev mode

### 5. `ARBITRAGE_DEMO.md`
- Status: documentation-only
- Source: instructs contributors to copy deploy output into `Frontend/data/mockMarkets.ts`
- Current behavior: reinforces manual mock wiring for the demo path
- Breakage risk: low, but it documents an approach we should phase out
- Phase 2 priority: P3
- Recommended wiring: update the guide once the demo reads from a generated localnet artifact or API route

## Summary

- Direct `mockMarkets.ts` imports found: 1 production code path (`pages/arbitrage-demo.tsx`)
- Additional market flows still using fabricated data: 2 (`app/favorites/page.tsx`, `components/trade/SimulationMode.tsx`)
- Dev/docs helpers still tied to `mockMarkets.ts`: 2 (`localnet/scripts/deploy.js`, `ARBITRAGE_DEMO.md`)

## Phase 2 priority order

1. Replace synthetic data in `app/favorites/page.tsx`
2. Replace manual localnet copy/paste in `localnet/scripts/deploy.js`
3. Feed `components/trade/SimulationMode.tsx` from fetched market metadata
4. Move `pages/arbitrage-demo.tsx` off static imports
5. Update `ARBITRAGE_DEMO.md` to match the new source of truth
