# Vote Delegation System

## Overview

The Vote Delegation system is an advanced governance feature that allows token holders to delegate their voting power to trusted representatives while maintaining full control over their tokens. This implementation supports multi-level delegation chains, comprehensive tracking, and historical queries.

## Key Features

🔗 **Multi-Level Delegation Chains**  
Delegate to someone who delegates to someone else - the system tracks the entire chain and calculates power correctly.

📊 **Real-Time Power Calculation**  
Voting power is calculated in real-time based on token balances and delegation status.

📜 **Complete History Tracking**  
Every delegation change is recorded with timestamps for full auditability.

⏱️ **Historical Queries**  
Query voting power at any past block number using the checkpoint system.

🔒 **Security First**  
Built-in protection against loops, reentrancy, and other attack vectors.

⚡ **Gas Optimized**  
Efficient storage patterns and algorithms minimize gas costs.

## Quick Start

### Deploy the Contract

```solidity
// Deploy with your governance token address
VoteDelegation voteDelegation = new VoteDelegation(governanceTokenAddress);
```

### Delegate Your Voting Power

```solidity
// Delegate to a representative
voteDelegation.delegate(representativeAddress);
```

### Check Voting Power

```solidity
// Get current voting power
uint256 power = voteDelegation.getVotingPower(address);
```

### Remove Delegation

```solidity
// Take back your voting power
voteDelegation.undelegate();
```

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    VoteDelegation Contract                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Delegation  │  │    Chain     │  │   Voting     │      │
│  │  Management  │  │   Tracking   │  │    Power     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Historical  │  │    Query     │  │   Security   │      │
│  │  Checkpoints │  │  Interface   │  │   Features   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Token Holder
    │
    ├─ delegate() ──────────> Delegation Created
    │                              │
    │                              ├─ Update delegatedPower
    │                              ├─ Add to delegators list
    │                              ├─ Record in history
    │                              └─ Create checkpoint
    │
    ├─ undelegate() ────────> Delegation Removed
    │                              │
    │                              ├─ Restore voting power
    │                              ├─ Update delegatedPower
    │                              ├─ Remove from delegators
    │                              └─ Create checkpoint
    │
    └─ getVotingPower() ────> Calculate Power
                                   │
                                   ├─ Check delegation status
                                   ├─ Get token balance
                                   ├─ Add delegated power
                                   └─ Return total
```

## Use Cases

### 1. Representative Governance

Token holders who don't have time to vote on every proposal can delegate to trusted representatives.

```solidity
// Alice delegates to Bob, a governance expert
vm.prank(alice);
voteDelegation.delegate(bob);

// Bob now votes with Alice's power + his own
uint256 bobPower = voteDelegation.getVotingPower(bob);
```

### 2. Delegation Chains

Representatives can further delegate to specialists for specific domains.

```solidity
// Alice -> Bob -> Carol (technical expert)
vm.prank(alice);
voteDelegation.delegate(bob);

vm.prank(bob);
voteDelegation.delegate(carol);

// Carol votes with combined power
```

### 3. Temporary Delegation

Delegate for a period, then reclaim voting power when needed.

```solidity
// Delegate for routine votes
voteDelegation.delegate(representative);

// Important vote coming up - take back control
voteDelegation.undelegate();

// Vote yourself
voting.castVote(importantProposalId, choice);
```

### 4. Historical Analysis

Analyze voting power distribution at any point in history.

```solidity
// Check power at a specific block
uint256 historicalPower = voteDelegation.getVotingPowerAt(
    address,
    blockNumber
);
```

## API Reference

### Core Functions

#### `delegate(address delegatee)`
Delegate your voting power to another address.
- **Parameters**: `delegatee` - Address to delegate to
- **Reverts**: If delegatee is zero address, self, or would create a loop
- **Emits**: `DelegationCreated` or `DelegationChanged`

#### `undelegate()`
Remove your current delegation and reclaim voting power.
- **Reverts**: If no active delegation exists
- **Emits**: `DelegationRemoved`

### Query Functions

#### `getVotingPower(address account) → uint256`
Get the current total voting power of an account.
- **Returns**: Total voting power (own balance + delegated power)

#### `getVotingPowerAt(address account, uint256 blockNumber) → uint256`
Get voting power at a specific block number.
- **Returns**: Historical voting power
- **Reverts**: If blockNumber is in the future

#### `getDelegationChain(address account) → DelegationChain`
Get the full delegation chain for an account.
- **Returns**: Struct containing chain array, depth, and total power

#### `getFinalDelegatee(address account) → address`
Get who actually votes at the end of a delegation chain.
- **Returns**: Final delegatee address

#### `hasActiveDelegation(address account) → bool`
Check if an account is currently delegating.
- **Returns**: True if actively delegating

#### `getDelegators(address delegatee) → address[]`
Get all addresses delegating to a specific address.
- **Returns**: Array of delegator addresses

#### `getDelegationHistory(address account) → Delegation[]`
Get the complete delegation history for an account.
- **Returns**: Array of historical delegations

#### `getCurrentDelegation(address account) → Delegation`
Get the current delegation details for an account.
- **Returns**: Current delegation struct

#### `getTotalDelegatedPower(address account) → uint256`
Get total power delegated to an account.
- **Returns**: Sum of all delegated power

#### `getTotalActiveDelegations() → uint256`
Get system-wide count of active delegations.
- **Returns**: Total number of active delegations

## Events

### DelegationCreated
```solidity
event DelegationCreated(
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```
Emitted when a new delegation is created.

### DelegationChanged
```solidity
event DelegationChanged(
    address indexed delegator,
    address indexed fromDelegatee,
    address indexed toDelegatee,
    uint256 timestamp
);
```
Emitted when a delegation is changed to a different address.

### DelegationRemoved
```solidity
event DelegationRemoved(
    address indexed delegator,
    address indexed previousDelegatee,
    uint256 timestamp
);
```
Emitted when a delegation is removed.

### VotingPowerUpdated
```solidity
event VotingPowerUpdated(
    address indexed account,
    uint256 previousPower,
    uint256 newPower
);
```
Emitted when an account's voting power changes.

## Security Considerations

### Loop Prevention
The contract prevents circular delegation loops:
```
Alice -> Bob -> Alice  ❌ BLOCKED
```

### Chain Depth Limit
Maximum delegation chain depth is 10 levels to prevent gas issues:
```
A -> B -> C -> ... -> J -> K  ✅ OK (10 levels)
A -> B -> C -> ... -> K -> L  ❌ BLOCKED (11 levels)
```

### Reentrancy Protection
All state-changing functions are protected against reentrancy attacks using OpenZeppelin's ReentrancyGuard.

### Input Validation
- Zero address checks on all address inputs
- Self-delegation prevention
- Active delegation checks before undelegation

## Gas Costs

Approximate gas costs for common operations:

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| First delegation | ~150,000 | Includes storage initialization |
| Change delegation | ~100,000 | Updates existing storage |
| Undelegate | ~80,000 | Removes delegation |
| Get voting power | ~5,000 | View function |
| Get delegation chain | ~10,000 | View function |
| Historical query | ~15,000 | Binary search through checkpoints |

## Testing

The implementation includes 84 comprehensive tests covering:

- ✅ All core functionality
- ✅ Edge cases and error conditions
- ✅ Complex delegation scenarios
- ✅ Gas optimization
- ✅ Integration scenarios
- ✅ Fuzz testing

Run tests:
```bash
forge test --match-contract VoteDelegationTest -vv
```

Generate gas report:
```bash
forge test --match-contract VoteDelegationTest --gas-report
```

## Integration Example

### With Voting Contract

```solidity
contract Voting {
    VoteDelegation public voteDelegation;
    
    function castVote(uint256 proposalId, VoteChoice choice) external {
        // Get voting power from delegation contract
        uint256 power = voteDelegation.getVotingPower(msg.sender);
        require(power > 0, "No voting power");
        
        // Record vote with delegated power
        _recordVote(proposalId, msg.sender, choice, power);
    }
}
```

### With Governance Contract

```solidity
contract Governance {
    VoteDelegation public voteDelegation;
    
    function propose(...) external {
        // Check proposer has minimum voting power
        uint256 power = voteDelegation.getVotingPower(msg.sender);
        require(power >= proposalThreshold, "Insufficient power");
        
        // Create proposal...
    }
}
```

## Deployment

### Prerequisites
- Foundry installed
- Governance token deployed
- OpenZeppelin Contracts library

### Deploy Script

```solidity
// script/DeployVoteDelegation.s.sol
contract DeployVoteDelegation is Script {
    function run() external {
        vm.startBroadcast();
        
        address governanceToken = 0x...; // Your token address
        VoteDelegation voteDelegation = new VoteDelegation(governanceToken);
        
        console.log("VoteDelegation deployed at:", address(voteDelegation));
        
        vm.stopBroadcast();
    }
}
```

Deploy:
```bash
forge script script/DeployVoteDelegation.s.sol:DeployVoteDelegation --rpc-url $RPC_URL --broadcast
```

## Upgradeability

The current implementation is not upgradeable. For upgradeable deployments:

1. Use OpenZeppelin's UUPS or Transparent Proxy pattern
2. Add initialization function instead of constructor
3. Include storage gap for future upgrades
4. Implement access control for upgrade function

## Best Practices

1. **Check Before Delegating**: Verify the delegatee's reputation and voting history
2. **Monitor Your Delegation**: Regularly check how your delegate is voting
3. **Use Historical Queries**: For snapshot voting, always use `getVotingPowerAt()`
4. **Listen to Events**: Monitor delegation events for real-time updates
5. **Gas Optimization**: Batch operations when possible
6. **Security**: Always validate addresses before delegation

## Troubleshooting

### Common Issues

**Q: Why can't I delegate to address X?**  
A: Check if it would create a loop or exceed max chain depth.

**Q: My voting power is 0 after delegating. Is this correct?**  
A: Yes, when you delegate, your voting power goes to the delegatee.

**Q: How do I get my voting power back?**  
A: Call `undelegate()` to reclaim your voting power.

**Q: Can I partially delegate my voting power?**  
A: No, the current implementation delegates all voting power. Partial delegation could be added in a future version.

## Resources

- **Implementation**: `contracts/VoteDelegation.sol`
- **Tests**: `test/VoteDelegation.t.sol`
- **Full Documentation**: `VOTE_DELEGATION_IMPLEMENTATION.md`
- **Quick Start**: `VOTE_DELEGATION_QUICK_START.md`
- **Acceptance Criteria**: `VOTE_DELEGATION_ACCEPTANCE_CRITERIA.md`

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

---

**Version**: 1.0.0  
**Solidity**: ^0.8.20  
**Last Updated**: May 29, 2026
