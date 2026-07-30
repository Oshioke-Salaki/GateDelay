# Market Relay System Implementation Guide

## Overview

The **MarketRelay** contract is a comprehensive cross-chain market relay system for GateDelay, leveraging Chainlink CCIP (Cross-Chain Interoperability Protocol) for secure cross-chain messaging. It provides robust handling of relay operations with complete lifecycle management, timeout handling, retry logic, and comprehensive history tracking.

## Architecture & Design

### Core Components

1. **Relay Operations**: Independent units of work sent across chains
2. **Status Tracking**: Seven distinct states tracking operation lifecycle
3. **Timeout Management**: Automatic detection and enforcement of operation timeouts
4. **History System**: Complete audit trail of all relay operations
5. **Fee Management**: Configurable flat and proportional fees per chain

### Key Design Decisions

#### 1. Status State Machine

```
Pending → Executing → Completed
         ↓         ↗
       Pending → Failed (with retries)
         ↓
      Timeout (after expiration)
         ↓
    Cancelled (by initiator)
```

The seven status enum values are:
- `None` (0): Default, operation doesn't exist
- `Pending` (1): Awaiting execution
- `Executing` (2): Currently executing
- `Completed` (3): Successfully finished
- `Failed` (4): Execution failed
- `Timeout` (5): Operation expired
- `Cancelled` (6): User cancelled

#### 2. Timeout Implementation

Timeouts are calculated at initiation:
```solidity
timeoutAt = block.timestamp + chainConfig.defaultTimeout
```

The `checkTimeout()` function can be called by any address to mark operations as timed out after the deadline passes. This is gas-efficient as it doesn't require active polling.

#### 3. Retry Mechanism

On failure, if `attempts < maxRetries`:
- Status reverts to `Pending`
- `attempts` increments
- `timeoutAt` is extended: `block.timestamp + retryDelay + defaultTimeout`

After `maxRetries` exceeded, the operation is marked `Failed` permanently.

#### 4. Fee Structure

Total fee = `baseFee + (value * feeBps / 10000)`

Example:
- Chain Base: 0.1 ETH base fee + 1% (100 bps)
- Relaying 100 ETH: 0.1 + (100 * 100 / 10000) = 0.1 + 1 = 1.1 ETH total fee

### Chainlink CCIP Integration

The contract integrates with Chainlink CCIP through:

```solidity
interface IRelayRouter {
    function relayMessage(
        uint64 destChainSelector,
        RelayClient.RelayMessage calldata message
    ) external payable returns (bytes32 messageId);
}
```

The CCIP router:
- Validates chain support
- Calculates fees
- Returns unique message ID for tracking
- Handles actual cross-chain delivery

## Operational Flow

### 1. Chain Configuration

```solidity
// Owner configures supported chains
relay.configureChain(
    CHAIN_BASE,                  // Chain selector
    1 hours,                      // Default timeout
    3,                            // Max retries
    5 minutes,                    // Retry delay
    0.01 ether,                   // Base fee
    50                            // 0.5% fee in basis points
);
```

### 2. Initiating a Relay

```solidity
// User initiates operation
bytes memory operationData = abi.encode(
    targetAddress,
    functionSelector,
    parameters
);

bytes32 operationId = relay.initiateRelay{value: totalFee}(
    CHAIN_BASE,
    operationData,
    stateChangeValue  // optional, for operations with value transfers
);
```

The function:
1. Validates chain support
2. Calculates fees
3. Transfers fees to feeRecipient
4. Sends message via CCIP router
5. Records operation in pending state
6. Returns unique operationId

### 3. Status Updates (Off-Chain Relay)

```solidity
// Relayer monitors CCIP callbacks
// When message is received on destination chain:

// Mark as executing
relay.updateRelayExecuting(operationId);

// Execute the operation (on destination chain)
// ... actual operation execution ...

// Mark as completed
relay.completeRelay(operationId, resultData);
```

Or on failure:
```solidity
relay.failRelay(operationId, "error reason");
// If retries available: status → Pending, attempts++
// If retries exhausted: status → Failed
```

### 4. Timeout Handling

```solidity
// Anyone can check for timeouts
relay.checkTimeout(operationId);
// If block.timestamp > timeoutAt and status not completed:
//   status → Timeout
```

### 5. Querying State

```solidity
// Get operation status
RelayStatus status = relay.getRelayStatus(operationId);

// Get full operation details
RelayOperation memory op = relay.getRelayOperation(operationId);

// Get history
RelayHistory memory history = relay.getRelayHistory(operationId);

// Get pending operations
bytes32[] memory pending = relay.getPendingRelaysByInitiator(userAddress);
bytes32[] memory chainPending = relay.getPendingRelaysByChain(CHAIN_BASE);

// Get operations needing timeout check
bytes32[] memory expired = relay.getExpiredRelays();
```

## Security Analysis

### 1. Access Control

**✓ Implemented**:
- Owner-only functions for chain configuration
- Relayer-only functions for status updates
- Initiator-only functions for cancellation

**Design**: Three-role model prevents unauthorized modifications while allowing distributed execution

### 2. State Transition Validation

**✓ Implemented**:
- Invalid status transitions revert with clear errors
- Operations cannot transition from completed/failed/timeout states
- Cannot retry completed/timeout operations

**Risk Mitigated**: Prevents duplicate processing or state corruption

### 3. Fee Validation

**✓ Implemented**:
- Exact fee requirement validated
- Configurable fee ceiling (10% max BPS) prevents extreme charges
- Fees tracked per-chain for audit

**Risk Mitigated**: Prevents fee manipulation attacks

### 4. Timeout Validation

**✓ Implemented**:
- Timeout must be between 1 minute and 30 days
- Cannot check timeout before it expires
- Prevents premature timeout marking

**Risk Mitigated**: Prevents operations timing out prematurely

### 5. Operation ID Generation

```solidity
operationId = keccak256(
    abi.encode(_nextNonce++, msg.sender, destChainSelector, block.timestamp)
);
```

**Benefits**:
- Nonce ensures uniqueness even if other parameters repeat
- Includes chain selector for cross-chain context
- Includes timestamp for temporal ordering

**Risk Mitigated**: Prevents operation ID collisions

### 6. Reentrancy Protection

**✓ No external calls in state-changing functions** (fees use router, which is trusted external)

**Current design**: All state updates occur before external calls (checks-effects-interactions pattern)

### 7. History Immutability

**✓ History entries created at operation completion cannot be modified**

Only owner can add manual history entries for archive/recovery purposes.

## Gas Optimization

### 1. Storage Optimization

```solidity
// Efficient mapping chains for lookup O(1)
mapping(uint64 => RelayConfig) private _chainConfigs;

// Array-based history only stores final state
mapping(bytes32 => RelayHistory) private _relayHistory;
```

**Cost**: ~20k gas initial operation creation (mostly CCIP router call)

### 2. Array Queries

**Concern**: `getPendingRelaysByInitiator` iterates through all user operations
- **Mitigation**: Separate array `_operationsByInitiator` allows O(n) filtering
- **Optimization**: Owner should periodically clean archived operations

```solidity
// Query pattern - still O(n) but efficient iteration
bytes32[] memory pending = relay.getPendingRelaysByInitiator(user);
```

### 3. History Queries

**Concern**: `getAllRelayHistory` returns unbounded array
- **Mitigation**: Client should implement pagination
- **Recommendation**: Track history limit per chain/user if needed

### 4. Recommended Gas Optimizations for Production

```solidity
// Option 1: Add operation archival
function archiveCompletedOperation(bytes32 operationId) external onlyOwner {
    // Remove from active tracking to reduce iteration costs
}

// Option 2: Implement indexed history queries
mapping(address => mapping(uint256 => bytes32)) operationsByInitiatorIndexed;
// Allows efficient off-chain pagination

// Option 3: Use bit-packing for small values
// Current: RelayStatus uses 8 bits (could use 3 bits)
// Current: attempts stored as uint256 (could use uint8)
```

## Common Use Cases

### Use Case 1: Cross-Chain Market Price Update

```solidity
// Source chain: Initiate price update relay
bytes memory priceData = abi.encode(
    PRICE_ORACLE_ADDRESS,
    UPDATE_FUNCTION_SELECTOR,
    newPriceData
);

bytes32 opId = relay.initiateRelay{
    value: relay.calculateRelayFee(CHAIN_ARBITRUM, 0)
}(CHAIN_ARBITRUM, priceData, 0);

// Destination chain: Relayer receives via CCIP
// 1. Calls relay.updateRelayExecuting(opId)
// 2. Executes price update
// 3. Calls relay.completeRelay(opId, resultData)
```

### Use Case 2: Cross-Chain Liquidation with Retry

```solidity
// User initiates liquidation across chains
bytes memory liquidationData = abi.encode(
    LIQUIDATION_ENGINE,
    LIQUIDATE_SELECTOR,
    borrowerAddress,
    collateralAmount
);

bytes32 opId = relay.initiateRelay{
    value: calculateRequiredFee(CHAIN_AVALANCHE)
}(CHAIN_AVALANCHE, liquidationData, 0);

// If network congestion causes failure:
// relay.failRelay(opId, "network timeout");
// System automatically retries with extended timeout
// Up to maxRetries attempts
```

### Use Case 3: Monitoring Operations

```solidity
// Off-chain bot monitoring
function checkAndEnforceTimeouts() external {
    bytes32[] memory expired = relay.getExpiredRelays();
    for (uint256 i = 0; i < expired.length; i++) {
        relay.checkTimeout(expired[i]);
        // Emit notification event
    }
}

// User checking their operations
function getUserStatus(address user) external view returns (
    uint256 pending,
    uint256 executing,
    uint256 completed,
    uint256 failed
) {
    bytes32[] memory ops = relay.getRelaysByInitiator(user);
    for (uint256 i = 0; i < ops.length; i++) {
        RelayOperation memory op = relay.getRelayOperation(ops[i]);
        // Count by status
    }
}
```

## Integration with GateDelay

### Market Operations

1. **Cross-Chain Trades**: Relay trade execution across markets
2. **Arbitrage Detection**: Relay price discrepancies between chains
3. **Liquidation Coordination**: Trigger liquidations across chains
4. **Collateral Rebalancing**: Move collateral between chain markets

### Fee Collection

```solidity
// Track fees per user for potential refunds
mapping(address => uint256) public userFeesAccrued;

// Owner can distribute fee rebates or rewards
relay.withdrawFees(treasuryAddress, accumulatedFees);
```

### History for Audits

```solidity
// Complete audit trail for compliance
RelayHistory memory hist = relay.getRelayHistory(operationId);
// Can reconstruct exact sequence of events
// Timestamps prove order of execution
```

## Production Deployment Checklist

- [ ] Deploy contract on all supported chains
- [ ] Configure all chain relationships with `configureChain`
- [ ] Set relayer address to production relayer service
- [ ] Set fee recipient to treasury address
- [ ] Update CCIP router address to production router
- [ ] Configure fee structure based on chain costs
- [ ] Run security audit on custom CCIP router wrapper
- [ ] Implement off-chain relayer service that:
  - Listens to relay initiation events
  - Monitors CCIP message delivery status
  - Calls status update functions on destination chain
  - Implements retry logic and failure handling
- [ ] Deploy monitoring/alerting for timeout enforcement
- [ ] Establish fee collection and distribution process
- [ ] Document admin procedures for adding new chains

## Testing Coverage

Complete test suite includes:

- ✓ Chain configuration (add, remove, update)
- ✓ Fee calculation (flat + proportional)
- ✓ Relay initiation and validation
- ✓ Status transitions (all valid paths)
- ✓ Timeout detection and enforcement
- ✓ Retry mechanism with attempts tracking
- ✓ Cancellation by initiator
- ✓ History recording and retrieval
- ✓ Multi-chain operation isolation
- ✓ Access control enforcement
- ✓ Query functions (pending, history, expired)
- ✓ Fee tracking and accumulation

See `MarketRelay.t.sol` for complete test suite with 40+ test cases.
