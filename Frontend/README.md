This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server from **`Frontend/`**:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) (Next.js default). If that port is taken, `next dev` prints the next free port.

If Particle ConnectKit credentials are unset, the default layout wallet shell
mounts Wagmi + a no-op ConnectKit bridge and never imports Particle into the
client graph (avoids Turbopack failing on AWS SDK → `node:fs`). To opt into
ConnectKit, point `app/layout.tsx` at `ParticleClientWrapper.particle` and use
`npm run dev:webpack` rather than global Node built-in stubs.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## App shell and WebSocket quickstart

`app/layout.tsx` is the application shell. On every route it mounts:

1. `PageErrorBoundary` — render failures show the error message (and stack in development), not a blank page
2. `ParticleClientWrapper` — client-only wallet provider; **children (navbar + page) render immediately** while ConnectKit loads
3. `WebSocketProvider` — Socket.IO client to Backend `/prices` (`NEXT_PUBLIC_BACKEND_URL`)
4. `Navbar` (`components/layout/Navigation.tsx`) — markets, wallet, Connect Wallet
5. `WalletRuntimeFeatures` — gates `BackupReminder` / `PendingTransactions` until ConnectKit is mounted so those hooks cannot blank the shell
6. The matched `app/**/page.tsx` route

[WEBSOCKET_QUICKSTART.md](WEBSOCKET_QUICKSTART.md) is the contributor guide for that WebSocket layer: TypeScript `@/*` aliases, env/ports, `/test-websocket`, and JWT requirements. Follow it from `Frontend/`; you do not add another `WebSocketProvider` unless you are writing an isolated test.

For how the pieces above `WebSocketProvider` fit together — the `useWebSocket` connection hook, the `usePriceUpdates` subscription layer, and `PriceDisplay`'s flash-on-change rendering, plus the polling fallback when a socket can't connect — see [WEBSOCKET_IMPLEMENTATION.md](WEBSOCKET_IMPLEMENTATION.md). `WebSocketProvider` is already mounted once in `app/layout.tsx` (item 3 above); that doc covers what runs underneath it, while WEBSOCKET_QUICKSTART.md covers getting a local environment talking to it.

TypeScript aliases (`tsconfig.json`): `@/*` → `./*` (this package root). Example: `@/hooks/usePriceUpdates` → `Frontend/hooks/usePriceUpdates.ts`.

Wallet env vars and Backend port details: [CONTRIBUTING.md](../CONTRIBUTING.md), [`Backend/.env.example`](../Backend/.env.example) (`PORT=4000`).

## Runbook — wallet + trade flow on a clean checkout (#710)

This section answers "how do I run the wallet and trade flow locally?" for a
first-time contributor on a clean checkout.

### Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 18.x (LTS) | 20.x recommended; required by Next.js 14 |
| npm | 9.x | Comes with Node.js |
| Backend API | running on port 4000 | See `Backend/README.md` for setup |

### Step-by-step

```bash
# 1. Clone and enter the frontend directory
cd Frontend

# 2. Install dependencies (locked to package-lock.json)
npm install

# 3. Create a local env file from the example template
cp .env.example .env.local
# Open .env.local and set:
#   NEXT_PUBLIC_API_URL=http://localhost:4000/api   (NestJS backend)
#   NEXT_PUBLIC_BACKEND_URL=http://localhost:4000   (WebSocket / direct calls)
# The wallet keys (PROJECT_ID, CLIENT_KEY, APP_ID) are optional for local dev —
# the app runs in no-wallet mode when they are absent.

# 4. Start the development server
npm run dev
# → http://localhost:3000
```

> **Ports.**  The frontend default is `3000`; the backend API default is `4000`.
> Both values come from `Frontend/.env.example` and `Backend/.env.example`
> respectively — do not hard-code either port anywhere.

### Wallet connect flow

1. Open `http://localhost:3000`.
2. Click **Connect Wallet** in the navbar.
3. Without Particle credentials the app mounts a no-op ConnectKit bridge; the
   wallet button renders but signing is unavailable.  To enable real signing,
   set `NEXT_PUBLIC_PROJECT_ID`, `NEXT_PUBLIC_CLIENT_KEY`, and
   `NEXT_PUBLIC_APP_ID` in `.env.local` then restart the dev server.

### Trade flow

1. With the backend running and the dev server up, navigate to the markets list
   (`/`).
2. Select a market → click **Trade** → enter an amount → confirm.
3. The WebSocket provider (`app/layout.tsx`) subscribes to `/prices` on the
   backend and refreshes prices in real time; look for the green **Live** badge
   on the market detail page.

### Environment variables and ports (verified against `.env.example` files)

| Variable | File | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `Frontend/.env.example` | `http://localhost:4000/api` | NestJS API base (proxied by Next.js route handlers) |
| `NEXT_PUBLIC_BACKEND_URL` | `Frontend/.env.example` | `http://localhost:4000` | Direct browser + WebSocket connection |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `Frontend/.env.example` | Pinata public gateway | Market metadata upload |
| `PORT` | `Backend/.env.example` | `4000` | Express / NestJS listen port |
| `MONGODB_URI` | `Backend/.env.example` | `mongodb://127.0.0.1:27017/gatedelay` | Primary data store |
| `REDIS_URL` | `Backend/.env.example` | `redis://127.0.0.1:6379` | Queues, throttling, blacklist |

### Verified links

- [`Backend/.env.example`](../Backend/.env.example) — all backend required keys
- [`Frontend/.env.example`](.env.example) — all frontend required keys
- [`Backend/README.md`](../Backend/README.md) — backend setup and runbook
- [WEBSOCKET_QUICKSTART.md](WEBSOCKET_QUICKSTART.md) — WebSocket layer details
- [TRADING_INTERFACE_DOCUMENTATION.md](TRADING_INTERFACE_DOCUMENTATION.md) — `/trade/[id]` shell map
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — wallet env vars and port details

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## The `/archive` route

`app/archive/page.tsx` lists resolved and cancelled markets.
`components/archive/ArchiveView.tsx` owns filtering, search and the summary
stats; the page owns data loading and the four terminal states.

**Data flow.** The page calls `/api/archive?limit=500`. That route handler
(`app/api/archive/route.ts`) proxies to `${NEXT_PUBLIC_API_URL}/markets/archive`,
forwarding the `category`, `outcome`, `from`, `to` and `limit` filters. The
browser never learns the backend origin. Both a bare array and a
`{ data: [...] }` envelope are accepted; rows that fail `isArchivedMarket` are
dropped rather than being allowed to crash the list mid-render.

**Environment.** `NEXT_PUBLIC_API_URL` — e.g. `http://localhost:4000/api`.
Resolved through `lib/apiBase.ts`, which keeps the localhost default for local
development but **throws in production builds** if the variable is unset. The
previous inline `?? "http://localhost:3000/api"` meant a deployment that forgot
the variable failed silently, pointing live traffic at a loopback address and
rendering an empty page instead of an error.

**Hydration.** Data is fetched in an effect, never during render, so the first
paint is identical on server and client and there is nothing to reconcile. When
adding to this page, do not seed state from `Date.now()`, `window`, or
`Math.random()` — each produces a server/client mismatch and the "text content
did not match" warning.

**No blank screens.** `loading`, `error`, `empty` and `ready` are all rendered
explicitly. The error state shows the reason the proxy reported and offers a
retry. The page previously held a static mock array with `isLoading` pinned to
`false`, so no failure could surface at all.

**Tests.** `app/archive/page.test.tsx` — 10 cases covering the heading, the
loading state, the proxy URL, rendering, the envelope form, malformed-row
filtering, the empty state, both error paths, and retry.

```bash
npm test                        # whole suite
npx vitest run app/archive      # this route only
```

> Known unrelated issue: `npm run lint` currently dies with
> `ERR_PACKAGE_PATH_NOT_EXPORTED` from `zod-validation-error` inside
> `eslint-config-next`'s dependency tree. It reproduces on untouched files and
> is a dependency version mismatch, not a code problem.
## Docker

```bash
npm run docker:build     # docker build -t gatedelay-frontend:local .
npm run docker:smoke     # boots the image, checks /api/ping, / and /audit
```

Multi-stage build on `node:22-alpine` using Next.js `output: "standalone"`, run
as a non-root user with a `/api/ping` healthcheck.

`NEXT_PUBLIC_*` values are **build args, not runtime env** — Next.js inlines them
into the client bundle, so an image is environment-specific and no secret may be
passed in. Required keys: `.env.example` (the only tracked `.env*` here). Full
build, retry, rollback and deploy-sequencing notes, including how a release
orders itself against `backend/services/upgradeCoordinator.js`:
[`docs/DEPLOY_FRONTEND_DOCKER.md`](../docs/DEPLOY_FRONTEND_DOCKER.md).

## App shell

`app/layout.tsx` is the only place chrome is defined. Every route renders inside
it, so a page component starts at its own `<main>` and never repeats the navbar,
theme or providers.

Provider order, outermost first:

| Provider | Supplies |
|---|---|
| `PageErrorBoundary` | Catches a render throw so one broken route does not blank the app |
| `ThemeProvider` | `--background` / `--foreground` / `--card` / `--border` / `--muted` tokens |
| `ToastProvider` | App-wide toasts |
| `QueryProvider` | The TanStack `QueryClient` every `useQuery` caller needs |
| `ParticleClientWrapper` | Wallet connect (Particle ConnectKit), client-only |
| `WebSocketProvider` / `ConnectivityProvider` | Live updates and offline detection |
| `Navbar` | `components/layout/Navigation.tsx`, re-exported by `app/components/Navbar.tsx` |

`QueryProvider` sits **outside** `ParticleClientWrapper` on purpose.
The default wrapper mounts `UnconfiguredWalletRoot` (`WagmiShell` + no-op
ConnectKit bridge) so a query client nested inside a missing ConnectKit tree
would not vanish, and every `useQuery` page would not throw "No QueryClient set"
on first load. Layout widgets that call wagmi (`PendingTransactions`, home
quick-trade) keep working because `WagmiShell` always provides a provider when
Particle is off.

Adding a route to the navbar means adding it to `NAV_LINKS` in
`components/layout/Navigation.tsx`; the desktop row and the mobile drawer both
render from that one array.

## The `/trade/[id]` route (trading interface)

[TRADING_INTERFACE_DOCUMENTATION.md](TRADING_INTERFACE_DOCUMENTATION.md) is the
contributor map for the trading-interface **page shell**. It is not a second
app: `app/trade/[id]/page.tsx` renders inside the same `app/layout.tsx` tree as
`/`, `/dashboard`, and `/wallet` (error boundary → theme/toasts/query →
`ParticleClientWrapper` → `WebSocketProvider` → `Navbar` → page).

Wallet connect and navigation therefore come from the shell, not from the
trading components. Open `/` or `/trade/market-1` and the navbar + **Connect
Wallet** are already mounted. Particle credentials are optional; without them
the default wrapper is `UnconfiguredWalletRoot` (Wagmi + no-op ConnectKit
bridge) so first paint is never a blank screen.

`/trade/[id]` is **not** `/markets/[id]`. The market-detail page is a separate
YES/NO ticket UI. The trading interface is a chart / order-book / order-panel
layout driven by a local demo catalog (`DEMO_TRADE_MARKETS`: `market-1`,
`market-2`, `market-3`). There is no `GET /api/markets/:id` proxy. An unknown
id shows **Market not found** instead of substituting another row. Chart, book,
trades, positions, and the $1000 balance are in-component fixtures; order
submit is a local toast, not a Backend or contract call. `MarketInfo` can
overlay a live `/prices` tick when the layout WebSocket is connected and shows
**OFFLINE** when it is not.

The wallet address passed into `TradingInterface` is `useConnectKitBridge()` —
the same context as the navbar button — never a hard-coded `0x1234…` string.

**Tests.** `app/trade/[id]/page.test.tsx` — known market + Connect Wallet (no
fake address), positions only when the bridge has an address, unknown id error.

```bash
npx vitest run app/trade
```

Manual first-load checklist (wallet, nav, and this route) lives in
[TRADING_INTERFACE_DOCUMENTATION.md](TRADING_INTERFACE_DOCUMENTATION.md).
## Settings (`/settings`) and SETTINGS_SUMMARY.md

[`SETTINGS_SUMMARY.md`](SETTINGS_SUMMARY.md) is the resolution-status map for
the user-settings system. It is not a runtime module — Next.js does not import
the markdown — but it is the document that tells you how `/settings` uses the
app shell above instead of mounting its own navbar or wallet provider.

**What the page does.** `app/settings/page.tsx` is the tabbed preferences UI
(Appearance, Notifications, Trading, Privacy, Display). State lives in
`lib/settings.ts` (`settingsService`, localStorage key `gate_delay_user_settings`)
and is consumed through `hooks/useSettings.ts`. `ThemeProvider` (already in
`app/layout.tsx`) applies `settings.theme` on first load.

**What the shell already provides.** Wallet connect, Markets/Settings nav, theme
tokens, toasts, and `PageErrorBoundary` come from `app/layout.tsx`. The settings
route only fills `<main>`. First load of `/` or `/settings` should show the
navbar and **Connect Wallet** immediately; Particle credentials are optional
(no-op ConnectKit when unset). Settings do not call the backend and do not
require `NEXT_PUBLIC_API_URL`.

**Failures vs blank screens.** A render throw is caught by `PageErrorBoundary`
(message + stack in development). A bad import file shows a toast, not a white
page. localStorage errors are logged and the store keeps `DEFAULT_SETTINGS`.
See the troubleshooting table in SETTINGS_SUMMARY.md.

**Setup (settings only):**

```bash
cd Frontend
cp -n .env.example .env.local   # optional for this route
npm install
npm run dev                     # http://localhost:3000/settings
npm test -- lib/settings.test.ts app/settings/page.test.tsx
```
## The `/arbitrage-demo` route

`/arbitrage-demo` is a **Pages Router** page (`pages/arbitrage-demo.tsx`), so it
renders **outside** the `app/layout.tsx` shell described above — no navbar, no
wallet/query/WebSocket providers, no `PageErrorBoundary`. The navbar still links
to it (`NAV_LINKS` → "Arbitrage"); following that link is a full-page navigation
out of the app shell.

`ArbitrageDisplay` itself needs no wallet or backend — it scans the markets it is
handed (bundled `data/mockMarkets.ts`, or `GET /api/markets` when the backend is
up) and renders opportunities. The on-chain `WagmiArbitrageExecutor` is the only
part that needs wagmi context and must be mounted inside the shell.

Full contributor guide — setup, the contract-event → `Status:` mapping, a manual
happy-path checklist, and troubleshooting for the "blank screen / no
opportunities" cases — is in [ARBITRAGE_DEMO.md](ARBITRAGE_DEMO.md). Vitest
coverage: `components/arbitrage/ArbitrageDisplay.test.tsx`.

## The `/audit` route

`app/audit/page.tsx` is the market audit log. It owns the page container, header
and `<Suspense>` fallback; all the data work lives in
`components/audit/AuditLogViewer.tsx`.

**Data flow.** The viewer calls `/api/market-audit?limit=2000`. That route
handler (`app/api/market-audit/route.ts`) proxies to the NestJS backend at
`${NEXT_PUBLIC_API_URL}/market-audit/logs`, forwarding the `marketId`,
`operation`, `actor`, `from`, `to` and `limit` filters. When the backend returns
rows they are rendered; when it returns nothing the viewer falls back to a
generated `MOCK_LOGS` set so the table, pagination and CSV export stay usable
offline. Live rows always win over the fallback.

**Responsive rules.** The page and the viewer share three:

- the container gutter steps `px-4` -> `sm:px-6` -> `lg:px-8` instead of sitting
  at a fixed `px-4`;
- stat cards step 1 -> 2 -> 4 columns (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-4`); going straight from 1 to 4 at `md` squeezed four cards into
  roughly 180px each on a tablet;
- the log table declares `min-w-[880px]` inside a `overflow-x-auto` wrapper, and
  the section around it is `min-w-0`. Together these keep the nine-column table
  scrolling **inside its own box** rather than widening the page — without the
  `min-w-0`, a wide grid child forces the whole document to scroll sideways.

**Tests.** `app/audit/page.test.tsx` covers the happy path: the header renders,
the page mounts under a `QueryClient`, `/api/market-audit` is called on first
load, live rows replace the mock fallback, and the table stays inside its scroll
container.

```bash
npm test                      # whole suite
npx vitest run app/audit       # this route only
```

## API routes in the app shell

These Next.js route handlers live under `app/api/*`. The browser talks only to
same-origin `/api/...` paths; the handlers proxy (or simulate) backend/chain
work so the client bundle never embeds a production localhost URL.

Shared config: `lib/apiBase.ts` (`resolveApiBase`, `resolveBackendUrl`). Local
dev may fall back to `http://localhost:4000`; **production builds throw** if the
matching `NEXT_PUBLIC_*` variable is unset — misconfiguration becomes a JSON
error, not a blank screen.

| Route | Role | Env |
|---|---|---|
| `GET /api/market-sentiment` | Proxies AI sentiment; UI refreshes via WebSocket | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BACKEND_URL` |
| `GET /api/market-audit` | Proxies NestJS audit logs for `/audit` | `NEXT_PUBLIC_API_URL` |
| `POST /api/multisig/execute` | Executes a ready multisig tx and maps `TransactionExecuted` | (in-memory store; wallet on `/wallet`) |
| `POST /api/ipfs/upload-json` | Stores market JSON metadata; returns gateway URL | `NEXT_PUBLIC_IPFS_GATEWAY` (optional) |
| `POST /api/ipfs/pin/[hash]` | Pins an already-uploaded IPFS hash (used after upload) | `NEXT_PUBLIC_IPFS_GATEWAY` (optional) |
| `GET /api/ipfs/gateway/[hash]` | Resolves a gateway URL + storage status for an IPFS hash | `NEXT_PUBLIC_IPFS_GATEWAY` (optional) |

### `/api/market-sentiment` (#755)

`components/market/MarketSentiment.tsx` (market detail page) calls
`/api/market-sentiment?marketId=…`. The handler proxies to
`${NEXT_PUBLIC_API_URL}/ai/sentiment/:marketId` and returns structured errors
(`VALIDATION_ERROR`, `CONFIG_ERROR`, `BACKEND_UNREACHABLE`, `UPSTREAM_ERROR`)
instead of failing silently.

**WebSocket.** The component reuses `useWebSocketContext` from the app shell:
it subscribes to the market and invalidates the React Query key on
`priceUpdate` / `marketData`. Wallet connect and navbar come from `layout.tsx`
(`QueryProvider` → `ParticleClientWrapper` → `WebSocketProvider` → `Navbar`);
this route does not mount its own chrome.

### `/api/market-audit` (#752)

Aligned with `/api/archive`: same `resolveApiBase` helper, forwarded query
keys (`marketId`, `operation`, `actor`, `from`, `to`, `limit`), and `502` when
the backend is unreachable. No `localhost:3000` default remains on the
production path. Consumed by `AuditLogViewer` on `/audit`.

### `/api/multisig/execute` (#759)

`components/wallet/MultisigUI.tsx` (under `/wallet`) posts `{ txId, executor }`.
`lib/multisigStore` mirrors the backend mock and maps events from
`Contracts/src/MultiSigWallet.sol`:

- `TransactionCreated(txId, creator, target)`
- `TransactionApproved(txId, signer)`
- `TransactionExecuted(txId, executor)`

The response includes `data.events` and a top-level `event` projection for the
execute step so the UI never invents field names. The in-memory mock does **not**
fabricate an on-chain `txHash`; that field is omitted until a real broadcast path
sets it. Happy-path Vitest: `app/api/multisig/execute/route.test.ts`.

### `/api/ipfs/upload-json` (#748)

Used by `useIPFS` → `MarketIPFSPanel` on `/markets/create`. Validates JSON body,
rejects missing `data`, and returns `{ hash, url }` where `url` comes from
`NEXT_PUBLIC_IPFS_GATEWAY` or the public Pinata gateway. A production build
that points the gateway at localhost fails with `CONFIG_ERROR` instead of
booting a broken upload path. Malformed JSON returns `400` rather than an
unhandled exception that blanked the page.

### `/api/ipfs/pin/[hash]` (#741)

The pin route is the write-side follow-up to `/api/ipfs/upload-json`. `[hash]`
is matched by a Next.js dynamic segment (see `app/api/ipfs/pin/[hash]/route.ts`).
`useIPFS.pin` (from `MarketIPFSPanel` on `/markets/create`) POSTs an optional
`{ name }` label after a successful upload so the in-memory `lib/ipfsStore`
shim marks that hash as pinned — the same store the gateway route reads.

```json
{ "success": true, "message": "Hash Qm… pinned successfully", "data": { "hash": "Qm…", "pinned": true } }
```

This handler is an API route, not a page: it never renders layout or CSS.
Wallet connect and navigation still come from `app/layout.tsx` and work on
first load; the pin route mounts no chrome of its own.

The route never throws into the app shell. Missing/empty/unsupported hashes
or invalid JSON return `400 VALIDATION_ERROR`. An unknown hash (not yet
uploaded) returns `404 NOT_FOUND` with a message that points at
`POST /api/ipfs/upload-json`. Any other fault returns `500 INTERNAL_ERROR`.
Contributors get a JSON reason instead of a blank screen.

**Smoke test:** `app/api/ipfs/pin/[hash]/route.test.ts` (upload → pin, optional
body, missing/malformed hash, invalid JSON, unknown hash, unexpected fault).
Run with `npm test` or `npx vitest run app/api/ipfs/pin`.

### `/api/ipfs/gateway/[hash]` (#738)

The gateway route is the read side of the upload flow. `[hash]` is matched by a
Next.js dynamic segment (see `app/api/ipfs/gateway/[hash]/route.ts`) and the
handler resolves the matching `NEXT_PUBLIC_IPFS_GATEWAY` URL plus the storage
status for that hash from the in-memory `lib/ipfsStore` shim:

```json
{ "success": true, "data": { "url": "https://gateway.pinata.cloud/ipfs/Qm…", "stored": true, "pinned": true, "gatewayUrl": "…" } }
```

The route never throws into the app shell. Missing/empty/unsupported hashes
return `400 VALIDATION_ERROR`, a production build pointed at a localhost
gateway returns `500 CONFIG_ERROR`, and any other fault returns
`500 INTERNAL_ERROR` — so a contributor debugging IPFS gets a JSON reason
instead of a blank page. Wallet connect and navigation are unaffected: the
route mounts no chrome of its own and renders inside `app/layout.tsx` like
every other route handler.

**Smoke test:** `app/api/ipfs/gateway/[hash]/route.test.ts` (upload → gateway
read, unknown hash, missing/malformed hash, production localhost config, and
unexpected fault). Run with `npm test` or `npx vitest run app/api/ipfs`.

### Local verification

```bash
cd Frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL / BACKEND_URL as needed
npm install
npm test                     # includes the five route suites above
npm run dev                  # open /, /trade/market-1, /audit, /wallet, /markets/create
npm test                     # includes the IPFS pin suite and other route suites above
npm run dev                  # open /, /audit, /wallet, /markets/create
```

Manual checklist:

1. `/` and navbar render; wallet button mounts (ConnectKit optional without Particle env).
2. `/trade/market-1` renders inside that same chrome; `/trade/does-not-exist` shows **Market not found**.
3. `/audit` loads without console errors; audit proxy errors show in the viewer when the backend is down.
4. Market detail shows sentiment error/retry (not a blank card) when AI is down; "Live" appears when the WebSocket is connected.
5. `/wallet` propose → sign (threshold) → execute shows `TransactionExecuted(...)`.
6. `/markets/create` upload returns a non-localhost gateway URL; opening that URL in the gateway route shows the uploaded metadata.
7. Hitting `/api/ipfs/gateway/` with an empty hash returns a JSON `VALIDATION_ERROR`, never a blank screen.
2. `/audit` loads without console errors; audit proxy errors show in the viewer when the backend is down.
3. Market detail shows sentiment error/retry (not a blank card) when AI is down; "Live" appears when the WebSocket is connected.
4. `/wallet` propose → sign (threshold) → execute shows `TransactionExecuted(...)`.
5. `/markets/create` upload returns a non-localhost gateway URL; opening that URL in the gateway route shows the uploaded metadata.
6. Hitting `/api/ipfs/gateway/` with an empty hash returns a JSON `VALIDATION_ERROR`, never a blank screen.
7. After a successful upload on `/markets/create`, **Pin Hash** calls `POST /api/ipfs/pin/[hash]` and the panel shows a success toast (not a blank card).
8. `POST /api/ipfs/pin/` with an empty or unknown hash returns JSON (`VALIDATION_ERROR` / `NOT_FOUND`), never a blank screen.

## SSR Notes

- `Frontend/components/wallet/QRDisplay.tsx` is a client-only wallet QR component.
- The QR rendering library (`qrcode`) is dynamically imported at runtime to avoid SSR bundling or server-side DOM access issues.
- Clipboard access is guarded as a browser-only API.
- QR session timers are cleaned up on unmount to keep client transition paths stable during hydration.
- Phase 2+: if server-rendered QR previews are required, add a lightweight server-safe placeholder before hydration.

## ConnectKit bridge

`app/components/ParticleClientWrapper.tsx` lazy-loads the client-only Particle provider in the root layout. When the public Particle variables are configured, `ParticleProvider` mounts `ConnectKitProvider` and `app/components/ConnectKitBridge.tsx` makes wallet state available to the navbar and wallet modal. When they are absent, the bridge's default context reports `resolutionStatus: "unavailable"` with setup guidance, while the rest of the app remains navigable.

The bridge reports `disconnected`, `resolving`, or `connected` after ConnectKit is mounted. Configure `NEXT_PUBLIC_PROJECT_ID`, `NEXT_PUBLIC_CLIENT_KEY`, and `NEXT_PUBLIC_APP_ID` in `Frontend/.env.local` to enable wallet connection on first load.
