# Trading Interface

Contributor map for the trading-interface **page shell** at `/trade/[id]`. This
file describes how that route sits inside the Frontend app — not a second
application, and not a specification for features the code does not run.

For install, ports, and wallet env vars see [README.md](README.md) and
[CONTRIBUTING.md](../CONTRIBUTING.md).

## How it fits the app shell

`app/layout.tsx` is the only chrome. `/trade/[id]` does **not** mount its own
navbar, wallet provider, toast host, or WebSocket client.

On every route, including `/trade/market-1`, the layout mounts (outermost first):

1. `PageErrorBoundary` — a render throw shows an error + retry, not a blank page
2. `ThemeProvider` / `ToastProvider` / `QueryProvider`
3. `ParticleClientWrapper` — default is `UnconfiguredWalletRoot` (Wagmi + no-op
   ConnectKit bridge). Children (navbar + page) render on first paint. Particle
   ConnectKit is opt-in via `ParticleClientWrapper.particle`
4. `WebSocketProvider` — Socket.IO client to Backend `/prices`
   (`NEXT_PUBLIC_BACKEND_URL`)
5. `Navbar` (`components/layout/Navigation.tsx`) — Markets, Wallet, **Connect
   Wallet**, and the other `NAV_LINKS`
6. `WalletRuntimeFeatures` — holds `BackupReminder` / `PendingTransactions`
   until ConnectKit is actually available
7. The matched `app/trade/[id]/page.tsx`

Wallet connect and navigation therefore work the same on first load of `/` and
`/trade/[id]`. You do not add another provider tree to use this page.

`/markets/[id]` is a **different** YES/NO market-detail UI. Do not treat it as
this trading interface.

## First load (minimal setup)

From `Frontend/`:

```bash
npm install
cp .env.example .env.local   # optional for local; see README.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js defaults to port
**3000** (not 3001). If that port is taken, `next dev` prints the next free port.

| Step | What you should see |
|------|---------------------|
| `/` | Navbar + **Connect Wallet** on first paint (no blank screen) |
| Navbar **Markets** | `/dashboard` |
| `/trade/market-1` | Trading interface for the `market-1` demo row |
| `/trade/not-a-market` | **Market not found** + links, not a silent fallback |

Particle `NEXT_PUBLIC_PROJECT_ID` / `CLIENT_KEY` / `APP_ID` are **optional**.
Without them the Connect Wallet button still renders and opens the local
`ConnectModal`. Signing is unavailable until you opt into ConnectKit (see
[README.md](README.md)).

Backend on port **4000** is optional for this page. Without it, `MarketInfo`
shows an **OFFLINE** badge and keeps the demo row’s price fields.

## Route and data wiring

| Piece | Source | Live? |
|-------|--------|-------|
| Market header fields | `DEMO_TRADE_MARKETS` in `app/trade/[id]/page.tsx` | No — local demo catalog |
| Wallet address | `useConnectKitBridge()` (same context as the navbar button) | Yes — real session, or `undefined` when disconnected |
| Price overlay | `useSinglePriceUpdate(market.id)` via layout `WebSocketProvider` | Only when `/prices` is connected |
| Chart / order book / recent trades / positions / $1000 balance | In-component UI fixtures | No |
| Order submit | `OrderPanel` validates, optional `confirm()`, then a local toast | No Backend or contract call |

There is no `GET /api/markets/:id`, `POST /api/orders`, or order-book
WebSocket event implemented for this page. Do not copy those paths as if they
exist.

Unknown ids **do not** fall back to `market-1`. The page lists
`DEMO_TRADE_MARKET_IDS` (`market-1`, `market-2`, `market-3`) and links to
`/trade/market-1` and `/dashboard`.

## Components

All live under `app/components/trade/` (alias `@/app/components/trade/...`).
`TradingInterface` is the only component the page mounts.

| Component | What it actually does |
|-----------|------------------------|
| `TradingInterface.tsx` | Grid: header, chart, order book, recent trades, order panel; positions only when `userAddress` is set. Each child is wrapped in `ComponentErrorBoundary`. |
| `MarketInfo.tsx` | Renders the demo `Market`. Overlays WebSocket price/volume when present. **OFFLINE** when the socket is down. |
| `TradingChart.tsx` | Recharts area/line chart from locally generated points. Timeframes: 1H, 24H, 7D, 30D, ALL. `marketId` is unused for fetching. |
| `OrderPanel.tsx` | Buy/Sell + market/limit + leverage UI. Balance is a local `1000` fixture. Disabled **Connect Wallet** when `userAddress` is missing. Submit is a 1.5s delay + toast (`TODO: Implement actual order submission`). |
| `OrderBookCompact.tsx` | Five local bid/ask rows; All / Bids / Asks toggle. No WebSocket. |
| `RecentTrades.tsx` | Twenty local rows generated on mount. No live trade feed. |
| `UserPositions.tsx` | Two local positions when a wallet address is passed. History tab is empty. Close updates local state only. |

`Market` type (what the page passes in):

```ts
export interface Market {
  id: string;
  name: string;
  description: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  totalLiquidity: number;
  expiryDate: string;
  status: "active" | "closed" | "resolved";
}
```

The page passes `userAddress={address}` from the wallet bridge. It does **not**
hard-code `0x1234…`.

## Layout (what the grid does)

Desktop (`lg`, ≥1024px): MarketInfo full width; chart 8 columns with order book
+ recent trades underneath; order panel 4 columns; positions full width when a
wallet address exists.

Below `lg`: the same blocks stack (chart → order panel → order book → trades →
positions). This is a CSS grid, not a separate tablet mode.

## Error and empty states

| State | Where | What the user sees |
|-------|--------|-------------------|
| Unknown `/trade/[id]` | `app/trade/[id]/page.tsx` | **Market not found**, known ids, links — not another market’s data |
| Wallet disconnected | `OrderPanel` | Button disabled, label **Connect Wallet**; toast if submit is attempted |
| Wallet provider missing | Layout `ParticleClientWrapper` / Connect Wallet | Button still renders; signing unavailable without ConnectKit |
| WebSocket down | `MarketInfo` | **OFFLINE** badge; demo price fields remain |
| Missing `NEXT_PUBLIC_BACKEND_URL` in production | `WebSocketProvider` / `lib/apiBase.ts` | Config error, not a silent empty chart |
| Child render throw | `ComponentErrorBoundary` | Red panel with component name + retry; the rest of the page stays up |
| Page render throw | `PageErrorBoundary` (layout + page) | Error message (stack in development) + retry |

The interface does **not** implement swipe gestures, keyboard trading
shortcuts, candlesticks, stop-loss / take-profit, or a native mobile app.

## Happy-path checklist

Run `npm run dev` in `Frontend/`, then:

1. Open `/` — navbar and **Connect Wallet** are visible on first paint.
2. Click **Markets**, **Wallet**, and the logo — routes change; chrome stays.
3. Open `/trade/market-1` — market name, stats, chart, order book, recent
   trades, and the Buy/Sell panel render.
4. Confirm **OFFLINE** if Backend `/prices` is not running (not a blank header).
5. With wallet disconnected, the submit button reads **Connect Wallet** and
   does not show a fabricated address.
6. Click **Connect Wallet** in the navbar — `ConnectModal` opens.
7. Enter an amount on a market order and submit (connected) — confirmation
   (if settings ask for it) then a success toast. No on-chain tx is created.
8. Open `/trade/does-not-exist` — **Market not found**, not `market-1`.
9. Narrow the viewport — blocks stack; navbar hamburger still opens.

Automated coverage: `npx vitest run app/trade` (unknown id, no fake address,
positions only when the bridge has an address).

```bash
cd Frontend
npm test                     # full suite, includes app/trade
npx vitest run app/trade     # this route only
```
