# MarketDelegation Quick Reference

## Quick Start

```solidity
// 1. Request delegation
bytes32 delegationId = marketDelegation.requestDelegation(
    delegateeAddress,
    marketId,      // 0 for global
    duration       // 0 for no expiration
);

// 2. Activate delegation
marketDelegation.activateDelegation(delegationId);

// 3. Grant permissions
marketDelegation.grantPermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);

// 4. Check permission
bool canTrade = marketDelegation.hasPermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);

// 5. Revoke delegation
marketDelegation.revokeDelegation(delegationId);
```

## Permission Types

| Permission | Description |
|------------|-------------|
| `TRADE` | Execute trades on behalf of delegator |
| `CREATE_MARKET` | Create new markets |
| `RESOLVE_MARKET` | Resolve market outcomes |
| `MANAGE_LIQUIDITY` | Add/remove liquidity |
| `ADMIN` | Full administrative permissions |

## Delegation Status

| Status | Description |
|--------|-------------|
| `PENDING` | Requested but not active |
| `ACTIVE` | Currently active |
| `REVOKED` | Revoked by delegator |
| `EXPIRED` | Time limit reached |

## Key Functions

### Write Functions

```solidity
// Request new delegation
requestDelegation(address delegatee, uint256 marketId, uint256 duration)
  → returns bytes32 delegationId

// Activate pending delegation
activateDelegation(bytes32 delegationId)

// Revoke delegation
revokeDelegation(bytes32 delegationId)

// Grant single permission
grantPermission(bytes32 delegationId, Permission permission)

// Grant multiple permissions
grantPermissions(bytes32 delegationId, Permission[] permissions)

// Revoke permission
revokePermission(bytes32 delegationId, Permission permission)

// Admin: Expire delegation
expireDelegation(bytes32 delegationId) [onlyOwner]
```

### Read Functions

```solidity
// Get delegation details
getDelegation(bytes32 delegationId)
  → returns Delegation

// Get delegation status
getDelegationStatus(bytes32 delegationId)
  → returns DelegationStatus

// Check if active
isDelegationActive(bytes32 delegationId)
  → returns bool

// Check permission
hasPermission(bytes32 delegationId, Permission permission)
  → returns bool

// Get granted permissions
getGrantedPermissions(bytes32 delegationId)
  → returns Permission[]

// Get delegations by delegator
getDelegationsByDelegator(address delegator)
  → returns bytes32[]

// Get delegations by delegatee
getDelegationsByDelegatee(address delegatee)
  → returns bytes32[]

// Get delegations by market
getDelegationsByMarket(uint256 marketId)
  → returns bytes32[]

// Get statistics
getDelegationStats()
  → returns DelegationStats

// Get counts
getTotalDelegations() → returns uint256
getActiveDelegations() → returns uint256
```

## Common Patterns

### Pattern 1: Simple Delegation
```solidity
// Alice delegates trading to Bob for Market 1
vm.prank(alice);
bytes32 id = delegation.requestDelegation(bob, 1, 0);

vm.prank(alice);
delegation.activateDelegation(id);

vm.prank(alice);
delegation.grantPermission(id, Permission.TRADE);
```

### Pattern 2: Time-Limited Delegation
```solidity
// Alice delegates to Bob for 7 days
vm.prank(alice);
bytes32 id = delegation.requestDelegation(bob, 1, 7 days);

vm.prank(alice);
delegation.activateDelegation(id);

vm.prank(alice);
delegation.grantPermission(id, Permission.TRADE);

// After 7 days, delegation automatically expires
```

### Pattern 3: Global Delegation
```solidity
// Alice delegates to Bob for all markets
vm.prank(alice);
bytes32 id = delegation.requestDelegation(bob, 0, 0);

vm.prank(alice);
delegation.activateDelegation(id);

// Grant multiple permissions
Permission[] memory perms = new Permission[](2);
perms[0] = Permission.TRADE;
perms[1] = Permission.MANAGE_LIQUIDITY;

vm.prank(alice);
delegation.grantPermissions(id, perms);
```

### Pattern 4: Permission Management
```solidity
// Grant permission
vm.prank(alice);
delegation.grantPermission(id, Permission.TRADE);

// Check permission
bool canTrade = delegation.hasPermission(id, Permission.TRADE);

// Revoke permission
vm.prank(alice);
delegation.revokePermission(id, Permission.TRADE);
```

### Pattern 5: Query Delegations
```solidity
// Get all delegations by Alice
bytes32[] memory aliceDelegations = 
    delegation.getDelegationsByDelegator(alice);

// Get all delegations to Bob
bytes32[] memory bobDelegations = 
    delegation.getDelegationsByDelegatee(bob);

// Get all delegations for Market 1
bytes32[] memory market1Delegations = 
    delegation.getDelegationsByMarket(1);
```

## Events to Monitor

```solidity
// Listen for delegation requests
event DelegationRequested(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 marketId,
    uint256 timestamp
);

// Listen for activations
event DelegationActivated(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);

// Listen for revocations
event DelegationRevoked(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);

// Listen for permission changes
event PermissionGranted(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);

event PermissionRevoked(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);
```

## Error Reference

| Error | Cause |
|-------|-------|
| `ZeroAddress()` | Used zero address |
| `SelfDelegation()` | Tried to delegate to self |
| `DelegationNotFound()` | Invalid delegation ID |
| `DelegationAlreadyExists()` | Duplicate delegation |
| `DelegationNotActive()` | Delegation not active |
| `UnauthorizedDelegator()` | Not the delegator |
| `PermissionAlreadyGranted()` | Permission already granted |
| `PermissionNotGranted()` | Permission not granted |
| `MaxDelegationsExceeded()` | Too many delegations |

## Constants

```solidity
MAX_DELEGATIONS_PER_DELEGATOR = 100
MAX_DELEGATION_DURATION = 365 days
```

## Testing Commands

```bash
# Run all tests
forge test --match-path test/MarketDelegation.t.sol -vv

# Run specific test
forge test --match-test test_requestDelegation_success -vv

# Gas report
forge test --match-path test/MarketDelegation.t.sol --gas-report

# Coverage
forge coverage --match-path test/MarketDelegation.t.sol
```

## Integration Example

```solidity
contract TradingWithDelegation {
    MarketDelegation public delegation;
    
    function executeTrade(
        bytes32 delegationId,
        uint256 marketId,
        uint256 amount
    ) external {
        // Verify delegation is active
        require(
            delegation.isDelegationActive(delegationId),
            "Delegation not active"
        );
        
        // Verify permission
        require(
            delegation.hasPermission(
                delegationId,
                MarketDelegation.Permission.TRADE
            ),
            "No trade permission"
        );
        
        // Get delegation details
        MarketDelegation.Delegation memory del = 
            delegation.getDelegation(delegationId);
        
        // Execute trade on behalf of delegator
        _executeTrade(del.delegator, marketId, amount);
    }
}
```

## Best Practices

✅ **DO:**
- Always activate delegations after requesting
- Grant minimal necessary permissions
- Use time-limited delegations for temporary access
- Monitor delegation events for audit trails
- Revoke delegations when no longer needed

❌ **DON'T:**
- Don't delegate to untrusted addresses
- Don't grant ADMIN permission unless absolutely necessary
- Don't forget to revoke delegations
- Don't use global delegations (marketId = 0) without careful consideration
- Don't exceed the maximum delegation limit

## Security Checklist

- ✅ Reentrancy protection on all state-changing functions
- ✅ Access control for delegation management
- ✅ Input validation (zero address, self-delegation)
- ✅ Automatic expiration handling
- ✅ Permission revocation on delegation revocation
- ✅ Maximum delegation limits enforced
- ✅ Custom errors for gas efficiency

## Support

For detailed documentation, see `MARKET_DELEGATION_README.md`

For implementation details, see `contracts/MarketDelegation.sol`

For test examples, see `test/MarketDelegation.t.sol`
