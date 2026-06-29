# MarketDelegation Contract

## Overview

The `MarketDelegation` contract provides a comprehensive delegation system for prediction markets, enabling users to delegate specific permissions to other addresses for market operations. This system supports fine-grained permission management, delegation lifecycle tracking, and comprehensive querying capabilities.

## Features

### ✅ Delegation Request Handling
- Create delegation requests with specific market scope or global scope
- Support for time-limited delegations with configurable expiration
- Unique delegation ID generation for tracking
- Prevention of self-delegation and circular delegation patterns
- Maximum delegation limits per delegator (100 delegations)

### ✅ Delegation Status Tracking
- **PENDING**: Delegation requested but not yet active
- **ACTIVE**: Delegation is currently active and permissions are enforced
- **REVOKED**: Delegation was revoked by the delegator
- **EXPIRED**: Delegation expired due to time limit

### ✅ Permission Management
- **TRADE**: Permission to execute trades on behalf of delegator
- **CREATE_MARKET**: Permission to create new markets
- **RESOLVE_MARKET**: Permission to resolve market outcomes
- **MANAGE_LIQUIDITY**: Permission to add/remove liquidity
- **ADMIN**: Full administrative permissions

### ✅ Delegation Revocation
- Delegators can revoke delegations at any time
- Automatic permission revocation when delegation is revoked
- Support for revoking both pending and active delegations
- Active delegation count tracking

### ✅ Comprehensive Queries
- Get delegation details by ID
- Check delegation status and activity
- Query permissions for specific delegations
- List delegations by delegator, delegatee, or market
- Get delegation statistics and counts

## Contract Architecture

### Inheritance
```solidity
contract MarketDelegation is Ownable, ReentrancyGuard
```

- **Ownable**: Provides ownership control for admin functions
- **ReentrancyGuard**: Protects against reentrancy attacks

### Key Data Structures

#### Delegation
```solidity
struct Delegation {
    address delegator;      // Address delegating permissions
    address delegatee;      // Address receiving permissions
    uint256 marketId;       // Market ID (0 for global delegation)
    DelegationStatus status; // Current status
    uint256 createdAt;      // Timestamp of creation
    uint256 revokedAt;      // Timestamp of revocation
    uint256 expiresAt;      // Expiration timestamp (0 for no expiration)
}
```

#### PermissionGrant
```solidity
struct PermissionGrant {
    Permission permission;
    bool granted;
    uint256 grantedAt;
}
```

## Usage Guide

### 1. Request a Delegation

```solidity
// Request delegation for a specific market
bytes32 delegationId = marketDelegation.requestDelegation(
    delegateeAddress,  // Address to delegate to
    marketId,          // Market ID (0 for global)
    duration           // Duration in seconds (0 for no expiration)
);
```

**Example:**
```solidity
// Delegate to Bob for Market 1, expires in 7 days
bytes32 delegationId = marketDelegation.requestDelegation(
    0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,
    1,
    7 days
);
```

### 2. Activate a Delegation

```solidity
// Activate a pending delegation
marketDelegation.activateDelegation(delegationId);
```

### 3. Grant Permissions

```solidity
// Grant a single permission
marketDelegation.grantPermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);

// Grant multiple permissions at once
MarketDelegation.Permission[] memory permissions = new MarketDelegation.Permission[](2);
permissions[0] = MarketDelegation.Permission.TRADE;
permissions[1] = MarketDelegation.Permission.CREATE_MARKET;

marketDelegation.grantPermissions(delegationId, permissions);
```

### 4. Check Permissions

```solidity
// Check if a delegation has a specific permission
bool canTrade = marketDelegation.hasPermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);

// Get all granted permissions
MarketDelegation.Permission[] memory permissions = 
    marketDelegation.getGrantedPermissions(delegationId);
```

### 5. Query Delegations

```solidity
// Get delegation details
MarketDelegation.Delegation memory delegation = 
    marketDelegation.getDelegation(delegationId);

// Check if delegation is active
bool isActive = marketDelegation.isDelegationActive(delegationId);

// Get all delegations by delegator
bytes32[] memory myDelegations = 
    marketDelegation.getDelegationsByDelegator(myAddress);

// Get all delegations to a delegatee
bytes32[] memory receivedDelegations = 
    marketDelegation.getDelegationsByDelegatee(delegateeAddress);

// Get all delegations for a market
bytes32[] memory marketDelegations = 
    marketDelegation.getDelegationsByMarket(marketId);
```

### 6. Revoke a Delegation

```solidity
// Revoke an active or pending delegation
marketDelegation.revokeDelegation(delegationId);
```

### 7. Revoke Specific Permissions

```solidity
// Revoke a single permission while keeping delegation active
marketDelegation.revokePermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);
```

## Events

### DelegationRequested
```solidity
event DelegationRequested(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 marketId,
    uint256 timestamp
);
```

### DelegationActivated
```solidity
event DelegationActivated(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```

### DelegationRevoked
```solidity
event DelegationRevoked(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```

### PermissionGranted
```solidity
event PermissionGranted(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);
```

### PermissionRevoked
```solidity
event PermissionRevoked(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);
```

## Error Handling

The contract uses custom errors for gas-efficient error handling:

- `ZeroAddress()`: Attempted to use zero address
- `SelfDelegation()`: Attempted to delegate to self
- `DelegationLoop()`: Delegation would create a loop
- `InvalidMarketId()`: Invalid market ID provided
- `DelegationNotFound()`: Delegation ID does not exist
- `DelegationAlreadyExists()`: Delegation already exists
- `DelegationNotActive()`: Delegation is not in active state
- `UnauthorizedDelegator()`: Caller is not the delegator
- `InvalidPermission()`: Invalid permission or duration
- `PermissionAlreadyGranted()`: Permission already granted
- `PermissionNotGranted()`: Permission not granted
- `MaxDelegationsExceeded()`: Exceeded maximum delegations per delegator

## Security Features

### 1. Reentrancy Protection
All state-changing functions are protected with the `nonReentrant` modifier.

### 2. Access Control
- Only delegators can activate, revoke, or manage permissions for their delegations
- Owner can expire delegations in emergency situations

### 3. Input Validation
- Zero address checks
- Self-delegation prevention
- Maximum delegation duration enforcement (365 days)
- Maximum delegations per delegator (100)

### 4. Automatic Expiration
Delegations with expiration times are automatically considered expired when queried after the expiration timestamp.

## Testing

The contract includes comprehensive tests covering:

### Delegation Request Tests
- ✅ Successful delegation request
- ✅ Event emission
- ✅ Global market delegation
- ✅ Time-limited delegation
- ✅ Zero address rejection
- ✅ Self-delegation rejection
- ✅ Excessive duration rejection

### Delegation Activation Tests
- ✅ Successful activation
- ✅ Event emission
- ✅ Active count increment
- ✅ Non-existent delegation rejection
- ✅ Unauthorized activation rejection
- ✅ Double activation rejection

### Delegation Revocation Tests
- ✅ Successful revocation
- ✅ Event emission
- ✅ Active count decrement
- ✅ Unauthorized revocation rejection
- ✅ Pending delegation revocation

### Permission Management Tests
- ✅ Single permission grant
- ✅ Multiple permission grants
- ✅ Batch permission grants
- ✅ Permission revocation
- ✅ Duplicate permission rejection
- ✅ Inactive delegation rejection

### Query Function Tests
- ✅ Delegation details retrieval
- ✅ Active status checking
- ✅ Permission checking
- ✅ Delegator delegation listing
- ✅ Delegatee delegation listing
- ✅ Market delegation listing
- ✅ Total delegation counting

### Expiration Tests
- ✅ Automatic expiration after duration
- ✅ Permission invalidation after expiration

### Admin Function Tests
- ✅ Owner can expire delegations
- ✅ Non-owner cannot expire delegations

### Integration Tests
- ✅ Multiple independent delegations
- ✅ Permission revocation on delegation revocation
- ✅ Global delegation functionality

## Running Tests

```bash
# Navigate to Contracts directory
cd Contracts

# Run all MarketDelegation tests
forge test --match-path test/MarketDelegation.t.sol -vv

# Run specific test
forge test --match-test test_requestDelegation_success -vv

# Run with gas reporting
forge test --match-path test/MarketDelegation.t.sol --gas-report

# Run with coverage
forge coverage --match-path test/MarketDelegation.t.sol
```

## Integration with Other Contracts

### Trading Contract Integration
```solidity
// Check if delegatee can trade on behalf of delegator
function executeTrade(bytes32 delegationId, ...) external {
    require(
        marketDelegation.hasPermission(
            delegationId,
            MarketDelegation.Permission.TRADE
        ),
        "No trade permission"
    );
    // Execute trade logic
}
```

### Market Factory Integration
```solidity
// Check if delegatee can create markets on behalf of delegator
function createMarket(bytes32 delegationId, ...) external {
    require(
        marketDelegation.hasPermission(
            delegationId,
            MarketDelegation.Permission.CREATE_MARKET
        ),
        "No create permission"
    );
    // Create market logic
}
```

## Gas Optimization

The contract implements several gas optimization techniques:

1. **Custom Errors**: More gas-efficient than string revert messages
2. **Packed Storage**: Efficient storage layout for structs
3. **Batch Operations**: `grantPermissions` for multiple permissions
4. **View Functions**: Extensive read-only functions for off-chain queries

## Deployment

```solidity
// Deploy the contract
MarketDelegation marketDelegation = new MarketDelegation();

// The deployer becomes the owner
// Owner can expire delegations in emergencies
```

## Best Practices

1. **Always activate delegations** after requesting them
2. **Grant minimal permissions** needed for the delegatee's role
3. **Use time-limited delegations** for temporary access
4. **Monitor delegation events** for audit trails
5. **Revoke delegations** when no longer needed
6. **Use global delegations** (marketId = 0) sparingly

## Acceptance Criteria

✅ **Requests are handled**: Delegation requests can be created with proper validation

✅ **Status is tracked**: Delegation status transitions (PENDING → ACTIVE → REVOKED/EXPIRED) are properly tracked

✅ **Permissions are managed**: Fine-grained permissions can be granted and revoked

✅ **Revocation works**: Delegations can be revoked by delegators at any time

✅ **Queries work**: Comprehensive query functions provide full visibility into delegations

## Future Enhancements

Potential improvements for future versions:

1. **Delegation Chains**: Support for multi-level delegation
2. **Permission Scopes**: More granular permission scoping per market
3. **Delegation Limits**: Per-market delegation limits
4. **Delegation Fees**: Optional fees for delegation services
5. **Delegation Voting**: Delegatee voting on behalf of delegator
6. **Batch Revocation**: Revoke multiple delegations at once
7. **Delegation Templates**: Pre-configured permission sets

## License

MIT License

## Contact

For questions or issues, please refer to the main project documentation or open an issue on the repository.
