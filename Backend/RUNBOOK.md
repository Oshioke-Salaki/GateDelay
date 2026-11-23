# GateDelay Backend Runbook

This is the canonical backend startup reference. Prefer the NestJS app for local development and production. The legacy Express entrypoint exists only for CommonJS routes that have not been migrated yet.

## Entrypoints

| Runtime | Command | Default port | Purpose |
|---|---:|---:|---|
| NestJS API | `npm run start:dev` | `4000` from `.env.example`, `4000` fallback in `src/main.ts` | Canonical development API |
| NestJS production | `npm run build && npm run start:prod` | `4000` from env | Canonical production API |
| Legacy Express | `npm run express:dev` | `4000` | Migration, rollback, restore, beta, on-call, upgrade routes until migrated |
| Heartbeat server | started by the legacy Express entrypoint | `4001` | MarketFactory heartbeat/event operations |

Do not run NestJS and legacy Express on the same `PORT` at the same time. If both are needed locally, set one runtime to another port.

## Required Setup

```bash
cd Backend
npm install
cp .env.example .env
```

Start MongoDB and Redis before booting the API:

```bash
mongod
redis-server
```

Minimum local variables:

| Variable | Default/example | Purpose |
|---|---|---|
| `PORT` | `4000` | Backend HTTP port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/gatedelay` | MongoDB connection |
| `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` | `redis://127.0.0.1:6379` | Redis cache/rate-limit/job state |
| `RPC_URL` or `BLOCKCHAIN_RPC_URL` | `http://127.0.0.1:8545` / Mantle RPC | Blockchain health and contract-facing services |
| `AVIATION_STACK_API_KEY` | provider key | Live flight data |
| `GROQ_API_KEY` | provider key | AI analysis provider |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | strong secrets | Auth token signing |

Provider keys may be omitted in development, but health checks will report the related dependency as `DEGRADED`.

## MarketFactory event indexing

The Nest market catalog indexes `MarketCreated` events from every
`MarketFactory` entry in `DEPLOYMENT_REGISTRY_JSON` whose `chainId` matches
`BLOCKCHAIN_RPC_URL`. Set `MARKET_FACTORY_START_BLOCK` to the factory deployment
block to avoid scanning older chain history on the first run; it defaults to
block `0`. Existing checkpoints are retained when this value changes.

The indexer waits for two confirmations, scans bounded block ranges, and stores
per-chain/factory checkpoints in MongoDB alongside the market catalog. A failed
event leaves its block range uncheckpointed so the next poll can retry it.
Duplicate logs are safe to replay because discovered markets are inserted
idempotently by market address. A single `BLOCKCHAIN_RPC_URL` can index only
deployments on that RPC's chain; deployments for other chains are skipped and
logged.

The market list reads YES/NO prices and available liquidity from the canonical
`MarketMaker` contract. Trading volume (`tradingVolumeWindow: ALL_TIME`) is the
cumulative collateral amount in canonical `SharesBought`/`SharesSold` events
since the market's indexed creation block. Buy fee basis points come from a
configured `Trading` deployment only when it references that same MarketMaker;
the canonical sell fee is zero.
Values include exact `*BaseUnits` fields; unavailable sources are returned as
`null`, not inferred from unrelated spot trades or stake totals.

Markets are automatically resolved only when they include valid
`resolutionCriteria` in inline factory metadata or signed webhook metadata:
`{"type":"flight_departure_delay","flightIata":"AA123","scheduledDeparture":"2026-11-22T12:00:00.000Z","delayThresholdMinutes":15,"delayedOutcome":"YES"}`.
The resolver requires exactly one AviationStack record matching the IATA code
and scheduled departure, an active or landed flight status, and a valid actual
departure timestamp. `YES`/`NO` is assigned according to whether the observed
departure delay (rounded to whole minutes) exceeds the configured threshold.
Missing, ambiguous, malformed, or unavailable evidence leaves the market active
for a later retry; titles are never used as resolution evidence.

## Off-chain CLOB matching

The `trade-engine` and legacy `orders` matcher accept orders only when both the
`venueId` and generic token `pair` appear in `CLOB_VENUES`. Configure it as a
JSON array, for example
`[{"id":"spot-clob","pairs":["ETH-USDT","BTC-USDT"]}]`. Leave it empty to
disable off-chain matching. Order-book reads require the same venue and pair.
Responses label executions as CLOB and `NOT_ON_CHAIN`; they are not prediction
market positions and do not represent LMSR settlement.

## Health Endpoints

NestJS:

- `GET /api/health/live` - process liveness only
- `GET /api/health` - summarized dependency status
- `GET /api/health/details` - MongoDB, Redis, RPC, AviationStack, AI provider, and process metrics

Legacy Express:

- `GET /health/live`
- `GET /health`
- `GET /health/details`
- `GET /api/health`
- `GET /api/health/details`

Health responses use `UP`, `DEGRADED`, or `DOWN`. MongoDB down makes the whole service `DOWN`; optional providers and RPC/Redis failures make it `DEGRADED` unless a route depends on them directly.

## Observability Contract

All HTTP requests receive an `x-request-id` response header. Incoming `x-request-id` or `x-correlation-id` is propagated when present; otherwise the backend generates one.

REST errors use this envelope:

```json
{
  "error": {
    "code": "REQUEST_FAILED",
    "message": "Human-readable message",
    "details": null,
    "requestId": "uuid-or-forwarded-id",
    "timestamp": "2026-09-26T00:00:00.000Z"
  }
}
```

Background jobs should use `utils/correlation.withJobContext(...)` and `utils/correlation.log(...)` so job logs can be joined back to API requests or scheduler runs.

## Operational Incidents

Release failure, rollback, and circuit-breaker activation procedures live in
[docs/OPERATIONAL_RUNBOOKS.md](./docs/OPERATIONAL_RUNBOOKS.md). Keep those
steps with incident records so deploy health, restored image tags, emergency
controls, and escalation decisions are auditable.
