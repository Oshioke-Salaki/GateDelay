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
