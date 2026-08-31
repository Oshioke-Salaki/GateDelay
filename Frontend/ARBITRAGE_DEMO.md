# Arbitrage demo

A standalone page that mounts [`ArbitrageDisplay`](components/arbitrage/ArbitrageDisplay.tsx)
with the sample data in [`data/mockMarkets.ts`](data/mockMarkets.ts). It scans
every pair of same-asset markets, lists the profitable ones, and lets you run a
(mock or on-chain) execution.

- **Route:** `/arbitrage-demo` — also linked from the app navbar as **Arbitrage**
  (`components/layout/Navigation.tsx`).
- **Source:** `pages/arbitrage-demo.tsx`
- **Component:** `components/arbitrage/ArbitrageDisplay.tsx`
- **Executor:** `components/arbitrage/WagmiArbitrageExecutor.tsx`

## How it fits the app shell

This page lives under **`pages/`**, not **`app/`**, so it is served by the Next.js
Pages Router and **does not go through `app/layout.tsx`**. That means:

| App-shell feature (see [README.md](README.md#app-shell-and-websocket-quickstart)) | On `/arbitrage-demo`? |
|---|---|
| `PageErrorBoundary` | ❌ — a render error here shows Next's default error overlay |
| `ParticleClientWrapper` / wallet provider | ❌ — no wallet context is mounted |
| `WebSocketProvider` (`/prices`) | ❌ |
| `Navbar` | ❌ (you navigate *to* it from the navbar, but it renders without one) |

`ArbitrageDisplay` on its own needs **no wallet and no backend** — it is pure
computation over the markets prop. Only `WagmiArbitrageExecutor` needs wagmi
context (its `onExecute` throws `No signer available` without a connected
wallet); render it inside the app shell or under your own wagmi provider, not on
this bare demo page.

## Quick start

```bash
cd Frontend
npm run dev            # http://localhost:3000/arbitrage-demo
```

The backend is **optional**. `ArbitrageDisplay` tries `GET /api/markets` once on
mount and silently keeps the bundled mock markets if that call fails, so the demo
works fully offline.

## How contract events map to the UI

`WagmiArbitrageExecutor` turns an opportunity into two transactions and reflects
their outcome in the single **`Status:`** line rendered by `ArbitrageDisplay`:

| Step | On-chain action | UI |
|---|---|---|
| Click **Execute** | — | `Status: executing`, button disabled |
| 1. Approve | ERC20 `approve(router, amount)` | still `executing` |
| 2. Swap | UniswapV2-style `swapExactTokensForTokens` | — |
| Both mined | receipts returned | `Status: success` (clears after ~1.5s) |
| Any tx reverts / user rejects | error thrown | `Status: failed` (clears after ~2s) |

Chain-dependent behaviour of the executor:

- **Local dev chain** (`chainId` 31337 / 1337 / 1338): real `approve` + `swap`.
- **Any other chain:** execution is **simulated** and a placeholder tx hash is
  returned — nothing is broadcast.
- Opportunity/market objects must carry `tokenAddress` and `routerAddress`
  (the mock markets include placeholders); without them the executor prompts for
  them and, if still missing, the Execute action throws.

## Happy-path checklist (manual)

1. `cd Frontend && npm run dev` starts without errors.
2. Open `http://localhost:3000/arbitrage-demo` — the page renders (no blank
   screen), heading **Arbitrage Opportunities**.
3. **Markets scanned: 4** is shown.
4. At least one opportunity row is listed (the ETH pair) with a profit figure and
   an **Execute** button.
5. Change **Amount** / **Gas cost** / **Fee % override** / **Min profit** — the
   table re-computes live.
6. Click **Execute** on a row → `Status: executing` → `Status: success` (mock
   execution; no wallet needed).
7. From `http://localhost:3000`, the navbar **Arbitrage** link routes here.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page / Next error overlay | This page has no error boundary. Read the overlay; common cause is an import path change in `ArbitrageDisplay`/`mockMarkets`. |
| "No profitable opportunities found." | Expected when the spread between two same-asset markets does not beat their combined `feePercent`. Lower a `feePercent` or widen a `price` in `data/mockMarkets.ts`, or set **Fee % override** low for markets that have no `feePercent`. |
| Execute button throws | The opportunity is missing `tokenAddress` / `routerAddress`, or you are on a non-local chain expecting a real swap. On non-local chains the executor simulates instead. |
| `GET /api/markets` 404 in console | Harmless — the backend is optional; the demo falls back to mock markets. |

## Tests

`components/arbitrage/ArbitrageDisplay.test.tsx` (Vitest) covers the happy path:
mounts, scans the bundled mock markets, lists the profitable ETH opportunity,
shows the empty state cleanly, and runs the execute flow to `success`.

```bash
cd Frontend
npm test -- components/arbitrage/ArbitrageDisplay.test.tsx
```

## Localnet quickstart (optional — real swaps)

1. `cd Frontend/localnet && npx hardhat node`
2. In another shell: `cd Frontend/localnet && npm install && npm run deploy`
3. The `deploy` script prints sample market entries; copy them into
   `Frontend/data/mockMarkets.ts` (replacing the placeholder addresses).

The mock router expects equal swap amounts (demo simplicity). Never use this code
on mainnet.
