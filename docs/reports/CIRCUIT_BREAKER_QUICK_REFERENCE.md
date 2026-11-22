# Circuit Breaker — quick reference and API contract

> **Phase owner:** Phase 2 (core market wiring) — see [PHASE_2.md](PHASE_2.md).
> **Ground truth:** `Contracts/src/CircuitBreaker.sol`, `test/CircuitBreaker.t.sol`,
> `Backend/services/breakerService.js`, `Backend/routes/circuitBreaker.js`.

Earlier versions of this document claimed full production completion with inflated test
counts. This reference matches the codebase as of Phase 2.

---

## Files

| Artifact | Path | Lines (approx.) |
|----------|------|-----------------|
| On-chain contract | `Contracts/src/CircuitBreaker.sol` | ~277 |
| Forge tests | `test/CircuitBreaker.t.sol` | ~554 (37 test functions) |
| Backend service | `Backend/services/breakerService.js` | Redis-backed breaker state |
| Express routes | `Backend/routes/circuitBreaker.js` | REST handlers (mount pending in `server.js`) |

Run tests from repo root (legacy test tree):

```bash
forge test --match-contract CircuitBreakerTest -vv
```

Or from `Contracts/` if your Foundry profile includes the root `test/` remapping.

---

## Environment and ports

Backend breaker service reads from [`Backend/.env.example`](Backend/.env.example):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | API listen port when Express/NestJS is running |
| `REDIS_HOST` | `127.0.0.1` | Breaker state persistence |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Logical DB for breaker keys (`breaker:<service>`) |
| `HEARTBEAT_PORT` | `4001` | Operational heartbeat (separate from main API) |

Without Redis, `breakerService.js` falls back to an in-memory store (single-process only).

Frontend WebSocket/API defaults: `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` per
[`Frontend/.env.example`](Frontend/.env.example).

---

## On-chain API (`CircuitBreaker.sol`)

Constructor takes **no arguments**. Grants `DEFAULT_ADMIN_ROLE`, `BREAKER_ROLE`, and
`MONITOR_ROLE` to `msg.sender`.

### Health recording (`MONITOR_ROLE`)

```solidity
recordSuccess()
recordFailure(string reason)
```

### Break control (`BREAKER_ROLE`)

```solidity
triggerBreak(string reason)
attemptRecovery()
```

### Configuration (`DEFAULT_ADMIN_ROLE`)

```solidity
setFailureThreshold(uint256)       // default: 5
setFailureRateThreshold(uint256)   // default: 50 (%)
setRecoveryTimeout(uint256)        // default: 1 hour
setHealthCheckWindow(uint256)      // default: 24 hours
resetMetrics()
grantBreakerRole(address) / revokeBreakerRole(address)
grantMonitorRole(address) / revokeMonitorRole(address)
```

### Status queries (anyone)

```solidity
getStatus()           // (state, failures, successes, total, health%, isHealthy)
getRecoveryInfo()     // (state, timeSinceBreak, timeUntilRecovery, recoveryReady)
getFailureMetrics()   // (totalFailures, failureRate, lastFailureTime, lastSuccessTime)
isCircuitOpen() / isCircuitHalfOpen() / isCircuitClosed()
```

### State machine

```
CLOSED → (threshold exceeded) → OPEN → (timeout + attemptRecovery) → HALF_OPEN
HALF_OPEN → (recordSuccess) → CLOSED
HALF_OPEN → (recordFailure) → OPEN
```

### Defaults

| Parameter | Default |
|-----------|---------|
| `failureThreshold` | 5 |
| `failureRateThreshold` | 50 (%) |
| `recoveryTimeout` | 1 hour |
| `healthCheckWindow` | 24 hours |

---

## Backend HTTP API (`Backend/routes/circuitBreaker.js`)

These routes mirror the on-chain pattern for off-chain services. **Mount them** under
`/api/circuit-breaker` in `Backend/server.js` or the NestJS app before calling them
from production — the route module exists but is not registered in the minimal
Express bootstrap checked into this repo.

| Method | Path | Body / params | Response |
|--------|------|---------------|----------|
| `GET` | `/status` | — | All monitored services + summary counts |
| `GET` | `/status/:serviceName` | — | Single service state |
| `GET` | `/check/:serviceName` | — | `{ allowed, state, reason?, retryAfter? }` |
| `POST` | `/trip` | `{ serviceName, reason? }` | Tripped state |
| `POST` | `/reset` | `{ serviceName }` | Reset one breaker |
| `POST` | `/reset-all` | — | Reset all monitored services |
| `POST` | `/isolate` | `{ serviceName, reason? }` | Force open |
| `GET` | `/history` | `?serviceName&action&limit` | Activation history |
| `GET` | `/config` | — | `BREAKER_CONFIG` |
| `POST` | `/config` | partial config object | Updated config |

Monitored services (default): `trade-engine`, `balance-service`, `oracle-service`,
`liquidation-service`, `blockchain-service`, `market-data`.

Backend config defaults (`breakerService.js`):

| Key | Value |
|-----|-------|
| `FAILURE_THRESHOLD` | 5 |
| `SUCCESS_THRESHOLD` | 2 (half-open → closed) |
| `TIMEOUT_MS` | 60_000 |
| `RESET_TIMEOUT_MS` | 300_000 |

---

## Usage (on-chain)

```solidity
CircuitBreaker cb = new CircuitBreaker();
cb.grantBreakerRole(breaker);
cb.grantMonitorRole(monitor);

// monitor path
cb.recordFailure("upstream timeout");

// status
(,,,, uint256 health, bool isHealthy) = cb.getStatus();

// recovery
if (cb.isCircuitOpen()) {
    (,,, bool recoveryReady) = cb.getRecoveryInfo();
    if (recoveryReady) cb.attemptRecovery();
}
```

---

## Verification

```bash
forge test --match-contract CircuitBreakerTest -vv
```

For extended narrative (partially stale): [CIRCUIT_BREAKER_IMPLEMENTATION.md](CIRCUIT_BREAKER_IMPLEMENTATION.md).
