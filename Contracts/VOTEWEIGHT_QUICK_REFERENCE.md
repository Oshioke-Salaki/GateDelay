# VoteWeight Quick Reference

## Installation & Setup

```bash
# Install Foundry (if needed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test --match-contract VoteWeightTest -vv
```

## Deployment

```bash
# Set environment variables
export GOVERNANCE_TOKEN=0x...
export PRIVATE_KEY=0x...
export RPC_URL=https://...

# Deploy
forge script script/DeployVoteWeight.s.sol:DeployVoteWeight \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast

# Verify
export VOTEWEIGHT_ADDRESS=0x...
forge script script/DeployVoteWeight.s.sol:VerifyVoteWeight \
    --rpc-url $RPC_URL
```

## Core Functions

### Weight Management

```solidity
// Update single account
voteWeight.updateWeight(address account)

// Batch update
voteWeight.batchUpdateWeights(address[] accounts)

// Get current weight
voteWeight.getVotingWeight(address account) → uint256

// Get breakdown
voteWeight.getWeightBreakdown(address account) → (base, received, given, total)
```

### Delegation

```solidity
// Delegate
voteWeight.delegate(address delegatee)

// Undelegate
voteWeight.undelegate()

// Check delegation
voteWeight.hasDelegated(address account) → bool
voteWeight.getDelegatee(address account) → address
voteWeight.getDelegationInfo(address account) → DelegationInfo
voteWeight.getDelegators(address delegatee) → address[]
```

### Historical Queries

```solidity
// Weight at block
voteWeight.getWeightAt(address account, uint256 blockNumber) → uint256

// Change history
voteWeight.getWeightChangeHistory(address account) → WeightChange[]
voteWeight.getRecentWeightChanges(address account, uint256 count) → WeightChange[]

// Calculate change
voteWeight.calculateWeightChange(address account, uint256 fromBlock, uint256 toBlock) → int256
```

### Snapshots

```solidity
// Create (owner only)
voteWeight.createSnapshot() → uint256

// Query
voteWeight.getWeightAtSnapshot(uint256 snapshotId, address account) → uint256
voteWeight.getSnapshotInfo(uint256 snapshotId) → (id, blockNumber, timestamp, accountCount)
```

### Checkpoints

```solidity
// Query checkpoints
voteWeight.getCheckpointCount(address account) → uint256
voteWeight.getCheckpoint(address account, uint256 index) → Checkpoint
```

### System Queries

```solidity
// Tracked accounts
voteWeight.getTrackedAccounts() → address[]
voteWeight.getTrackedAccountCount() → uint256
voteWeight.isTracked(address account) → bool

// Total weight
voteWeight.getTotalVotingWeight() → uint256
```

## Data Structures

### Checkpoint
```solidity
struct Checkpoint {
    uint256 blockNumber;
    uint256 weight;
}
```

### WeightChange
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

### DelegationInfo
```solidity
struct DelegationInfo {
    address delegatee;
    uint256 amount;
    uint256 timestamp;
    bool active;
}
```

### ChangeReason Enum
```solidity
enum ChangeReason {
    BALANCE_CHANGE,
    DELEGATION_RECEIVED,
    DELEGATION_REMOVED,
    DELEGATION_GIVEN,
    DELEGATION_REVOKED,
    SNAPSHOT_CREATED
}
```

## Events

```solidity
event WeightUpdated(address indexed account, uint256 oldWeight, uint256 newWeight, int256 delta, ChangeReason reason)
event DelegationCreated(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp)
event DelegationRemoved(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp)
event DelegationChanged(address indexed delegator, address indexed oldDelegatee, address indexed newDelegatee, uint256 amount)
event SnapshotCreated(uint256 indexed snapshotId, uint256 blockNumber, uint256 timestamp)
event CheckpointCreated(address indexed account, uint256 blockNumber, uint256 weight)
```

## Errors

```solidity
error ZeroAddress()
error SelfDelegation()
error DelegationLoop()
error InvalidSnapshotId()
error SnapshotNotFound()
error InvalidBlockNumber()
error NoWeightChange()
error CircularDelegation()
```

## Common Patterns

### Track and Query Weight
```solidity
// Update weight
voteWeight.updateWeight(user);

// Get current weight
uint256 weight = voteWeight.getVotingWeight(user);

// Get detailed breakdown
(uint256 base, uint256 received, uint256 given, uint256 total) = 
    voteWeight.getWeightBreakdown(user);
```

### Delegation Flow
```solidity
// User delegates to another
voteWeight.delegate(delegatee);

// Check delegation
bool isDelegating = voteWeight.hasDelegated(user);
address currentDelegatee = voteWeight.getDelegatee(user);

// Change delegation
voteWeight.delegate(newDelegatee);

// Remove delegation
voteWeight.undelegate();
```

### Historical Analysis
```solidity
// Get weight at specific block
uint256 pastWeight = voteWeight.getWeightAt(user, blockNumber);

// Get recent changes
WeightChange[] memory changes = voteWeight.getRecentWeightChanges(user, 10);

// Calculate change over period
int256 change = voteWeight.calculateWeightChange(user, startBlock, endBlock);
```

### Snapshot Management
```solidity
// Create snapshot (owner only)
uint256 snapshotId = voteWeight.createSnapshot();

// Query snapshot
uint256 snapshotWeight = voteWeight.getWeightAtSnapshot(snapshotId, user);

// Get snapshot info
(uint256 id, uint256 block, uint256 time, uint256 accounts) = 
    voteWeight.getSnapshotInfo(snapshotId);
```

## Testing Commands

```bash
# Run all tests
forge test --match-contract VoteWeightTest -vv

# Run specific test category
forge test --match-test test_UpdateWeight -vv
forge test --match-test test_Delegate -vv
forge test --match-test test_Snapshot -vv

# Run with gas report
forge test --match-contract VoteWeightTest --gas-report

# Run with coverage
forge coverage --match-contract VoteWeightTest

# Run fuzz tests
forge test --match-test testFuzz -vv
```

## Integration Example

### With Voting Contract

```solidity
contract EnhancedVoting {
    VoteWeight public voteWeight;
    
    function castVote(uint256 proposalId, VoteChoice choice) external {
        // Get weight from VoteWeight system
        uint256 weight = voteWeight.getVotingWeight(msg.sender);
        
        // Use weight for voting
        // ... voting logic
    }
    
    function createProposal(string calldata description) external {
        // Create snapshot for proposal
        uint256 snapshotId = voteWeight.createSnapshot();
        
        // Store snapshot with proposal
        // ... proposal creation logic
    }
}
```

### With Governance Contract

```solidity
contract EnhancedGovernance {
    VoteWeight public voteWeight;
    
    function checkQuorum(uint256 proposalId) public view returns (bool) {
        // Get total voting weight
        uint256 totalWeight = voteWeight.getTotalVotingWeight();
        
        // Calculate quorum
        uint256 requiredQuorum = totalWeight * quorumPercentage / 100;
        
        // Check if met
        return votesReceived >= requiredQuorum;
    }
}
```

## Gas Optimization Tips

1. **Batch Updates**: Use `batchUpdateWeights()` for multiple accounts
2. **Strategic Snapshots**: Create snapshots only when needed
3. **Checkpoint Queries**: Use `getWeightAt()` instead of full history
4. **Delegation Planning**: Minimize delegation changes

## Security Checklist

- ✅ Zero address checks
- ✅ Self-delegation prevention
- ✅ Loop detection
- ✅ Reentrancy protection
- ✅ Owner-only functions
- ✅ Input validation
- ✅ Safe math (Solidity 0.8+)

## Troubleshooting

### Common Issues

**"NoWeightChange" error**
- Weight hasn't changed since last update
- Check token balance before updating

**"DelegationLoop" error**
- Circular delegation detected
- Choose different delegatee

**"InvalidSnapshotId" error**
- Snapshot doesn't exist
- Check `currentSnapshotId()`

**"InvalidBlockNumber" error**
- Block number is in the future
- Use `block.number` or earlier

## Support

- Documentation: `VOTEWEIGHT_DOCUMENTATION.md`
- Tests: `test/VoteWeight.t.sol`
- Contract: `contracts/VoteWeight.sol`
- Deployment: `script/DeployVoteWeight.s.sol`
