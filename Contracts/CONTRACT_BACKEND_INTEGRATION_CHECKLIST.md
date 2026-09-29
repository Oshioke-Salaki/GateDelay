# Contract-to-Backend Integration Checklist

This checklist covers the bridge between on-chain contracts and the NestJS/Express
backend. Work through it after any contract change that adds, removes, or renames
events, and after any backend change that touches event indexing, DTOs, or state
transitions.

---

## 1. Emitted Events → Backend Indexers

For each event in the table below confirm that:
- The event **signature** in `src/` matches the ABI the backend decodes.
- The backend indexer (service / job) subscribes to the correct topic hash.
- Every indexed parameter is used in a DB query or filter.

### MarketMaker / Trading

| Event | Signature | Backend subscriber | DB model / field |
|-------|-----------|--------------------|------------------|
| `MarketCreated` | `MarketCreated(uint256 indexed marketId, address indexed creator, uint256 numOutcomes, uint256 b)` | `marketFactoryEvents.js` | `MarketSnapshot.marketId`, `creator` |
| `SharesBought` | `SharesBought(uint256 indexed marketId, address indexed buyer, uint256 outcome, uint256 shares, uint256 cost)` | `tradeEngine.js` | `OnChainTrade.marketId`, `buyer`, `outcome`, `shares`, `cost` |
| `SharesSold` | `SharesSold(uint256 indexed marketId, address indexed seller, uint256 outcome, uint256 shares, uint256 proceeds)` | `tradeEngine.js` | `OnChainTrade.marketId`, `seller`, `outcome`, `shares`, `proceeds` |
| `MarketResolved` | `MarketResolved(uint256 indexed marketId, uint256 winningOutcome)` | `statusService.js` | `MarketSnapshot.resolved`, `winningOutcome` |
| `Redeemed` | `Redeemed(uint256 indexed marketId, address indexed user, uint256 payout)` | `claimService.js` | Claim receipt, `payout` |

### RoleManager

| Event | Signature | Backend subscriber | DB model / field |
|-------|-----------|--------------------|------------------|
| `RoleCreated` | `RoleCreated(bytes32 indexed role)` | `auditTrail.js` | `AuditLog.event = "RoleCreated"` |
| `RoleAssigned` | `RoleAssigned(bytes32 indexed role, address indexed account)` | `auditTrail.js` | `AuditLog.event = "RoleAssigned"` |
| `RoleUnassigned` | `RoleUnassigned(bytes32 indexed role, address indexed account)` | `auditTrail.js` | `AuditLog.event = "RoleUnassigned"` |

### EmergencyStop / CircuitBreaker

| Event | Signature | Backend subscriber | DB model / field |
|-------|-----------|--------------------|------------------|
| `EmergencyActivated` (EmergencyStop) | contract-specific — verify in `src/EmergencyStop.sol` | `breakerService.js` | alert + pause cascade |
| `Paused` / `Unpaused` (PausableMarket) | OZ standard | `pauseService.js` | market status update |
| `BreakerTripped` (CircuitBreaker) | contract-specific — verify in `src/CircuitBreaker.sol` | `breakerService.js` | `MarketSnapshot.paused = true` |

### MarketBridge / BridgeConnector

| Event | Signature | Backend subscriber | DB model / field |
|-------|-----------|--------------------|------------------|
| Bridge initiation event | verify in `src/MarketBridge.sol` | `bridgeService.js` | `BridgeTransaction.sourceTxHash` |
| Bridge completion event | verify in `src/MarketBridge.sol` | `bridgeService.js` | `BridgeTransaction.status = "completed"` |

---

## 2. Backend DTO Fields

Each DTO must mirror the on-chain event or storage slot it represents.
Confirm field names, types, and validation rules match.

### OnChainTrade (Backend model / event payload)

| Field | Solidity type | JS/TS type | DTO validation |
|-------|--------------|------------|----------------|
| `marketId` | `uint256` | `string` (BigInt serialised) | required, numeric string |
| `buyer` / `seller` | `address` | `string` | required, `0x[0-9a-fA-F]{40}` |
| `outcome` | `uint256` | `number` | required, non-negative integer |
| `shares` | `uint256` | `string` (BigInt serialised) | required, numeric string |
| `cost` / `proceeds` | `uint256` | `string` | required, numeric string |
| `blockNumber` | – | `number` | required |
| `txHash` | – | `string` | required, `0x[0-9a-fA-F]{64}` |
| `timestamp` | – | `Date` | required |

### MarketSnapshot (status / resolution)

| Field | Source | JS/TS type | Notes |
|-------|--------|------------|-------|
| `marketId` | `MarketCreated` | `string` | primary key |
| `description` | `Market.description` (storage) | `string` | synced on creation |
| `numOutcomes` | `Market.numOutcomes` | `number` | |
| `resolved` | `MarketResolved` | `boolean` | false until event |
| `winningOutcome` | `MarketResolved` | `number \| null` | null until resolved |
| `status` | `Paused` / `BreakerTripped` | `'ACTIVE' \| 'PAUSED' \| 'MAINTENANCE' \| 'OFFLINE'` | mirrors `MARKET_STATUSES` in `dto/marketStatus.dto.js` |

### BridgeTransaction DTO (mirrors `Frontend/lib/bridgeApi.ts`)

| Field | JS/TS type | Required | Notes |
|-------|------------|----------|-------|
| `id` | `string` | ✅ | UUID |
| `protocol` | `BridgeProtocol` | ✅ | enum: stargate \| across \| hop \| cbridge \| socket |
| `fromChainId` / `toChainId` | `number` | ✅ | |
| `tokenSymbol` | `string` | ✅ | |
| `amount` | `string` | ✅ | wei-denominated string |
| `status` | `BridgeStatus` | ✅ | enum: pending \| approving \| bridging \| confirming \| completed \| failed \| refunded |
| `sourceTxHash` | `string \| undefined` | ❌ | set when bridge tx is submitted |
| `destinationTxHash` | `string \| undefined` | ❌ | set on completion |
| `errorMessage` | `string \| undefined` | ❌ | set on failure |

---

## 3. State Transitions Expected by Backend Indexers

The backend must be resilient to out-of-order events (chain re-orgs, missed
blocks). Confirm each transition is idempotent.

### Market lifecycle

```
CREATED ──► ACTIVE ──► PAUSED ──► ACTIVE   (circuit-breaker / admin)
                  └──► RESOLVED            (MarketResolved event)
```

| Transition | Trigger event | Backend action | Idempotent? |
|------------|--------------|----------------|-------------|
| `→ CREATED` | `MarketCreated` | Insert `MarketSnapshot` | ✅ (upsert on `marketId`) |
| `→ ACTIVE` | Deployment / unpaused | Set `status = ACTIVE` | ✅ |
| `→ PAUSED` | `Paused` / `BreakerTripped` | Set `status = PAUSED`, alert | ✅ |
| `→ RESOLVED` | `MarketResolved` | Set `resolved = true`, `winningOutcome` | ✅ |

### Bridge transaction lifecycle

```
pending ──► approving ──► bridging ──► confirming ──► completed
       └──────────────────────────────────────────── failed ──► refunded
```

| Transition | Trigger | Notes |
|------------|---------|-------|
| `pending → approving` | user submits token approval tx | |
| `approving → bridging` | `sourceTxHash` set | |
| `bridging → confirming` | source chain confirmations reach threshold | |
| `confirming → completed` | `destinationTxHash` set | |
| `any → failed` | error from bridge protocol | `errorMessage` must be populated |
| `failed → refunded` | refund tx confirmed | |

---

## 4. ABI Freshness

| Check | Status | Notes |
|-------|--------|-------|
| ABI files in `Frontend/` / `Backend/` match the compiled output in `Contracts/out/` | | |
| `abiVersion` in `deployments/registry.json` is bumped after any ABI-breaking change | | |
| Backend event decoders reference the canonical ABI, not hand-copied fragments | | |
| Frontend `wagmi`/`viem` hook ABIs are regenerated after any event or function signature change | | |

---

## 5. Integration Test Coverage

| Test file | Covers |
|-----------|--------|
| `Backend/test/bridge.test.js` | Bridge service event handling |
| `Contracts/test/MarketBridge.t.sol` | On-chain bridge events |
| `Contracts/test/MarketRelay.t.sol` | Cross-chain relay events |
| `Contracts/test/MarketMaker.t.sol` | `MarketCreated`, `SharesBought`, `SharesSold`, `MarketResolved`, `Redeemed` |
| `Contracts/test/RoleManager.t.sol` | `RoleCreated`, `RoleAssigned`, `RoleUnassigned` |

**Action:** Add an integration test (`Contracts/test/integration/`) that deploys
contracts, fires transactions, and asserts the emitted event topics and argument
encoding match what the backend ABI decoder expects.

---

**Template version:** 1.0  
**Reference issues:** #975  
**Related documents:** `Contracts/INTEGRATION_GUIDE.md`, `Backend/dto/`, `docs/adr/0001-lmsr-vs-clob-ambiguity.md`
