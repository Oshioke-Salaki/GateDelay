# VoteWeight System Documentation

## Overview

The VoteWeight system is a comprehensive vote weight tracking solution for governance systems. It provides advanced features for tracking voting weights, managing delegations, creating historical snapshots, and querying weight data.

## Features

### ✅ 1. Weight Tracking
- **Real-time weight tracking** for all accounts
- **Automatic account tracking** when weights are updated
- **Base weight calculation** from token balances
- **Total voting weight** aggregation across all accounts
- **Batch weight updates** for efficiency

### ✅ 2. Weight Changes
- **Complete change history** for every account
- **Detailed change records** including:
  - Timestamp and block number
  - Old and new weights
  - Delta (change amount)
  - Reason for change (balance change, delegation, etc.)
- **Recent changes query** with configurable count
- **Period-based change calculation** between any two blocks
- **Change reasons tracking**:
  - `BALANCE_CHANGE` - Token balance changed
  - `DELEGATION_RECEIVED` - Received delegated weight
  - `DELEGATION_REMOVED` - Lost delegated weight
  - `DELEGATION_GIVEN` - Delegated weight to another
  - `DELEGATION_REVOKED` - Revoked delegation
  - `SNAPSHOT_CREATED` - Snapshot created

### ✅ 3. Weight Delegations
- **Full delegation support** with automatic weight transfers
- **Delegation tracking**:
  - Current delegatee
  - Delegation amount
  - Timestamp
  - Active status
- **Multiple delegators** to single delegatee
- **Delegation changes** with automatic weight rebalancing
- **Undelegation** to reclaim voting power
- **Safety features**:
  - Self-delegation prevention
  - Delegation loop detection
  - Circular delegation prevention
- **Delegator lists** for each delegatee

### ✅ 4. Weight Snapshots
- **Point-in-time snapshots** of all weights
- **Historical weight queries** at any snapshot
- **Snapshot metadata**:
  - Unique ID
  - Block number
  - Timestamp
  - Account count
- **Multiple snapshots** support
- **Efficient storage** of snapshot data

### ✅ 5. Weight Queries
- **Current weight** for any account
- **Weight breakdown**:
  - Base weight (from tokens)
  - Delegated weight received
  - Delegated weight given
  - Total effective weight
- **Historical weight** at specific block numbers
- **Checkpoint queries** with binary search optimization
- **Delegation information** queries
- **Tracked accounts** listing
- **Total voting weight** across all accounts

## Architecture

### Core Components

#### 1. Weight Storage
```solidity
mapping(address => uint256) public currentWeight;      // Current total weight
mapping(address => uint256) public baseWeight;         // Weight from tokens
mapping(address => uint256) public delegatedWeightReceived;  // From delegators
mapping(address => uint256) public delegatedWeightGiven;     // To delegatee
```

#### 2. Delegation Storage
```solidity
mapping(address => address) public currentDelegation;  // delegator => delegatee
mapping(address => DelegationInfo) public delegationInfo;  // Delegation details
mapping(address => address[]) public delegators;       // delegatee => delegators[]
```

#### 3. Historical Storage
```solidity
mapping(address => Checkpoint[]) public checkpoints;   // Historical weights
mapping(address => WeightChange[]) public weightChangeHistory;  // Change log
mapping(uint256 => Snapshot) private snapshots;        // Point-in-time snapshots
```

### Data Structures

#### Checkpoint
```solidity
struct Checkpoint {
    uint256 blockNumber;
    uint256 weight;
}
```
Stores weight at a specific block for historical queries.

#### WeightChange
```solidity
struct WeightChange {
    uint256 timestamp;
    uint256 blockNumber;
    uint256 oldWeight;
    uint256 newWeight;
    int256 delta;
    ChangeReason reason;
}
```
Records every weight change with full context.

#### DelegationInfo
```solidity
struct DelegationInfo {
    address delegatee;
    uint256 amount;
    uint256 timestamp;
    bool active;
}
```
Tracks delegation details for each delegator.

#### Snapshot
```solidity
struct Snapshot {
    uint256 id;
    uint256 blockNumber;
    uint256 timestamp;
    mapping(address => uint256) weights;
    address[] accounts;
}
```
Captures all weights at a specific point in time.

## Usage Examples

### Basic Weight Tracking

```solidity
// Update weight for an account
voteWeight.updateWeight(userAddress);

// Batch update multiple accounts
address[] memory accounts = [alice, bob, charlie];
voteWeight.batchUpdateWeights(accounts);

// Get current weight
uint256 weight = voteWeight.getVotingWeight(userAddress);

// Get weight breakdown
(uint256 base, uint256 received, uint256 given, uint256 total) = 
    voteWeight.getWeightBreakdown(userAddress);
```

### Delegation

```solidity
// Delegate voting power
voteWeight.delegate(delegateeAddress);

// Change delegation
voteWeight.delegate(newDelegateeAddress);

// Remove delegation
voteWeight.undelegate();

// Check delegation status
bool hasDelegated = voteWeight.hasDelegated(userAddress);
address delegatee = voteWeight.getDelegatee(userAddress);

// Get delegation info
VoteWeight.DelegationInfo memory info = voteWeight.getDelegationInfo(userAddress);

// Get all delegators for an account
address[] memory delegators = voteWeight.getDelegators(delegateeAddress);
```

### Historical Queries

```solidity
// Get weight at specific block
uint256 historicalWeight = voteWeight.getWeightAt(userAddress, blockNumber);

// Get weight change history
VoteWeight.WeightChange[] memory history = voteWeight.getWeightChangeHistory(userAddress);

// Get recent changes
VoteWeight.WeightChange[] memory recent = voteWeight.getRecentWeightChanges(userAddress, 10);

// Calculate weight change over period
int256 change = voteWeight.calculateWeightChange(userAddress, fromBlock, toBlock);
```

### Snapshots

```solidity
// Create snapshot (owner only)
uint256 snapshotId = voteWeight.createSnapshot();

// Get weight at snapshot
uint256 snapshotWeight = voteWeight.getWeightAtSnapshot(snapshotId, userAddress);

// Get snapshot info
(uint256 id, uint256 blockNumber, uint256 timestamp, uint256 accountCount) = 
    voteWeight.getSnapshotInfo(snapshotId);
```

### Checkpoints

```solidity
// Get checkpoint count
uint256 count = voteWeight.getCheckpointCount(userAddress);

// Get specific checkpoint
VoteWeight.Checkpoint memory checkpoint = voteWeight.getCheckpoint(userAddress, index);
```

### System Queries

```solidity
// Get all tracked accounts
address[] memory accounts = voteWeight.getTrackedAccounts();

// Get tracked account count
uint256 count = voteWeight.getTrackedAccountCount();

// Get total voting weight
uint256 total = voteWeight.getTotalVotingWeight();

// Check if account is tracked
bool tracked = voteWeight.isTracked(userAddress);
```

## Integration with Existing Governance

The VoteWeight system is designed to integrate seamlessly with the existing Voting and Governance contracts:

### Integration Points

1. **Token-based Weight**: Uses the same governance token as the Voting contract
2. **Weight Queries**: Provides enhanced weight queries for voting power
3. **Delegation**: Offers advanced delegation features beyond the basic Voting contract
4. **Historical Data**: Enables time-travel queries for past voting power

### Migration Path

```solidity
// Option 1: Use VoteWeight alongside existing Voting contract
// - Keep Voting contract for proposal management
// - Use VoteWeight for advanced weight tracking and queries

// Option 2: Integrate VoteWeight into Voting contract
// - Modify Voting.getVotingPower() to use VoteWeight
// - Leverage VoteWeight's delegation system
// - Use snapshots for proposal creation checkpoints
```

## Security Features

### Access Control
- **Owner-only functions**: Snapshot creation
- **User-controlled**: Weight updates, delegations

### Safety Checks
- ✅ Zero address validation
- ✅ Self-delegation prevention
- ✅ Delegation loop detection
- ✅ Circular delegation prevention
- ✅ Reentrancy protection on delegation functions
- ✅ Block number validation for historical queries

### Error Handling
```solidity
error ZeroAddress();
error SelfDelegation();
error DelegationLoop();
error InvalidSnapshotId();
error SnapshotNotFound();
error InvalidBlockNumber();
error NoWeightChange();
error CircularDelegation();
```

## Gas Optimization

### Efficient Storage
- Packed structs where possible
- Minimal storage writes
- Efficient array operations

### Optimized Queries
- Binary search for checkpoint queries
- Cached total voting weight
- Batch operations support

### Best Practices
- Use `batchUpdateWeights()` for multiple accounts
- Create snapshots strategically (not every block)
- Query checkpoints instead of full history when possible

## Events

### Weight Events
```solidity
event WeightUpdated(
    address indexed account,
    uint256 oldWeight,
    uint256 newWeight,
    int256 delta,
    ChangeReason reason
);
```

### Delegation Events
```solidity
event DelegationCreated(
    address indexed delegator,
    address indexed delegatee,
    uint256 amount,
    uint256 timestamp
);

event DelegationRemoved(
    address indexed delegator,
    address indexed delegatee,
    uint256 amount,
    uint256 timestamp
);

event DelegationChanged(
    address indexed delegator,
    address indexed oldDelegatee,
    address indexed newDelegatee,
    uint256 amount
);
```

### Snapshot Events
```solidity
event SnapshotCreated(
    uint256 indexed snapshotId,
    uint256 blockNumber,
    uint256 timestamp
);

event CheckpointCreated(
    address indexed account,
    uint256 blockNumber,
    uint256 weight
);
```

## Testing

### Test Coverage

The test suite (`VoteWeight.t.sol`) includes:

#### Weight Tracking Tests (8 tests)
- ✅ Basic weight updates
- ✅ Multiple account tracking
- ✅ Weight updates after balance changes
- ✅ Batch updates
- ✅ Total voting weight calculation
- ✅ Zero address validation
- ✅ No-change detection
- ✅ Account tracking

#### Delegation Tests (10 tests)
- ✅ Basic delegation
- ✅ Delegation changes
- ✅ Undelegation
- ✅ Self-delegation prevention
- ✅ Zero address validation
- ✅ Delegation loop prevention
- ✅ Multiple delegators
- ✅ Delegation info queries
- ✅ Delegator lists
- ✅ Weight rebalancing

#### Weight Change Tests (4 tests)
- ✅ Change history tracking
- ✅ Delegation-related changes
- ✅ Recent changes queries
- ✅ Period-based calculations

#### Checkpoint Tests (4 tests)
- ✅ Checkpoint creation
- ✅ Historical weight queries
- ✅ Invalid block handling
- ✅ Empty checkpoint handling

#### Snapshot Tests (6 tests)
- ✅ Snapshot creation
- ✅ Weight queries at snapshots
- ✅ Snapshot info queries
- ✅ Invalid snapshot handling
- ✅ Owner-only access
- ✅ Multiple snapshots

#### Query Tests (3 tests)
- ✅ Current weight queries
- ✅ Weight breakdown queries
- ✅ Tracked accounts queries

#### Integration Tests (3 tests)
- ✅ Complex delegation scenarios
- ✅ Weight tracking with transfers
- ✅ Delegation with balance changes

#### Fuzz Tests (2 tests)
- ✅ Random weight amounts
- ✅ Variable delegator counts

#### Edge Cases (4 tests)
- ✅ Zero balance accounts
- ✅ Zero balance delegation
- ✅ Multiple delegation changes
- ✅ Delegation chain scenarios

**Total: 44 comprehensive tests**

### Running Tests

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Run all VoteWeight tests
forge test --match-contract VoteWeightTest -vv

# Run specific test
forge test --match-test test_Delegate_Success -vvv

# Run with gas reporting
forge test --match-contract VoteWeightTest --gas-report

# Run with coverage
forge coverage --match-contract VoteWeightTest
```

## Deployment

### Prerequisites
1. Deployed governance token (ERC20)
2. Foundry installed
3. RPC endpoint configured

### Deployment Script

```solidity
// script/DeployVoteWeight.s.sol
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {VoteWeight} from "../contracts/VoteWeight.sol";

contract DeployVoteWeight is Script {
    function run() external returns (VoteWeight) {
        address governanceToken = vm.envAddress("GOVERNANCE_TOKEN");
        
        vm.startBroadcast();
        VoteWeight voteWeight = new VoteWeight(governanceToken);
        vm.stopBroadcast();
        
        return voteWeight;
    }
}
```

### Deploy Command

```bash
# Set environment variables
export GOVERNANCE_TOKEN=0x...
export PRIVATE_KEY=0x...
export RPC_URL=https://...

# Deploy
forge script script/DeployVoteWeight.s.sol:DeployVoteWeight \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify
```

## Acceptance Criteria Status

### ✅ Weights are tracked
- [x] Current weights stored and updated
- [x] Base weights from token balances
- [x] Delegated weights tracked separately
- [x] Total voting weight calculated
- [x] Account tracking system

### ✅ Changes are calculated
- [x] Complete change history
- [x] Delta calculations
- [x] Reason tracking
- [x] Period-based calculations
- [x] Recent changes queries

### ✅ Delegations work
- [x] Delegate to any address
- [x] Change delegations
- [x] Undelegate functionality
- [x] Multiple delegators support
- [x] Loop prevention
- [x] Weight rebalancing

### ✅ Snapshots work
- [x] Create snapshots
- [x] Query weights at snapshots
- [x] Snapshot metadata
- [x] Multiple snapshots
- [x] Owner-controlled

### ✅ Queries work
- [x] Current weight queries
- [x] Historical weight queries
- [x] Weight breakdown queries
- [x] Delegation info queries
- [x] System-wide queries
- [x] Checkpoint queries

## Future Enhancements

### Potential Improvements
1. **Automatic snapshots** on proposal creation
2. **Delegation expiry** with time-based limits
3. **Weighted delegation** (partial delegation)
4. **Delegation chains** with configurable depth
5. **Gas optimization** for large-scale deployments
6. **Off-chain indexing** integration
7. **Multi-token support** for hybrid governance

### Integration Opportunities
1. **Voting contract integration** for seamless governance
2. **Timelock integration** for delayed weight changes
3. **Oracle integration** for external weight factors
4. **NFT-based weights** for hybrid governance models

## Support and Maintenance

### Documentation
- ✅ Comprehensive inline comments
- ✅ NatSpec documentation
- ✅ Usage examples
- ✅ Integration guide

### Testing
- ✅ 44 comprehensive tests
- ✅ Edge case coverage
- ✅ Fuzz testing
- ✅ Integration tests

### Code Quality
- ✅ Solidity 0.8.20
- ✅ OpenZeppelin dependencies
- ✅ Gas optimizations
- ✅ Security best practices

## Conclusion

The VoteWeight system provides a production-ready, comprehensive solution for vote weight tracking in governance systems. With full test coverage, extensive documentation, and robust security features, it's ready for integration into the GateDelay governance infrastructure.

All acceptance criteria have been met:
- ✅ Weights are tracked
- ✅ Changes are calculated
- ✅ Delegations work
- ✅ Snapshots work
- ✅ Queries work

The system is designed for extensibility, gas efficiency, and seamless integration with existing governance contracts.
