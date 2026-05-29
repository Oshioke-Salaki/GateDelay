# Vote Delegation Quick Start Guide

## Installation & Setup

### Prerequisites
- Foundry installed
- OpenZeppelin Contracts library

### Compile
```bash
forge build
```

### Run Tests
```bash
forge test --match-contract VoteDelegationTest -vv
```

### Run Specific Test
```bash
forge test --match-test test_delegate_createsDelegation -vvv
```

## Quick API Reference

### Core Functions

#### Delegate Voting Power
```solidity
function delegate(address delegatee) external
```
Delegate your voting power to another address.

**Example:**
```solidity
voteDelegation.delegate(0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb);
```

#### Remove Delegation
```solidity
function undelegate() external
```
Remove your current delegation and reclaim voting power.

**Example:**
```solidity
voteDelegation.undelegate();
```

### Query Functions

#### Get Voting Power
```solidity
function getVotingPower(address account) public view returns (uint256)
```
Returns the current total voting power of an account.

**Example:**
```solidity
uint256 power = voteDelegation.getVotingPower(userAddress);
```

#### Get Delegation Chain
```solidity
function getDelegationChain(address account) external view returns (DelegationChain memory)
```
Returns the full delegation chain for an account.

**Example:**
```solidity
VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(userAddress);
console.log("Chain depth:", chain.depth);
console.log("Final power:", chain.totalPower);
```

#### Get Final Delegatee
```solidity
function getFinalDelegatee(address account) external view returns (address)
```
Returns who actually votes at the end of a delegation chain.

**Example:**
```solidity
address finalVoter = voteDelegation.getFinalDelegatee(userAddress);
```

#### Check Active Delegation
```solidity
function hasActiveDelegation(address account) external view returns (bool)
```
Check if an account is currently delegating.

**Example:**
```solidity
if (voteDelegation.hasActiveDelegation(userAddress)) {
    // User is delegating
}
```

#### Get Delegators
```solidity
function getDelegators(address delegatee) external view returns (address[] memory)
```
Get all addresses delegating to a specific address.

**Example:**
```solidity
address[] memory delegators = voteDelegation.getDelegators(delegateeAddress);
console.log("Number of delegators:", delegators.length);
```

#### Get Delegation History
```solidity
function getDelegationHistory(address account) external view returns (Delegation[] memory)
```
Get the complete delegation history for an account.

**Example:**
```solidity
VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(userAddress);
for (uint i = 0; i < history.length; i++) {
    console.log("Delegated to:", history[i].delegatee);
    console.log("Active:", history[i].active);
}
```

#### Get Historical Voting Power
```solidity
function getVotingPowerAt(address account, uint256 blockNumber) external view returns (uint256)
```
Get voting power at a specific block number.

**Example:**
```solidity
uint256 pastPower = voteDelegation.getVotingPowerAt(userAddress, 12345678);
```

## Common Patterns

### Pattern 1: Simple Delegation
```solidity
// User delegates to a representative
voteDelegation.delegate(representativeAddress);

// Check the representative's new power
uint256 repPower = voteDelegation.getVotingPower(representativeAddress);
```

### Pattern 2: Change Delegation
```solidity
// User changes their delegation
voteDelegation.delegate(newRepresentativeAddress);
// Old delegation is automatically removed
```

### Pattern 3: Reclaim Voting Power
```solidity
// User wants to vote themselves
voteDelegation.undelegate();

// Now user has their full voting power
uint256 myPower = voteDelegation.getVotingPower(msg.sender);
```

### Pattern 4: Check Delegation Status
```solidity
if (voteDelegation.hasActiveDelegation(userAddress)) {
    VoteDelegation.Delegation memory current = voteDelegation.getCurrentDelegation(userAddress);
    console.log("Delegating to:", current.delegatee);
} else {
    console.log("Not delegating");
}
```

### Pattern 5: Trace Delegation Chain
```solidity
VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(userAddress);

console.log("Delegation chain:");
for (uint i = 0; i < chain.chain.length; i++) {
    console.log("  ->", chain.chain[i]);
}
console.log("Final voting power:", chain.totalPower);
```

### Pattern 6: Get All Delegators
```solidity
address[] memory myDelegators = voteDelegation.getDelegators(msg.sender);

console.log("I have", myDelegators.length, "delegators:");
for (uint i = 0; i < myDelegators.length; i++) {
    uint256 delegatorPower = governanceToken.balanceOf(myDelegators[i]);
    console.log("  -", myDelegators[i], "with", delegatorPower, "tokens");
}
```

## Events to Listen For

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
Emitted when a delegation is changed.

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

## Error Handling

### Common Errors

```solidity
// ZeroAddress - Cannot delegate to zero address
try voteDelegation.delegate(address(0)) {
} catch Error(string memory reason) {
    // Handle error
}

// SelfDelegation - Cannot delegate to yourself
try voteDelegation.delegate(msg.sender) {
} catch Error(string memory reason) {
    // Handle error
}

// DelegationLoop - Would create a circular delegation
try voteDelegation.delegate(someAddress) {
} catch Error(string memory reason) {
    // Handle error
}

// NoActiveDelegation - Cannot undelegate when not delegating
try voteDelegation.undelegate() {
} catch Error(string memory reason) {
    // Handle error
}
```

## Testing Examples

### Basic Test
```solidity
function testDelegation() public {
    // Setup
    address alice = address(0x1);
    address bob = address(0x2);
    
    // Alice delegates to Bob
    vm.prank(alice);
    voteDelegation.delegate(bob);
    
    // Verify
    assertTrue(voteDelegation.hasActiveDelegation(alice));
    assertEq(voteDelegation.getFinalDelegatee(alice), bob);
}
```

### Chain Test
```solidity
function testDelegationChain() public {
    // Create chain: alice -> bob -> carol
    vm.prank(alice);
    voteDelegation.delegate(bob);
    
    vm.prank(bob);
    voteDelegation.delegate(carol);
    
    // Verify chain
    VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
    assertEq(chain.depth, 2);
    assertEq(chain.chain[0], alice);
    assertEq(chain.chain[1], bob);
    assertEq(chain.chain[2], carol);
}
```

## Best Practices

1. **Always Check Active Delegation**: Before undelegating, check if there's an active delegation
2. **Monitor Events**: Listen to delegation events for real-time updates
3. **Use Historical Queries**: For snapshot voting, use `getVotingPowerAt()`
4. **Validate Addresses**: Always validate addresses before delegation
5. **Gas Optimization**: Batch queries when possible
6. **Chain Depth**: Be aware of the MAX_CHAIN_DEPTH limit (10 levels)

## Integration with Governance

```solidity
// In your voting contract
function castVote(uint256 proposalId, VoteChoice choice) external {
    // Get voting power from delegation contract
    uint256 votingPower = voteDelegation.getVotingPower(msg.sender);
    
    require(votingPower > 0, "No voting power");
    
    // Cast vote with delegated power
    _recordVote(proposalId, msg.sender, choice, votingPower);
}
```

## Troubleshooting

### Issue: "DelegationLoop" error
**Solution**: You're trying to create a circular delegation. Check the delegation chain before delegating.

### Issue: "MaxChainDepthExceeded" error
**Solution**: The delegation chain is too deep (>10 levels). Delegate to someone with a shorter chain.

### Issue: Voting power not updating
**Solution**: Ensure token balances are updated before querying voting power. The contract reads from the governance token.

### Issue: "NoActiveDelegation" when undelegating
**Solution**: Check if you have an active delegation using `hasActiveDelegation()` before calling `undelegate()`.

## Gas Costs (Approximate)

- `delegate()`: ~150,000 gas (first delegation)
- `delegate()` (change): ~100,000 gas
- `undelegate()`: ~80,000 gas
- `getVotingPower()`: ~5,000 gas (view)
- `getDelegationChain()`: ~10,000 gas (view)

## Support & Resources

- Contract: `contracts/VoteDelegation.sol`
- Tests: `test/VoteDelegation.t.sol`
- Full Documentation: `VOTE_DELEGATION_IMPLEMENTATION.md`
- GitHub Issues: [Report bugs or request features]

## Quick Commands

```bash
# Compile
forge build

# Test everything
forge test --match-contract VoteDelegationTest

# Test with gas report
forge test --match-contract VoteDelegationTest --gas-report

# Test specific function
forge test --match-test test_delegate_createsDelegation -vvv

# Coverage
forge coverage --match-contract VoteDelegationTest

# Format code
forge fmt
```
