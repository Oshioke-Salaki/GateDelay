# Market Relay - Quick Reference Guide

## Core Functions

### Chain Management

```solidity
// Configure a new chain
relay.configureChain(
    uint64 chainSelector,
    uint256 defaultTimeout,  // e.g., 1 hours
    uint256 maxRetries,      // e.g., 3
    uint256 retryDelay,      // e.g., 5 minutes
    uint256 baseFee,         // e.g., 0.01 ether
    uint256 feeBps           // e.g., 50 (0.5%)
);

// Remove a chain
relay.removeChain(uint64 chainSelector);

// Update chain parameters
relay.updateChainConfig(uint64 chainSelector, uint256 newTimeout, uint256 newMaxRetries);

// Check chain support
bool supported = relay.isChainSupported(uint64 chainSelector);

// Get all supported chains
uint64[] memory chains = relay.getSupportedChains();
```

### Fee Operations

```solidity
// Calculate fee for operation
uint256 fee = relay.calculateRelayFee(uint64 destChain, uint256 operationValue);
// fee = baseFee + (operationValue * feeBps / 10000)

// Withdraw collected fees
relay.withdrawFees(address recipient, uint256 amount);

// Check accumulated fees
uint256 accumulated = relay.totalFeesCollected;
```

### Relay Operations

```solidity
// Initiate a new relay
bytes32 operationId = relay.initiateRelay{value: requiredFee}(
    uint64 destChainSelector,
    bytes calldata operationData,
    uint256 operationValue              // optional
);

// Mark operation as executing (relayer only)
relay.updateRelayExecuting(bytes32 operationId);

// Complete operation successfully (relayer only)
relay.completeRelay(bytes32 operationId, bytes calldata result);

// Mark operation failed (relayer only)
relay.failRelay(bytes32 operationId, string calldata reason);

// Check and enforce timeout
relay.checkTimeout(bytes32 operationId);

// Cancel operation (initiator only)
relay.cancelRelay(bytes32 operationId);
```

### Query Functions

```solidity
// Get operation status
RelayStatus status = relay.getRelayStatus(bytes32 operationId);
// Returns: None, Pending, Executing, Completed, Failed, Timeout, Cancelled

// Get full operation details
RelayOperation memory op = relay.getRelayOperation(bytes32 operationId);
// Contains: operationId, initiator, sourceChain, destChain, status, timestamps, etc.

// Get operation history
RelayHistory memory hist = relay.getRelayHistory(bytes32 operationId);
// Contains: operationId, initiator, final status, all timestamps, attempts, result

// Get pending operations for user
bytes32[] memory pending = relay.getPendingRelaysByInitiator(address user);

// Get all user operations
bytes32[] memory all = relay.getRelaysByInitiator(address user);

// Get pending operations for chain
bytes32[] memory chainPending = relay.getPendingRelaysByChain(uint64 chainSelector);

// Get operations requiring timeout check
bytes32[] memory expired = relay.getExpiredRelays();

// Get chain configuration
RelayConfig memory cfg = relay.getChainConfig(uint64 chainSelector);

// Get total relay count
uint256 count = relay.getRelayCount();

// Get all history
bytes32[] memory history = relay.getAllRelayHistory();
```

### Admin Functions

```solidity
// Set relayer address
relay.setRelayer(address newRelayer);

// Set fee recipient
relay.setFeeRecipient(address newFeeRecipient);

// Set CCIP router
relay.setRelayRouter(address newRouter);

// Add manual history entry
relay.addRelayHistory(
    bytes32 operationId,
    address initiator,
    RelayStatus status,
    uint256 createdAt,
    uint256 completedAt,
    uint256 timeoutAt,
    uint256 attempts,
    bytes calldata result
);
```

## Status Enum Values

```solidity
RelayStatus.None        // 0 - doesn't exist
RelayStatus.Pending     // 1 - awaiting execution
RelayStatus.Executing   // 2 - currently executing
RelayStatus.Completed   // 3 - finished successfully
RelayStatus.Failed      // 4 - failed execution
RelayStatus.Timeout     // 5 - operation expired
RelayStatus.Cancelled   // 6 - user cancelled
```

## Common Patterns

### Pattern 1: Simple Relay

```solidity
// 1. Initiate relay from source chain
bytes memory data = abi.encode(targetAddress, selectorHash, args);
uint256 fee = relay.calculateRelayFee(destChain, 0);

bytes32 opId = relay.initiateRelay{value: fee}(
    destChain,
    data,
    0  // no value transfer
);

// 2. Relayer receives via CCIP on destination chain
relay.updateRelayExecuting(opId);

// 3. Execute the actual operation
(bool success, bytes memory result) = targetAddress.call(
    abi.encodeWithSelector(selector, args)
);

// 4. Report result
if (success) {
    relay.completeRelay(opId, result);
} else {
    relay.failRelay(opId, "execution failed");
}
```

### Pattern 2: Relay with Retry

```solidity
// Chain configuration with retries
relay.configureChain(
    CHAIN_BASE,
    2 hours,           // timeout
    3,                 // maxRetries = 3 attempts
    5 minutes,         // delay between retries
    0.01 ether,        // base fee
    100                // 1% fee
);

// Initiation - attempt 1
bytes32 opId = relay.initiateRelay{value: fee}(CHAIN_BASE, data, 0);

// On network congestion or failure:
relay.failRelay(opId, "network timeout");
// → Status back to Pending, attempts = 2, timeoutAt extended

// Automatic retry by relayer service
relay.updateRelayExecuting(opId);
// Execute again...
relay.completeRelay(opId, result);
```

### Pattern 3: Timeout Handling

```solidity
// Periodic timeout enforcement (called by keeper bot)
function enforceTimeouts() external {
    bytes32[] memory expired = relay.getExpiredRelays();
    
    for (uint256 i = 0; i < expired.length; i++) {
        relay.checkTimeout(expired[i]);
        emit OperationTimedOut(expired[i]);
    }
}

// Or check single operation
if (someCondition) {
    relay.checkTimeout(operationId);
    // Now: RelayStatus.Timeout
}
```

### Pattern 4: User-Initiated Cancellation

```solidity
// User monitors their operations
bytes32[] memory pending = relay.getPendingRelaysByInitiator(msg.sender);

// If user wants to cancel
for (uint256 i = 0; i < pending.length; i++) {
    RelayStatus status = relay.getRelayStatus(pending[i]);
    if (userWantsToCancelThis(pending[i])) {
        relay.cancelRelay(pending[i]);
    }
}
```

### Pattern 5: Monitoring Operations

```solidity
// Get full picture for operation
RelayOperation memory op = relay.getRelayOperation(operationId);

// Calculate time remaining
if (op.status == RelayStatus.Pending || op.status == RelayStatus.Executing) {
    uint256 timeRemaining = op.timeoutAt > block.timestamp 
        ? op.timeoutAt - block.timestamp 
        : 0;
    
    console.log("Operation expires in %d seconds", timeRemaining);
    console.log("Attempts so far: %d of %d", op.attempts, maxRetriesForChain);
}

// Check history for completed operations
RelayHistory memory hist = relay.getRelayHistory(completedOpId);
console.log("Completed in %d attempts", hist.attempts);
console.log("Duration: %d seconds", hist.completedAt - hist.createdAt);
```

## Fee Examples

### Example 1: Flat Fee Only
```
Chain Config: baseFee = 0.1 ETH, feeBps = 0 (0%)
Operation Value: 100 ETH

Fee = 0.1 ETH + (100 * 0 / 10000) = 0.1 ETH
```

### Example 2: Proportional Fee Only
```
Chain Config: baseFee = 0 ETH, feeBps = 50 (0.5%)
Operation Value: 100 ETH

Fee = 0 + (100 * 50 / 10000) = 0.5 ETH
```

### Example 3: Combined Fee
```
Chain Config: baseFee = 0.05 ETH, feeBps = 100 (1%)
Operation Value: 50 ETH

Fee = 0.05 + (50 * 100 / 10000) = 0.05 + 0.5 = 0.55 ETH
```

## Events Emitted

```solidity
// Chain management
event ChainConfigured(uint64 indexed chainSelector, uint256 defaultTimeout, ...);
event ChainRemoved(uint64 indexed chainSelector);
event ChainConfigUpdated(uint64 indexed chainSelector, uint256 newTimeout, ...);

// Admin changes
event RelayerUpdated(address indexed newRelayer);
event FeeRecipientUpdated(address indexed newFeeRecipient);
event RouterUpdated(address indexed newRouter);

// Operation lifecycle
event RelayInitiated(bytes32 indexed operationId, address indexed initiator, ...);
event RelayExecuting(bytes32 indexed operationId, uint256 executedAt);
event RelayCompleted(bytes32 indexed operationId, bytes result, uint256 completedAt);
event RelayFailed(bytes32 indexed operationId, string reason, uint256 failedAt);
event RelayTimeout(bytes32 indexed operationId, uint256 timedOutAt);
event RelayCancelled(bytes32 indexed operationId, uint256 cancelledAt);
event RelayRetried(bytes32 indexed operationId, uint256 newAttempt, uint256 newTimeoutAt);

// History
event RelayOperationHistoryRecorded(bytes32 indexed operationId, RelayStatus status);

// Fees
event FeesWithdrawn(address indexed to, uint256 amount);
```

## Error Codes

```solidity
MarketRelay__NotRelayer(address caller)
MarketRelay__NotInitiator(address caller)
MarketRelay__ChainNotSupported(uint64 chainSelector)
MarketRelay__ChainAlreadyConfigured(uint64 chainSelector)
MarketRelay__InvalidTimeout(uint256 timeout)
MarketRelay__InvalidFee(uint256 feeBps)
MarketRelay__ZeroAddress()
MarketRelay__ZeroValue()
MarketRelay__OperationNotFound(bytes32 operationId)
MarketRelay__InvalidOperationStatus(bytes32 operationId, RelayStatus currentStatus)
MarketRelay__OperationAlreadyCompleted(bytes32 operationId)
MarketRelay__MaxRetriesExceeded(bytes32 operationId)
MarketRelay__InsufficientFundsForFee(uint256 required, uint256 available)
MarketRelay__InsufficientRetryDelay(uint256 timeSinceLastAttempt, uint256 requiredDelay)
MarketRelay__OperationNotExpired(bytes32 operationId)
```

## Constants

```solidity
BPS_DENOMINATOR = 10_000        // basis points denominator
MAX_TIMEOUT = 30 days           // maximum allowed timeout
MIN_TIMEOUT = 1 minutes         // minimum allowed timeout
MAX_FEE_BPS = 1_000             // 10% maximum fee
```

## Integration Checklist

- [ ] Deploy MarketRelay contract
- [ ] Configure all supported chains
- [ ] Set relayer address
- [ ] Set fee recipient address
- [ ] Test relay initiation on testnet
- [ ] Implement relayer service for:
  - [ ] Listening to RelayInitiated events
  - [ ] Monitoring CCIP delivery
  - [ ] Calling updateRelayExecuting
  - [ ] Calling completeRelay on success
  - [ ] Calling failRelay on failure
- [ ] Deploy timeout enforcement bot
- [ ] Setup fee withdrawal process
- [ ] Monitor event logs for issues
- [ ] Document operation procedures

## Gas Estimates

```
Operation                       Gas Cost
────────────────────────────────────────
configureChain                  ~85,000
initiateRelay                   ~150,000-200,000*
updateRelayExecuting            ~35,000
completeRelay                   ~45,000
failRelay (with retry)          ~50,000
checkTimeout                    ~35,000
calculateRelayFee               ~5,000

* Variable based on operationData size and CCIP router
```

## Deployment Command Examples

```bash
# Deploy on Arbitrum
forge create Contracts/contracts/MarketRelay.sol:MarketRelay \
  --rpc-url https://arbitrum-mainnet.infura.io/v3/$INFURA_KEY \
  --private-key $PRIVATE_KEY \
  --constructor-args $ROUTER_ADDRESS $RELAYER_ADDRESS $FEE_RECIPIENT $OWNER_ADDRESS

# Verify on Etherscan
forge verify-contract $CONTRACT_ADDRESS MarketRelay \
  --chain arbitrum \
  --constructor-args $ENCODED_ARGS
```
