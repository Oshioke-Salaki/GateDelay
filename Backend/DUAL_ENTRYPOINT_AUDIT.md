# Dual Backend Entrypoint Audit

## Summary

The Backend/ directory contains **two independent server entrypoints** that
run on different ports and use different frameworks.  Understanding which one is
active and why both exist is critical for onboarding, deployment, and future
maintenance.

---

## Entrypoint 1 — Express (server.js)

| Property | Value |
|---|---|
| File | Backend/server.js |
| Framework | Express 4 |
| Port | process.env.PORT (default **4000**) |
| package.json main | ✅ server.js |
| package.json start script | ✅ 
ode server.js |
| Language | JavaScript (CommonJS) |
| Status | **Active / Production entrypoint** |

### Routes served
| Prefix | Router file |
|---|---|
| /api/migrations | outes/migration.js |
| /api/rollback | outes/rollback.js |
| /api/beta | outes/beta.js |
| /api/oncall | outes/oncall.js |
| /api/upgrades | inline handlers in server.js |
| /health | inline handler in server.js |

### Background jobs started on boot
- upgradeManager.start() — scheduled upgrade monitoring

---

## Entrypoint 2 — NestJS (src/main.ts)

| Property | Value |
|---|---|
| File | Backend/src/main.ts |
| Framework | NestJS (TypeScript) |
| Port | process.env.PORT (default **3000**) |
| Build config | 
est-cli.json, 	sconfig.json |
| Language | TypeScript |
| Status | **Secondary / Under active development** |

### Modules registered in AppModule
AuthModule, MarketDataModule, WebsocketModule, BlockchainModule,
PositionsModule, SearchModule, PortfolioModule, AiModule, MarketsModule,
WalletModule, GasModule, TradingHistoryModule, OrderMatcherModule,
LiquidityModule, AnalyticsModule, WebhooksModule, ReceiptsModule,
NetworkModule, ResolutionModule, UserSettingsModule, FavoritesModule,
RateLimiterModule, ApprovalModule, CategoriesModule, TradingPairModule,
WithdrawalModule, ApiKeysModule, AppCacheModule, NotificationModule,
TradeEngineModule, MarketMonitoringModule, TradeReconciliationModule,
MarketAuditModule, VerificationModule, MarketMetadataModule,
EventNotificationModule, BridgeModule.

> **Note**: NestJS dependencies (@nestjs/*) are **not** listed in
> Backend/package.json. The NestJS app has its own separate dependency tree
> and must be installed and run independently.

---

## Key Differences

| Concern | Express (server.js) | NestJS (src/main.ts) |
|---|---|---|
| Port | 4000 | 3000 |
| Language | JavaScript (CJS) | TypeScript |
| Routing | Manual pp.use() | Decorator-based controllers |
| Validation | None (inline) | ValidationPipe (class-validator) |
| Auth | None in root server | JWT strategy via AuthModule |
| Dependency injection | None | Full NestJS DI container |
| CORS | cors() middleware | pp.enableCors() |
| Global prefix | None | /api |
| Background jobs | upgradeManager.start() | @nestjs/schedule cron tasks |
| Config validation | Plain process.env | @nestjs/config + ConfigService |
| Tests | Jest (	ests/ folder) | Jest (	est/ folder, *.spec.ts) |

---

## Recommended Action

1. **Do not run both entrypoints on the same host/port simultaneously** —
   they bind to different ports (3000 vs 4000) but share the PORT env variable;
   set PORT explicitly for each process if running side-by-side.

2. **Migrate Express-only routes** (/api/upgrades, /api/migrations,
   /api/rollback, /api/beta, /api/oncall) into equivalent NestJS modules
   as the codebase converges on the NestJS entrypoint.

3. **Avoid adding new features to server.js** — all new feature development
   should target the NestJS application in src/.

4. **CI pipeline (ci.yml)** runs 
pm run test which targets Express tests
   under 	ests/ and 	est/ via Jest. Ensure both test suites are included
   in the Jest config (see package.json jest key).

---

## Port Conflict Prevention

If both processes must run simultaneously (e.g., during migration):

`ash
# Terminal 1 — Express legacy server
PORT=4000 node Backend/server.js

# Terminal 2 — NestJS application
PORT=3000 node Backend/dist/main.js   # after: npm run build
`

Set PORT explicitly so both processes do not accidentally bind to the same
socket.

---

*This document was generated as part of issue #561.*
