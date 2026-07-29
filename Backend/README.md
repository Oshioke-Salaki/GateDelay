# GateDelay Backend

Node.js/TypeScript backend for the GateDelay flight-delay derivatives platform.

---

## Architecture overview

The backend has two layers that co-exist in this repository:

| Layer | Entry point | Status |
|---|---|---|
| **Express** (Phase 1) | `server.js` | ✅ Runnable today |
| **NestJS** (Phase 2) | `src/main.ts` | 🚧 Dependencies not yet installed |

Phase 1 is the currently active server. Phase 2 (`src/main.ts`) is scaffolded and fully authored but requires additional dependency installation before it can be compiled or run — see [Phase 2 – NestJS boot path](#phase-2--nestjs-boot-path) below.

---

## Phase 1 – Express boot path (active)

### Prerequisites

- Node.js ≥ 20
- MongoDB running locally (default: `mongodb://localhost:27017/gatedelay`) or a remote URI
- Redis running locally (default: `localhost:6379`)

### Install and run

```bash
# from the Backend/ directory
cp .env.example .env        # fill in secrets — see Environment variables below
npm install
npm start                   # node server.js  →  http://localhost:4000
npm run dev                 # node --watch server.js (restarts on file change)
```

Health check:

```
GET http://localhost:4000/health
→ { "status": "ok", "timestamp": "..." }
```

### What server.js provides

- `GET  /health` – liveness probe
- `POST /api/upgrades` – create an upgrade job
- `POST /api/upgrades/:id/start` – execute an upgrade
- `GET  /api/upgrades` / `GET /api/upgrades/:id` – status
- `POST /api/upgrades/:id/rollback` – rollback
- `*    /api/migrations` – migration routes
- `*    /api/rollback` – rollback routes
- `*    /api/beta` – beta-feature routes
- `*    /api/oncall` – on-call routes

---

## Phase 2 – NestJS boot path

> **Blocked on dependency install.** The source is complete (`src/main.ts`,
> `src/app.module.ts`, and all feature modules), but none of the `@nestjs/*`
> packages are in `package.json` yet. The steps below unblock the full NestJS
> stack.

### Step 1 — install NestJS dependencies

```bash
# Core runtime
npm install @nestjs/core @nestjs/common @nestjs/platform-express reflect-metadata rxjs

# Feature modules used by app.module.ts
npm install @nestjs/config @nestjs/mongoose @nestjs/cache-manager @nestjs/schedule @nestjs/throttler
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local
npm install @keyv/redis mongoose ioredis

# Dev / build toolchain
npm install --save-dev typescript ts-node @nestjs/cli @nestjs/schematics
npm install --save-dev @types/node @types/express @types/passport-jwt @types/passport-local
```

### Step 2 — fix tsconfig for NestJS

`tsconfig.json` currently uses `"module": "nodenext"` which requires explicit
`.js` extensions on all relative imports. NestJS scaffolded imports don't
include them. Change the relevant lines:

```jsonc
// tsconfig.json  — change these two values:
"module": "commonjs",
"moduleResolution": "node",
// and add:
"rootDir": "./src"
```

### Step 3 — add scripts to package.json

```jsonc
"scripts": {
  "start":       "node server.js",
  "dev":         "node --watch server.js",
  "build":       "nest build",
  "start:dev":   "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod":  "node dist/main"
}
```

### Step 4 — run the NestJS server

```bash
npm run build       # compiles src/ → dist/
npm run start:dev   # ts-node watch mode  →  http://localhost:3000
npm run start:prod  # node dist/main      →  http://localhost:3000
```

NestJS listens on `PORT` (default **3000**); Express listens on `PORT` (default
**4000**). Set different `PORT` values if running both at once.

### NestJS boot dependencies

| Package | Purpose |
|---|---|
| `@nestjs/core` | `NestFactory`, application lifecycle |
| `@nestjs/common` | `ValidationPipe`, guards, decorators |
| `@nestjs/platform-express` | Default HTTP adapter |
| `reflect-metadata` | Decorator metadata (required by NestJS) |
| `@nestjs/config` | `ConfigModule` / `ConfigService` — env vars |
| `@nestjs/mongoose` | `MongooseModule` — MongoDB ODM |
| `@nestjs/cache-manager` | `CacheModule` with Redis store |
| `@nestjs/schedule` | `ScheduleModule` — cron jobs |
| `@nestjs/throttler` | `ThrottlerModule` — rate limiting |
| `@nestjs/jwt` / `@nestjs/passport` | Auth module |
| `@keyv/redis` | Redis Keyv adapter for CacheModule |

### External services required at startup

| Service | Default | Module that fails without it |
|---|---|---|
| MongoDB | `mongodb://localhost:27017/gatedelay` | `MongooseModule` |
| Redis | `localhost:6379` | `CacheModule` (Keyv adapter) |

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values before starting either server.

| Variable | Default | Required for |
|---|---|---|
| `PORT` | 3000 (NestJS) / 4000 (Express) | Both |
| `FRONTEND_URL` | `*` | NestJS CORS |
| `MONGODB_URI` | `mongodb://localhost:27017/gatedelay` | Both |
| `REDIS_HOST` | `localhost` | NestJS CacheModule |
| `REDIS_PORT` | `6379` | NestJS CacheModule |
| `JWT_SECRET` | — | NestJS AuthModule |
| `JWT_REFRESH_SECRET` | — | NestJS AuthModule |
| `JWT_EXPIRES_IN` | `15m` | NestJS AuthModule |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | NestJS AuthModule |
| `AVIATION_STACK_API_KEY` | — | Flight data feeds |
| `BLOCKCHAIN_RPC_URL` | `https://rpc.mantle.xyz` | BlockchainModule |
| `BLOCKCHAIN_CHAIN_ID` | `5000` | BlockchainModule |
| `GROQ_API_KEY` | — | AiModule |
| `ETHERSCAN_API_KEY` | — | Gas estimation (optional) |
| `FIREBASE_SERVICE_ACCOUNT` | — | Push notifications (optional) |
| `SMTP_HOST/PORT/USER/PASS` | — | Email (password reset) |

---

## Project structure

```
Backend/
├── src/                    # NestJS TypeScript application (Phase 2)
│   ├── main.ts             # NestJS entry point
│   ├── app.module.ts       # Root module — imports all feature modules
│   ├── auth/
│   ├── market-data/
│   ├── blockchain/
│   └── … (40+ feature modules)
├── routes/                 # Express route handlers (Phase 1)
├── middleware/             # Express middleware (Phase 1)
├── jobs/                   # Background job workers (Phase 1)
├── models/                 # Mongoose models (Phase 1)
├── services/               # Business logic (Phase 1)
├── workers/                # Queue workers (Phase 1)
├── config/                 # Rate limit / PagerDuty config
├── migrations/             # DB migration scripts
├── server.js               # Express entry point (Phase 1 — active)
├── heartbeatServer.js      # Standalone heartbeat/health server
├── nest-cli.json           # NestJS CLI config (Phase 2)
├── tsconfig.json           # TypeScript compiler config
├── tsconfig.build.json     # Build-time tsconfig (excludes tests)
└── .env.example            # Environment variable template
```

---

## Known issues / Phase 2 blockers

1. **No `@nestjs/*` packages in `package.json`** — `tsc` and `nest build` both
   fail until the dependency set above is installed.
2. **`"module": "nodenext"` in tsconfig** — requires `.js` extensions on all
   relative imports; switch to `"commonjs"` for NestJS compatibility.
3. **Missing `start:dev` / `build` / `start:prod` scripts** — add them per Step
   3 above. Current `npm start` and `npm run dev` only launch `server.js`.
4. **Port collision** — both servers default to the `PORT` env var. Set
   distinct values when running both simultaneously.
