# WebSocket Quick Start Guide

This guide is for the **Next.js app shell** in `Frontend/`. Path aliases, ports, and env vars below match the current repository — not older `@/src/` layouts.

The root layout (`Frontend/app/layout.tsx`) already mounts `WebSocketProvider` around `Navbar` and every route. You do **not** need a second provider to try the test page. See [README.md](README.md#app-shell-and-websocket-quickstart).

## TypeScript path aliases

Configured in [`tsconfig.json`](tsconfig.json) and [`vitest.config.mts`](vitest.config.mts):

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `Frontend/*` (package root `./*`) |

There is **no** `@/src/` alias. WebSocket UI used in this quickstart lives under `app/components/` (`@/app/components/...`). Shared hooks live under `hooks/` (`@/hooks/...`). Other widgets live under `components/` (`@/components/...`).

```tsx
import PriceDisplay from "@/app/components/market/PriceDisplay";
import MarketPriceList from "@/app/components/market/MarketPriceList";
import { usePriceUpdates, useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
```

Run `npm` scripts from `Frontend/` so these aliases resolve.

## Quick Setup

### 1. Environment Configuration

Create `.env.local` in the `Frontend/` directory. `NEXT_PUBLIC_BACKEND_URL` must match Backend `PORT`.

[`Backend/.env.example`](../Backend/.env.example) sets `PORT=4000`. NestJS (`Backend/src/main.ts`) uses `process.env.PORT ?? 3000` only when `PORT` is unset.

```env
# Socket.IO origin (no /api suffix). Use 4000 when Backend/.env is copied from .env.example.
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Wallet (Connect Wallet in the app shell). Required for Particle ConnectKit.
NEXT_PUBLIC_PROJECT_ID=
NEXT_PUBLIC_CLIENT_KEY=
NEXT_PUBLIC_APP_ID=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

If you start Backend **without** a `.env` file, it listens on **3000** and you should set `NEXT_PUBLIC_BACKEND_URL=http://localhost:3000` instead.

### 2. Start the Application

From the repository root, two terminals:

```bash
# Terminal 1 — NestJS API + /prices gateway
cd Backend
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run start:dev

# Terminal 2 — Next.js app shell (Navbar, wallet, routes)
cd Frontend
npm install
npm run dev
```

Next.js defaults to **http://localhost:3000**. Backend with `.env.example` is **http://localhost:4000**. They do not share a port in that configuration.

If Backend is on 3000 and Next reports `EADDRINUSE`, start the frontend on another port: `npm run dev -- -p 3001`.

### 3. Test the Implementation

Visit: `http://localhost:3000/test-websocket` (or the port printed by `next dev`).

On first load you should see the **navbar**, **Connect Wallet**, and the test page — not a blank screen. Connection status and the Error row are the diagnostics if Socket.IO fails.

The NestJS `/prices` gateway (`Backend/src/websocket/price.gateway.ts`) **disconnects clients without a JWT**. Register and login:

```bash
# global prefix is api — see Backend/src/main.ts
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dev@localhost\",\"password\":\"password1\",\"name\":\"Dev\"}"

curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dev@localhost\",\"password\":\"password1\"}"
```

Pass the access token as `WebSocketProvider` `authToken` (handshake `auth.token` or `Authorization: Bearer`). The root layout does not currently inject a token; the test page will show a connection error until you do. That error is intentional and should remain visible.

## What's Included

### Hooks
- `useWebSocket` — `@/hooks/useWebSocket`
- `usePriceUpdates` / `useSinglePriceUpdate` — `@/hooks/usePriceUpdates`

### Components
- `WebSocketProvider` — `@/app/components/WebSocketProvider` (mounted in `app/layout.tsx`)
- `PriceDisplay` — `@/app/components/market/PriceDisplay`
- `MarketPriceList` — `@/app/components/market/MarketPriceList`

### Features
- Real-time price updates when the `/prices` namespace accepts the socket
- Automatic reconnection
- Polling fallback (REST `POST {backendUrl}/api/market-data/prices` — that route is **not** implemented on the Nest controller today; failed polls should appear in the console)
- Connection status on `/test-websocket`
- Flash animations for price changes
- Visible connection errors (toast includes the underlying message)

## Common Use Cases

### Display a Single Market Price

```tsx
import PriceDisplay from "@/app/components/market/PriceDisplay";

<PriceDisplay
  marketId="market-1"
  showChange
  showVolume
  size="lg"
/>
```

### Subscribe to Multiple Markets

```tsx
import { usePriceUpdates } from "@/hooks/usePriceUpdates";

const { prices, isConnected } = usePriceUpdates({
  marketIds: ["market-1", "market-2", "market-3"],
  autoSubscribe: true,
});
```

### Get Current Price

```tsx
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";

const { price, isLoading } = useSinglePriceUpdate("market-1");
console.log(price?.currentPrice);
console.log(price?.changePercent);
```

### Check Connection Status

```tsx
import { useWebSocketContext } from "@/app/components/WebSocketProvider";

const { status, isConnected, error } = useWebSocketContext();
```

`useWebSocketContext` throws if used outside `WebSocketProvider`. In this app that means: only under the root layout (or a test wrapper).

## Configuration Options

### WebSocketProvider Props

```tsx
<WebSocketProvider
  backendUrl="http://localhost:4000"
  authToken={userToken}
  enablePollingFallback={true}
>
  {children}
</WebSocketProvider>
```

Default `backendUrl` in code is `process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000"`.

### usePriceUpdates Options

```tsx
usePriceUpdates({
  marketIds: ["market-1"],
  autoSubscribe: true,
  onUpdate: (prices) => console.log(prices),
})
```

## Troubleshooting

### Blank screen on first load?

The app shell (navbar + wallet + routes) must render even while Particle ConnectKit loads. If you still see a blank page, open the browser console and the on-page error boundary (message + stack in development). Do not treat a white page as "still loading."

### Wallet connect does nothing?

Fill Particle env vars in `.env.local` and restart `npm run dev`. Without them, Connect Wallet shows a diagnostic empty state instead of a silent failure. See `CONTRIBUTING.md`.

### WebSocket not connecting?

1. Backend health: `GET http://localhost:4000/api` (or port 3000 if `PORT` is unset) — Nest global prefix is `api`.
2. `NEXT_PUBLIC_BACKEND_URL` must be the Backend **origin**, not `.../api`.
3. JWT required by `Backend/src/websocket/price.gateway.ts`.
4. Read the Error row on `/test-websocket` and the toast; they include the socket error message.
5. CORS: Nest uses `FRONTEND_URL` from Backend env (`http://localhost:3000` in `.env.example`).

### No price updates?

1. Status should be `connected` after JWT handshake.
2. Confirm you subscribed to market IDs.
3. Console: `[WebSocket]` logs and failed polling `fetch` calls.

## Documentation

- Implementation notes: [WEBSOCKET_IMPLEMENTATION.md](WEBSOCKET_IMPLEMENTATION.md)
- Test page: `/test-websocket`
- Backend gateway: `Backend/src/websocket/price.gateway.ts`
- Contributor install: [CONTRIBUTING.md](../CONTRIBUTING.md)

## Visual Indicators

- Green flash: price increased
- Red flash: price decreased
- Live badge: WebSocket connected
- Connecting: attempting connection
- Offline / error: connection failed — read the error text

## Authentication

```tsx
<WebSocketProvider authToken={yourJWTToken}>
  {children}
</WebSocketProvider>
```

Token is sent via:

- `auth.token` in the Socket.IO handshake
- `Authorization: Bearer <token>` header

## Connection States

| State | Description | User action |
|-------|-------------|-------------|
| `connected` | WebSocket active | None |
| `connecting` | Attempting connection | Wait, or check Backend URL |
| `disconnected` | Not connected | Check Backend and JWT |
| `error` | Connection failed | Read `error.message` on `/test-websocket` |

## Happy-path checklist

Automated coverage: `npm test` in `Frontend/` (path-alias import test, ConnectModal, ParticleClientWrapper first paint).

Manual:

1. `cd Frontend && npm install && npm run dev`
2. Open `/` — navbar links work; not a blank page.
3. Click **Connect Wallet** — empty-state copy or wallet options, not a crash.
4. Open `/test-websocket` — status + backend URL + error text are visible.
5. With Backend on the documented port and a JWT passed into `WebSocketProvider`, status can reach `connected`.

## Support

1. [WEBSOCKET_IMPLEMENTATION.md](WEBSOCKET_IMPLEMENTATION.md)
2. Browser console
3. `/test-websocket`
4. Backend logs from `npm run start:dev`
