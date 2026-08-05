# Dual Backend Entrypoints — Audit Report

> Closes #561

## Overview

The `Backend/` directory contains **two independent server entrypoints** that
coexist in the same package. This document audits their purpose, overlap, and
recommended usage.

---

## Entrypoint 1 — Express (`server.js`)

| Property | Value |
|---|---|
| File | `Backend/server.js` |
| Framework | Express 4 (CommonJS) |
| Default port | `4000` (`env PORT`) |
| Start command | `npm start` / `npm run dev` |
| Package `main` | `"server.js"` |

### Routes served

| Mount path | Source |
|---|---|
| `GET /health` | inline |
| `/api/migrations` | `routes/migration.js` |
| `/api/rollback` | `routes/rollback.js` |
| `/api/beta` | `routes/beta.js` |
| `/api/oncall` | `routes/oncall.js` |
| `/api/upgrades` | inline (`upgradeCoordinator`) |

### Background jobs started

- `upgradeManager.start()` — polling job for scheduled upgrades

### Characteristics

- Plain CommonJS (`require` / `module.exports`)
- Minimal middleware (CORS + JSON body parser)
- Targets **operational/admin concerns**: migrations, rollbacks, beta access,
  on-call, upgrades
- No authentication layer at the entrypoint
- No validation pipe

---

## Entrypoint 2 — NestJS (`src/main.ts`)

| Property | Value |
|---|---|
| File | `Backend/src/main.ts` |
| Framework | NestJS (TypeScript, decorator-based DI) |
| Default port | `3000` (`env PORT`) |
| Start command | `npm run nest:start:dev` (dev) / `npm run nest:start:prod` (prod) |
| Build output | `dist/main.js` |

### Modules registered (AppModule)

`AuthModule`, `MarketDataModule`, `WebsocketModule`, `BlockchainModule`,
`PositionsModule`, `SearchModule`, `PortfolioModule`, `AiModule`,
`MarketsModule`, `WalletModule`, `GasModule`, `TradingHistoryModule`,
`OrderMatcherModule`, `LiquidityModule`, `AnalyticsModule`, `WebhooksModule`,
`ReceiptsModule`, `NetworkModule`, `ResolutionModule`, `UserSettingsModule`,
`FavoritesModule`, `RateLimiterModule`, `ApprovalModule`, `CategoriesModule`,
`TradingPairModule`, `WithdrawalModule`, `ApiKeysModule`, `AppCacheModule`,
`NotificationModule`, `TradeEngineModule`, `MarketMonitoringModule`,
`TradeReconciliationModule`, `MarketAuditModule`, `VerificationModule`,
`MarketMetadataModule`, `EventNotificationModule`, `BridgeModule`

### Characteristics

- TypeScript / decorator-based dependency injection
- Global `ValidationPipe` (whitelist + forbidNonWhitelisted)
- Global API prefix `/api`
- Targets **product/trading concerns**: markets, orders, positions, auth, AI,
  WebSocket, analytics
- Connects to MongoDB (Mongoose) and Redis (cache)
- Includes `ThrottlerModule` rate limiting

---

## Key Differences

| Concern | Express (`server.js`) | NestJS (`src/main.ts`) |
|---|---|---|
| Language | JavaScript (CJS) | TypeScript |
| Default port | `4000` | `3000` |
| Scope | Ops / infra | Product / trading API |
| Auth | None at entrypoint | JWT strategy (`AuthModule`) |
| Validation | None | Global `ValidationPipe` |
| DB | None directly | MongoDB via Mongoose |
| Cache | None | Redis via `CacheModule` |
| Background jobs | `upgradeManager` | `@nestjs/schedule` tasks |
| Test runner | Jest (`.spec.ts`) | Jest (`.spec.ts`) |

---

## Identified Issues (resolved)

1. **Port conflict risk** — both servers previously shared `PORT`. Fixed: Express
   now defaults to `4000`, NestJS to `3000`. Set `PORT` and `NEST_PORT`
   independently when running side-by-side.
2. **`package.json` only exposed Express scripts** — `npm start` and
   `npm run dev` launched only `server.js`. Fixed: `nest:build`,
   `nest:start`, `nest:start:dev`, `nest:start:debug`, and `nest:start:prod`
   scripts added so the NestJS entrypoint is visible to CI.
3. **No documentation** explaining which server to run when. Fixed: this file.

---

## Recommended Usage

| Use case | Command | Server |
|---|---|---|
| Local Express dev | `npm run dev` | Express on port `4000` |
| Local NestJS dev | `npm run nest:start:dev` | NestJS on port `3000` |
| Production Express | `npm start` | Express on port `4000` |
| Production NestJS | `npm run nest:start:prod` | NestJS (`dist/main.js`) |

Both servers are **intentional** and serve different functional layers. They
should run simultaneously in production on separate ports.

---

## Port Conflict Prevention

```bash
# Terminal 1 — Express operational server
PORT=4000 node Backend/server.js

# Terminal 2 — NestJS product API
NEST_PORT=3000 node Backend/dist/main.js   # after: npm run nest:build
```