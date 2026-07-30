# Backend

The backend mixes a lightweight Express API (`server.js`), background services, and a newer Nest-based `src/` app. Start by copying `.env.example` to `.env` and filling in the placeholders for the services you plan to run.

## Required environment variables

These values should always be reviewed before local development or deployment:

- `JWT_SECRET` and `JWT_REFRESH_SECRET`: authentication secrets
- `MONGODB_URI`: primary application database
- `AVIATION_STACK_API_KEY`: live flight data provider
- `RPC_URL` or `BLOCKCHAIN_RPC_URL`: chain access for rollback and oracle flows
- `PRIVATE_KEY`: signer used by contract-facing backend jobs

Redis-backed workers also require either `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
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

Node.js/TypeScript backend for the GateDelay flight-delay derivatives platform.

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

## Health endpoints

The backend exposes health check endpoints for monitoring and CI/CD probes:

**Express server (port 4000):**
- `GET /health` - Basic health check with status and timestamp
- `GET /health/details` - Comprehensive health report including database, blockchain, Redis, and system components

**NestJS (port 3000):**
- `GET /api/health` - Basic health check with service info
- `GET /api/health/details` - Detailed health with uptime, memory, and environment info

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
GET http://localhost:4000/health
→ { "status": "ok", "timestamp": "..." }
```

### What server.js provides

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
