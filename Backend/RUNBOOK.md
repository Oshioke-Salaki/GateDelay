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
