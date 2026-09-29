# MarketCap — implementation status and API contract

> **Phase owner:** Phase 2 (core market wiring) — see [PHASE_2.md](PHASE_2.md).
> **Ground truth:** `Contracts/src/MarketCap.sol`, `Contracts/test/MarketCap.t.sol`, `Contracts/script/DeployMarketCap.s.sol`.

This document replaces earlier completion claims that overstated production readiness.
It records what exists in the repository today and the on-chain API contract integrators
should rely on.

---

## Current status

| Surface | Status | Notes |
|---------|--------|-------|
| Solidity contract | Implemented | `Contracts/src/MarketCap.sol` |
| Forge tests | Implemented | `Contracts/test/MarketCap.t.sol` (18 unit + 1 fuzz) |
| Deploy script | Implemented | `Contracts/script/DeployMarketCap.s.sol` |
| Backend HTTP API | **Not wired** | No NestJS module or Express route reads MarketCap yet |
| Frontend integration | **Not wired** | No `NEXT_PUBLIC_*` address consumed for MarketCap |

There is **no** production deployment guarantee in this repo. Third-party audit and
mainnet deployment remain Phase 2 follow-ups.

---

## Environment and ports (Backend wiring)

When a Backend indexer or oracle later reads MarketCap on-chain, configure from
[`Backend/.env.example`](Backend/.env.example):

| Variable | Example | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | NestJS listen port (`main.ts` falls back to `3000` if unset) |
| `RPC_URL` | `http://127.0.0.1:8545` | JSON-RPC for contract reads |
| `BLOCKCHAIN_RPC_URL` | `https://rpc.mantle.xyz` | Oracle route RPC |
| `PRIVATE_KEY` | placeholder | Deploy/sign only — never commit real keys |
| `MARKET_CONTRACT_ADDRESS` | `0x000…000` | Generic market contract slot |
| `MAINNET_MARKET_ADDRESS` / `TESTNET_MARKET_ADDRESS` | optional | Chain-specific overrides |

Frontend defaults from [`Frontend/.env.example`](Frontend/.env.example):

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` |

Health check once Backend is running: `GET http://localhost:4000/api`.

---

## Deploy

Constructor takes **no arguments**; `Ownable(msg.sender)` makes the broadcaster the owner.

```bash
cd Contracts
export PRIVATE_KEY=0x...          # deployer key — see Backend/.env.example
export RPC_URL=http://127.0.0.1:8545
forge script script/DeployMarketCap.s.sol:DeployMarketCap \
  --rpc-url "$RPC_URL" --broadcast
```

ABI artifact: `Contracts/out/MarketCap.sol/MarketCap.json`.

Deploy order relative to other core contracts: see [`Contracts/README.md`](Contracts/README.md).

---

## On-chain API contract

All amounts use **18-decimal** fixed-point internally (`PRBMath UD60x18`). External
callers pass `uint256` values at 18-decimal scale unless noted.

### Write functions

| Function | Access | Description |
|----------|--------|-------------|
| `calculateMarketCap(marketId, price, totalSupply)` | anyone | Create or recalculate cap for a market |
| `updateMarketCap(marketId, price, totalSupply)` | anyone | Update an existing market (reverts if not found) |
| `setCapLimit(marketId, capLimit)` | `onlyOwner` | Enforce maximum cap |
| `setCapThreshold(marketId, threshold)` | `onlyOwner` | Register alert threshold |

### View functions

| Function | Returns |
|----------|---------|
| `getMarketCap(marketId)` | `(currentCap, previousCap, capLimit, totalSupply, price, lastUpdateTime, updateCount, peakCap, lowestCap, exists)` |
| `getCapChange(marketId)` | `(change, isIncrease)` |
| `getAllMarketIds()` | `uint256[]` |
| `marketExists(marketId)` | `bool` |
| `getTotalMarketCap()` | `uint256` |

### Custom errors

`ZeroMarketId`, `ZeroPrice`, `ZeroSupply`, `CapLimitExceeded`, `MarketNotFound`,
`InvalidBatchSize`, `InvalidThreshold`.

### Events

`MarketCapCalculated`, `MarketCapUpdated`, `CapLimitSet`, `CapThresholdReached`,
`PeakCapReached`, `BatchCapCalculated`.

---

## Verification

```bash
cd Contracts
forge test --match-contract MarketCapTest -vv
```

Targeted build:

```bash
forge build src/MarketCap.sol
```

---

## Related documentation

| Doc | Purpose |
|-----|---------|
| [Contracts/README.md](Contracts/README.md) | Layout, deploy order, import paths |
| [Contracts/MARKET_CAP_IMPLEMENTATION.md](Contracts/MARKET_CAP_IMPLEMENTATION.md) | Extended implementation notes (may be partially stale — prefer this file + source) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local run instructions for Backend/Frontend |
