# Backend

The backend mixes a lightweight Express layer (`routes/`, `services/`, `models/`, all CommonJS), background services, and a newer Nest-based `src/` app.

> **Note on entrypoints.** There is no `Backend/server.js`; the Express *server* lives in the sibling lowercase `backend/` package. What sits under `Backend/` is the Express route and model layer, which the Nest app and the smoke scripts load directly. `npm run start:dev` (`nest start --watch`) is the canonical dev server for this package. `DUAL_ENTRYPOINTS.md` predates that split and still describes a `Backend/server.js` boot path that no longer exists. Start by copying `.env.example` to `.env` and filling in the placeholders for the services you plan to run.

## Required environment variables

These values should always be reviewed before local development or deployment:

- `JWT_SECRET` and `JWT_REFRESH_SECRET`: authentication secrets
- `MONGODB_URI`: primary application database
- `AVIATION_STACK_API_KEY`: live flight data provider
- `RPC_URL` or `BLOCKCHAIN_RPC_URL`: chain access for rollback and oracle flows
- `PRIVATE_KEY`: signer used by contract-facing backend jobs

Redis-backed workers also require either `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`.

## Trade executor

`Backend/jobs/tradeExecutor.js` starts the scheduled-trade worker. It loads the
Agenda scheduler and logs the environment, scheduler name, and whether MongoDB
configuration is present. The MongoDB URI itself is never written to logs.

Environment variables:

- `MONGODB_URI` - MongoDB connection used by Agenda and scheduled-trade models;
  defaults to `mongodb://localhost:27017/gatedelay` when unset.
- `NODE_ENV` - startup environment included in the executor log; defaults to
  `development`.

Run the module-load smoke check with:

```bash
npm run test:trade-executor
```

## Setup

```bash
npm install
```

## Run the Nest API

```bash
npm run start:dev
```

Run the legacy Express API from the repository root with `npm --prefix backend run start`.

## Market data and balances

The Nest market-data module uses AviationStack for flight queries and caches responses for five minutes. Set `AVIATION_STACK_API_KEY` in `.env`; requests are exposed at `/api/market-data/flights` and `/api/market-data/airlines`.

Balances are persisted by `models/Balance.js` and are shared by the Nest API and legacy Express routes:

- Nest: `GET /api/balances/:userId` and `GET /api/balances/:userId/:asset`
- Legacy: `GET /user/balance`, `/v1/users/balance`, and `/v2/users/balance` with the `userId` query parameter

Run the dependency-free module wiring smoke check from this directory:

```bash
npm run test:balance
```

The Nest scripts are also run from `Backend`:

```bash
npm run start:dev
npm run build
npm test
```
Use `npm run start:dev` for the NestJS development API. The migration REST API is owned by the Express entrypoint:

```bash
npm run express:dev
```

## Market migration API

The market migration is discovered from `backend/migrations/001_init_markets.js` and exposed under `/api/migrations` by Express:

- `GET /api/migrations/status` - show pending and applied migrations
- `POST /api/migrations/execute` with `{ "name": "001_init_markets" }` - create the markets table
- `POST /api/migrations/validate/001_init_markets` - verify migration integrity

Run its smoke check with:

```bash
npm run test:migration
```

Migration environment variables:

- `PORT` - Express port, default `4000`
- `MONGODB_URI` - optional MongoDB URI; SQLite-only migrations continue if MongoDB is unavailable
- `MIGRATIONS_DB_PATH` - optional SQLite file path, default `backend/data/migrations.sqlite`

## GateDelay Backend Setup

**For complete setup instructions, prerequisites, and troubleshooting, see [SETUP.md](./SETUP.md)**

### Quick Start

**Prerequisites**: Node.js >= 20.11, MongoDB, Redis

```bash
# 1. Install dependencies
$ npm install

# 2. Configure environment
$ cp .env.example .env
# Edit .env with your configuration

# 3. Start external services (MongoDB, Redis)

# 4. Build (⚠️ currently has build errors - see SETUP.md)
$ npm run build
```

## Project setup

```bash
$ npm install
```

## AML Compliance Endpoint

The backend includes an AML (Anti-Money Laundering) compliance route handler at `Backend/routes/aml.js`.

**Routes:**
- `POST /screen` — Screen a user against AML watchlists (requires auth)
- `POST /flag` — Record suspicious-activity flags (requires auth)
- `GET /report/:userId` — Generate a screening report for a date range (requires auth)
- `POST /file-report` — Submit regulatory filings (requires auth)

**Quick smoke test:**
```bash
npm run test:aml
```

See `Backend/routes/aml.js` and `Backend/services/amlService.js` for full inline documentation including the threat model and security assumptions.

## Approval Workflows

The backend includes a multi-step trade approval workflow handler at `Backend/routes/approvals.js`.

**Environment variable:**
- `APPROVAL_CRON_ENABLED` — Set to `"true"` to enable the background cron job that expires stale workflows every minute. Defaults to `false` (cron disabled), suitable for local development.

**Routes (9 endpoints, mount at `/approvals`):**
- `GET /approvals/stages` — List all approval stages with configuration
- `GET /approvals/history` — Get approval workflow history (optional filters)
- `GET /approvals/notifications` — Get pending notification queue
- `GET /approvals/trade/:tradeId` — Get workflows associated with a trade
- `GET /approvals/:workflowId` — Get full status of a specific workflow
- `POST /approvals` — Create a new approval workflow (requires `x-user-id` header)
- `POST /approvals/:workflowId/approve` — Submit an approval decision (requires `x-approver-id`, `x-approver-role` headers)
- `POST /approvals/delegate` — Delegate approval authority
- `DELETE /approvals/delegate` — Revoke a delegation

**Quick smoke test:**
```bash
npm run test:approvals
```

See `Backend/routes/approvals.js` and `Backend/services/approvalService.js` for full inline documentation.


## Beta Access

The backend includes a beta access management route handler at `Backend/routes/beta.js`.

**Routes (8 endpoints):**
- `GET /beta/features` — List available beta features
- `GET /beta/users` — List beta users (optional `?status=`, `?limit=`)
- `POST /beta/users` — Add a user to the beta list
- `DELETE /beta/users/:walletAddress` — Remove a user from the beta list
- `POST /beta/invite/accept` — Accept a beta invitation
- `GET /beta/access/:walletAddress` — Check beta access for a wallet
- `POST /beta/activity` — Track a beta activity event
- `GET /beta/activity/:walletAddress` — Get activity log for a wallet

**Quick smoke test:**
```bash
npm run test:beta
```

See `Backend/routes/beta.js` and `backend/services/betaAccess.js` for full inline documentation.

## Blacklist Management

The backend includes a blacklist management route handler at `Backend/routes/blacklist.js`.

**Routes (7 endpoints):**
- `POST /blacklist/add` — Add an identifier to the blacklist
- `POST /blacklist/remove` — Remove an identifier from the blacklist
- `GET /blacklist/check/:identifier` — Check if an identifier is blacklisted (no auth)
- `POST /blacklist/batch-add` — Batch add identifiers
- `POST /blacklist/batch-remove` — Batch remove identifiers
- `GET /blacklist/count` — Get total blacklisted entries
- `GET /blacklist/report` — Generate a report for a date range

**Quick smoke test:**
```bash
npm run test:blacklist
```

See `Backend/routes/blacklist.js` and `Backend/services/blacklistService.js` for full inline documentation.

## Disputes

Dispute lifecycle handling: `Backend/models/Dispute.js` (Mongoose schema),
`Backend/services/disputeService.js`, `Backend/routes/disputes.js`.

**Environment variables**

- `MONGODB_URI` — required. The model itself loads without a connection (the
  schema is declared eagerly), but every read/write through `disputeService`
  needs it.

No other variables are specific to this module.

**Status machine**

`DISPUTE_STATUSES` and `VALID_TRANSITIONS` are exported from the model and are
the single source of truth:

```
OPEN ──► UNDER_REVIEW ──► RESOLVED   (terminal)
  │            └────────► REJECTED   (terminal)
  └─────────────────────► REJECTED
```

`OPEN → RESOLVED` is deliberately not allowed: resolution must pass through
review, which is where `reviewStartedAt` is recorded.

**Scripts**

```bash
npm run test:disputes   # smoke: the route module loads and exits cleanly
npm run test:cjs        # schema, status-machine and validation tests
```

**Hot reload.** The model is exported as
`mongoose.models.Dispute || mongoose.model('Dispute', schema)`. Keep that guard:
`nest start --watch` re-requires the module on every change, and a bare
`mongoose.model(...)` throws `OverwriteModelError` on the second load, killing
the watcher mid-session. `test/disputeModel.test.js` pins this.

## Trade validation middleware

Express middleware guarding trade requests:
`Backend/middleware/tradeValidation.js`, backed by
`Backend/services/tradeValidator.js`.

**Exports** — `validateTradeRequest`, `validateTradeParameters`,
`validateTradeLimits`, `validateTradeBalance`, `validateMarketStatus`, and
`validateTrade(...validators)` to compose them.

**Environment variables**

None directly. The backing service reaches `Backend/models/Balance.js`, so
`MONGODB_URI` is required for `validateTradeBalance` and `validateTradeRequest`.
Limits are compile-time constants in `tradeValidator.TRADE_LIMITS`, not env
vars.

**Scripts**

```bash
npm run test:trade-validation   # smoke: the middleware module loads
npm run test:cjs                # limit, balance and combinator tests
npm run lint                    # see note below
```

**Linting.** `eslint.config.mjs` now carries a trailing `**/*.js` block that
turns off type-aware rules for the CommonJS half of the package. Without it
every `.js` file failed with *"was not found by the project service"* — they
were unlintable, not clean. Note that the `lint` script itself still only globs
`{src,apps,libs,test}/**/*.ts`, so `middleware/` is linted only when passed
explicitly:

```bash
npx eslint middleware/tradeValidation.js
```

## Rate limit configuration

`Backend/config/rateLimits.js` is the single CommonJS source of rate-limit rules
shared by the legacy Express limiter (`Backend/middleware/rateLimiter.js`) and the
Nest rate-limiter module (`Backend/src/rate-limiter/`). It is a plain data module —
requiring it has no side effects and opens no connections.

**Sections** — `tiers` (PUBLIC / BASIC / PREMIUM / VIP / ADMIN request budgets),
`endpoints` (per-endpoint, per-tier `{ max, windowMs }` overrides), `ipLimits`
(`global` and `strict` per-IP buckets), `whitelist`, `messages`, `headers`,
`redis`, `costs` (read / write / heavy operation weights), and `adaptive`
(load-based tightening, disabled by default).

**Environment variables**

| Variable | Required | Purpose |
|---|---|---|
| `RATE_LIMIT_WHITELIST` | No | Comma-separated IPs exempt from rate limiting. Empty/unset ⇒ `whitelist.ips` is `[]`. |

Everything else — tier budgets, window sizes, Redis prefix/TTL — is a
compile-time constant in this file, not an env var. Redis connection details for
the limiter store come from the standard `REDIS_HOST` / `REDIS_PORT` /
`REDIS_DB` vars read by `middleware/rateLimiter.js`.

**Scripts**

```bash
npm run test:rate-limits   # smoke: config module loads and every section/tier is present
npm test                   # runs src/rate-limits-config.spec.ts (shape + consistency checks)
```

## Health endpoints

## Deprecation middleware

`Backend/middleware/deprecation.js` is a CommonJS Express middleware. It uses the in-memory
`Backend/services/deprecationService.js` registry and requires no environment variables.
Endpoints are registered with `markDeprecated(endpoint, config)`; `config` must include
`deprecationDate`, `sunsetDate`, `alternative`, and `migrationGuide`. Sunset endpoints return
HTTP 410, while active deprecations receive `Warning`, `Deprecation`, and `Link` headers.

Verify that the module loads cleanly with:

```bash
npm run test:deprecation
```

The backend exposes health check endpoints for monitoring and CI/CD probes:

**Express server (port 4000):**
- `GET /health` - Basic health check with status and timestamp
- `GET /health/details` - Comprehensive health report including database, blockchain, Redis, and system components

**NestJS (port 3000):**
- `GET /api/health` - Basic health check with service info
- `GET /api/health/details` - Detailed health with uptime, memory, and environment info

## PagerDuty alerting

`Backend/services/pagerduty.js` sends/acknowledges/resolves PagerDuty incidents and syncs
on-call schedules. It reads its config from `Backend/config/pagerduty.js`, which in turn
reads three optional environment variables (`Backend/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `PAGERDUTY_API_KEY` | No | PagerDuty REST API key |
| `PAGERDUTY_SERVICE_ID` | No | Target service for alert routing |
| `PAGERDUTY_FROM_EMAIL` | No | Sender address on incident requests |

All three are optional — the app boots normally without them. If any is missing,
`config/pagerduty.js` logs a single `[pagerduty] Alerting is not fully configured` warning
at startup naming the missing variable(s), rather than only surfacing as an opaque
401/400 from the PagerDuty API the first time an alert is sent. Verify the module loads
cleanly with:

```bash
npm run test:pagerduty
```
## Market Status endpoints

The backend exposes market operational status and uptime tracking API endpoints:

**Express server (port 4000) or mounted at `/status`:**
- `GET /status/:marketId` — Retrieves current operational status (ACTIVE, PAUSED, MAINTENANCE, OFFLINE), uptime/downtime statistics, and last status change.
- `GET /status/:marketId/history` — Queries paginated history logs of status transitions for the market.
- `POST /status/:marketId/toggle` — Updates the operational status of the market (requires `x-operator-id` header).


## Compile and run the project

```bash
# NestJS development
$ npm run start

# NestJS watch mode
$ npm run start:dev

# NestJS debug mode
$ npm run start:debug

# NestJS production
$ npm run start:prod
```

## Route module verification (`Backend/routes/api.example.js`)

Use this canonical path from repo root:

```bash
cd Backend
npm install
npm run test:api-example
```

Expected console output includes:

```text
[api.example.js] Initializing API example routes...
```

## Build the project

```bash
$ npm run build
```

## Run tests

```bash
# unit tests
$ npm run test

# watch mode
$ npm run test:watch

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

# debug tests
$ npm run test:debug
```

The default Express entrypoint listens on `PORT` and serves:

- `/health`
- `/api/migrations`
- `/api/rollback`
- `/api/beta`
- `/api/oncall`
- `/api/upgrades`

## Notes

- `.env.example` intentionally contains placeholders only; do not commit real secrets.
- Several advanced integrations such as PagerDuty, Twilio, IPFS, Polygon/Mainnet/Testnet addresses, and Firebase are optional unless you enable those workflows.
