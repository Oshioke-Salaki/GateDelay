# MarketDelegation API Reference

## Contract Overview

**Contract Name**: `MarketDelegation`  
**Inheritance**: `Ownable`, `ReentrancyGuard`  
**License**: MIT  
**Solidity Version**: ^0.8.20  

## Table of Contents

1. [Enums](#enums)
2. [Structs](#structs)
3. [Events](#events)
4. [Errors](#errors)
5. [Constants](#constants)
6. [State Variables](#state-variables)
7. [Functions](#functions)
   - [Write Functions](#write-functions)
   - [Read Functions](#read-functions)
   - [Admin Functions](#admin-functions)

---

## Enums

### DelegationStatus

Represents the current status of a delegation.

```solidity
enum DelegationStatus {
    PENDING,    // Delegation requested but not yet active
    ACTIVE,     // Delegation is currently active
    REVOKED,    // Delegation was revoked by delegator
    EXPIRED     // Delegation expired (if time-limited)
}
```

**Values**:
- `PENDING` (0): Initial state after delegation request
- `ACTIVE` (1): Delegation is active and permissions are enforced
- `REVOKED` (2): Delegation was revoked by the delegator
- `EXPIRED` (3): Delegation expired due to time limit

### Permission

Types of permissions that can be delegated.

```solidity
enum Permission {
    TRADE,          // Permission to execute trades
    CREATE_MARKET,  // Permission to create markets
    RESOLVE_MARKET, // Permission to resolve markets
    MANAGE_LIQUIDITY, // Permission to add/remove liquidity
    ADMIN           // Full administrative permissions
}
```

**Values**:
- `TRADE` (0): Execute trades on behalf of delegator
- `CREATE_MARKET` (1): Create new markets
- `RESOLVE_MARKET` (2): Resolve market outcomes
- `MANAGE_LIQUIDITY` (3): Add/remove liquidity
- `ADMIN` (4): Full administrative permissions

---

## Structs

### Delegation

Represents a delegation record.

```solidity
struct Delegation {
    address delegator;      // Address delegating permissions
    address delegatee;      // Address receiving permissions
    uint256 marketId;       // Market ID (0 for global delegation)
    DelegationStatus status; // Current status
    uint256 createdAt;      // Timestamp of creation
    uint256 revokedAt;      // Timestamp of revocation (0 if not revoked)
    uint256 expiresAt;      // Expiration timestamp (0 for no expiration)
}
```

**Fields**:
- `delegator`: The address that created the delegation
- `delegatee`: The address receiving delegated permissions
- `marketId`: Specific market ID or 0 for global delegation
- `status`: Current delegation status (see DelegationStatus enum)
- `createdAt`: Unix timestamp when delegation was created
- `revokedAt`: Unix timestamp when delegation was revoked (0 if not revoked)
- `expiresAt`: Unix timestamp when delegation expires (0 for no expiration)

### PermissionGrant

Represents a permission grant record.

```solidity
struct PermissionGrant {
    Permission permission;
    bool granted;
    uint256 grantedAt;
}
```

**Fields**:
- `permission`: The type of permission granted
- `granted`: Whether the permission is currently granted
- `grantedAt`: Unix timestamp when permission was granted

### DelegationStats

Delegation statistics.

```solidity
struct DelegationStats {
    uint256 totalDelegations;
    uint256 activeDelegations;
    uint256 revokedDelegations;
    uint256 expiredDelegations;
}
```

**Fields**:
- `totalDelegations`: Total number of delegations created
- `activeDelegations`: Number of currently active delegations
- `revokedDelegations`: Number of revoked delegations
- `expiredDelegations`: Number of expired delegations

---

## Events

### DelegationRequested

Emitted when a new delegation is requested.

```solidity
event DelegationRequested(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 marketId,
    uint256 timestamp
);
```

**Parameters**:
- `delegationId`: Unique identifier for the delegation
- `delegator`: Address creating the delegation
- `delegatee`: Address receiving the delegation
- `marketId`: Market ID (0 for global)
- `timestamp`: Block timestamp

### DelegationActivated

Emitted when a delegation is activated.

```solidity
event DelegationActivated(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```

### DelegationRevoked

Emitted when a delegation is revoked.

```solidity
event DelegationRevoked(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```

### DelegationExpired

Emitted when a delegation expires.

```solidity
event DelegationExpired(
    bytes32 indexed delegationId,
    address indexed delegator,
    address indexed delegatee,
    uint256 timestamp
);
```

### PermissionGranted

Emitted when a permission is granted.

```solidity
event PermissionGranted(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);
```

### PermissionRevoked

Emitted when a permission is revoked.

```solidity
event PermissionRevoked(
    bytes32 indexed delegationId,
    address indexed delegatee,
    Permission indexed permission,
    uint256 timestamp
);
```

### DelegationStatusChanged

Emitted when delegation status changes.

```solidity
event DelegationStatusChanged(
    bytes32 indexed delegationId,
    DelegationStatus oldStatus,
    DelegationStatus newStatus
);
```

---

## Errors

### ZeroAddress
```solidity
error ZeroAddress();
```
Thrown when a zero address is provided where a valid address is required.

### SelfDelegation
```solidity
error SelfDelegation();
```
Thrown when attempting to delegate to oneself.

### DelegationLoop
```solidity
error DelegationLoop();
```
Thrown when a delegation would create a circular reference.

### InvalidMarketId
```solidity
error InvalidMarketId();
```
Thrown when an invalid market ID is provided.

### DelegationNotFound
```solidity
error DelegationNotFound();
```
Thrown when a delegation ID does not exist.

### DelegationAlreadyExists
```solidity
error DelegationAlreadyExists();
```
Thrown when attempting to create a duplicate delegation.

### DelegationNotActive
```solidity
error DelegationNotActive();
```
Thrown when attempting an operation that requires an active delegation.

### UnauthorizedDelegator
```solidity
error UnauthorizedDelegator();
```
Thrown when caller is not the delegator of the delegation.

### InvalidPermission
```solidity
error InvalidPermission();
```
Thrown when an invalid permission or duration is provided.

### PermissionAlreadyGranted
```solidity
error PermissionAlreadyGranted();
```
Thrown when attempting to grant an already granted permission.

### PermissionNotGranted
```solidity
error PermissionNotGranted();
```
Thrown when attempting to revoke a permission that was not granted.

### MaxDelegationsExceeded
```solidity
error MaxDelegationsExceeded();
```
Thrown when exceeding the maximum number of delegations per delegator.

---

## Constants

### MAX_DELEGATIONS_PER_DELEGATOR
```solidity
uint256 public constant MAX_DELEGATIONS_PER_DELEGATOR = 100;
```
Maximum number of delegations a single delegator can create.

### MAX_DELEGATION_DURATION
```solidity
uint256 public constant MAX_DELEGATION_DURATION = 365 days;
```
Maximum duration for a time-limited delegation (365 days).

---

## State Variables

All state variables are private for encapsulation. Access is provided through public view functions.

---

## Functions

### Write Functions

#### requestDelegation

Request a new delegation.

```solidity
function requestDelegation(
    address delegatee,
    uint256 marketId,
    uint256 duration
) external nonReentrant returns (bytes32 delegationId)
```

**Parameters**:
- `delegatee`: Address to delegate to (cannot be zero or self)
- `marketId`: Market ID (0 for global delegation)
- `duration`: Duration in seconds (0 for no expiration, max 365 days)

**Returns**:
- `delegationId`: Unique identifier for the delegation

**Emits**:
- `DelegationRequested`

**Reverts**:
- `ZeroAddress()`: If delegatee is zero address
- `SelfDelegation()`: If delegatee is msg.sender
- `InvalidPermission()`: If duration exceeds maximum
- `MaxDelegationsExceeded()`: If delegator has too many delegations

**Example**:
```solidity
bytes32 id = marketDelegation.requestDelegation(
    0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,
    1,
    7 days
);
```

---

#### activateDelegation

Activate a pending delegation.

```solidity
function activateDelegation(bytes32 delegationId) external nonReentrant
```

**Parameters**:
- `delegationId`: ID of the delegation to activate

**Emits**:
- `DelegationStatusChanged`
- `DelegationActivated`

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `UnauthorizedDelegator()`: If caller is not the delegator
- `DelegationNotActive()`: If delegation is not in PENDING status

**Example**:
```solidity
marketDelegation.activateDelegation(delegationId);
```

---

#### revokeDelegation

Revoke an active or pending delegation.

```solidity
function revokeDelegation(bytes32 delegationId) external nonReentrant
```

**Parameters**:
- `delegationId`: ID of the delegation to revoke

**Emits**:
- `DelegationStatusChanged`
- `DelegationRevoked`

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `UnauthorizedDelegator()`: If caller is not the delegator
- `DelegationNotActive()`: If delegation is already revoked or expired

**Side Effects**:
- Revokes all granted permissions
- Decrements active delegation counter

**Example**:
```solidity
marketDelegation.revokeDelegation(delegationId);
```

---

#### grantPermission

Grant a single permission to a delegation.

```solidity
function grantPermission(
    bytes32 delegationId,
    Permission permission
) external nonReentrant
```

**Parameters**:
- `delegationId`: ID of the delegation
- `permission`: Permission to grant

**Emits**:
- `PermissionGranted`

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `UnauthorizedDelegator()`: If caller is not the delegator
- `DelegationNotActive()`: If delegation is not active
- `PermissionAlreadyGranted()`: If permission already granted

**Example**:
```solidity
marketDelegation.grantPermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);
```

---

#### revokePermission

Revoke a specific permission from a delegation.

```solidity
function revokePermission(
    bytes32 delegationId,
    Permission permission
) external nonReentrant
```

**Parameters**:
- `delegationId`: ID of the delegation
- `permission`: Permission to revoke

**Emits**:
- `PermissionRevoked`

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `UnauthorizedDelegator()`: If caller is not the delegator
- `PermissionNotGranted()`: If permission was not granted

**Example**:
```solidity
marketDelegation.revokePermission(
    delegationId,
    MarketDelegation.Permission.TRADE
);
```

---

#### grantPermissions

Grant multiple permissions at once.

```solidity
function grantPermissions(
    bytes32 delegationId,
    Permission[] calldata permissions
) external nonReentrant
```

**Parameters**:
- `delegationId`: ID of the delegation
- `permissions`: Array of permissions to grant

**Emits**:
- `PermissionGranted` (for each permission)

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `UnauthorizedDelegator()`: If caller is not the delegator
- `DelegationNotActive()`: If delegation is not active

**Note**: Skips permissions that are already granted

**Example**:
```solidity
Permission[] memory perms = new Permission[](2);
perms[0] = Permission.TRADE;
perms[1] = Permission.CREATE_MARKET;
marketDelegation.grantPermissions(delegationId, perms);
```

---

### Read Functions

#### getDelegation

Get full delegation details.

```solidity
function getDelegation(bytes32 delegationId) 
    external view returns (Delegation memory)
```

**Parameters**:
- `delegationId`: ID of the delegation

**Returns**:
- `Delegation`: Full delegation struct

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist

**Example**:
```solidity
Delegation memory del = marketDelegation.getDelegation(delegationId);
```

---

#### getDelegationStatus

Get current delegation status.

```solidity
function getDelegationStatus(bytes32 delegationId) 
    external view returns (DelegationStatus)
```

**Parameters**:
- `delegationId`: ID of the delegation

**Returns**:
- `DelegationStatus`: Current status (checks expiration)

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist

**Example**:
```solidity
DelegationStatus status = marketDelegation.getDelegationStatus(delegationId);
```

---

#### isDelegationActive

Check if a delegation is currently active.

```solidity
function isDelegationActive(bytes32 delegationId) 
    external view returns (bool)
```

**Parameters**:
- `delegationId`: ID of the delegation

**Returns**:
- `bool`: True if delegation is active and not expired

**Example**:
```solidity
bool isActive = marketDelegation.isDelegationActive(delegationId);
```

---

#### hasPermission

Check if a delegation has a specific permission.

```solidity
function hasPermission(
    bytes32 delegationId,
    Permission permission
) external view returns (bool)
```

**Parameters**:
- `delegationId`: ID of the delegation
- `permission`: Permission to check

**Returns**:
- `bool`: True if permission is granted and delegation is active

**Example**:
```solidity
bool canTrade = marketDelegation.hasPermission(
    delegationId,
    Permission.TRADE
);
```

---

#### getGrantedPermissions

Get all granted permissions for a delegation.

```solidity
function getGrantedPermissions(bytes32 delegationId) 
    external view returns (Permission[] memory)
```

**Parameters**:
- `delegationId`: ID of the delegation

**Returns**:
- `Permission[]`: Array of granted permissions

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist

**Example**:
```solidity
Permission[] memory perms = marketDelegation.getGrantedPermissions(delegationId);
```

---

#### getDelegationsByDelegator

Get all delegations created by a delegator.

```solidity
function getDelegationsByDelegator(address delegator) 
    external view returns (bytes32[] memory)
```

**Parameters**:
- `delegator`: Address of the delegator

**Returns**:
- `bytes32[]`: Array of delegation IDs

**Example**:
```solidity
bytes32[] memory myDelegations = 
    marketDelegation.getDelegationsByDelegator(msg.sender);
```

---

#### getDelegationsByDelegatee

Get all delegations received by a delegatee.

```solidity
function getDelegationsByDelegatee(address delegatee) 
    external view returns (bytes32[] memory)
```

**Parameters**:
- `delegatee`: Address of the delegatee

**Returns**:
- `bytes32[]`: Array of delegation IDs

**Example**:
```solidity
bytes32[] memory receivedDelegations = 
    marketDelegation.getDelegationsByDelegatee(delegateeAddress);
```

---

#### getDelegationsByMarket

Get all delegations for a specific market.

```solidity
function getDelegationsByMarket(uint256 marketId) 
    external view returns (bytes32[] memory)
```

**Parameters**:
- `marketId`: Market ID

**Returns**:
- `bytes32[]`: Array of delegation IDs

**Example**:
```solidity
bytes32[] memory marketDelegations = 
    marketDelegation.getDelegationsByMarket(1);
```

---

#### getDelegationStats

Get delegation statistics.

```solidity
function getDelegationStats() 
    external view returns (DelegationStats memory)
```

**Returns**:
- `DelegationStats`: Statistics struct

**Example**:
```solidity
DelegationStats memory stats = marketDelegation.getDelegationStats();
```

---

#### getTotalDelegations

Get total number of delegations created.

```solidity
function getTotalDelegations() external view returns (uint256)
```

**Returns**:
- `uint256`: Total delegation count

**Example**:
```solidity
uint256 total = marketDelegation.getTotalDelegations();
```

---

#### getActiveDelegations

Get number of currently active delegations.

```solidity
function getActiveDelegations() external view returns (uint256)
```

**Returns**:
- `uint256`: Active delegation count

**Example**:
```solidity
uint256 active = marketDelegation.getActiveDelegations();
```

---

### Admin Functions

#### expireDelegation

Emergency function to expire a delegation (owner only).

```solidity
function expireDelegation(bytes32 delegationId) external onlyOwner
```

**Parameters**:
- `delegationId`: ID of the delegation to expire

**Emits**:
- `DelegationStatusChanged`
- `DelegationExpired`

**Reverts**:
- `DelegationNotFound()`: If delegation doesn't exist
- `DelegationNotActive()`: If delegation is not active
- Reverts if caller is not owner (from Ownable)

**Example**:
```solidity
marketDelegation.expireDelegation(delegationId);
```

---

## Usage Patterns

### Pattern 1: Complete Delegation Flow

```solidity
// 1. Request delegation
bytes32 id = marketDelegation.requestDelegation(delegatee, marketId, duration);

// 2. Activate delegation
marketDelegation.activateDelegation(id);

// 3. Grant permissions
marketDelegation.grantPermission(id, Permission.TRADE);

// 4. Check permission
bool canTrade = marketDelegation.hasPermission(id, Permission.TRADE);

// 5. Revoke when done
marketDelegation.revokeDelegation(id);
```

### Pattern 2: Query Delegations

```solidity
// Get all my delegations
bytes32[] memory myDelegations = 
    marketDelegation.getDelegationsByDelegator(msg.sender);

// Check each delegation
for (uint i = 0; i < myDelegations.length; i++) {
    Delegation memory del = marketDelegation.getDelegation(myDelegations[i]);
    bool isActive = marketDelegation.isDelegationActive(myDelegations[i]);
    // Process delegation
}
```

### Pattern 3: Permission Checking in Integration

```solidity
function protectedAction(bytes32 delegationId) external {
    require(
        marketDelegation.isDelegationActive(delegationId),
        "Delegation not active"
    );
    require(
        marketDelegation.hasPermission(delegationId, Permission.TRADE),
        "No trade permission"
    );
    
    Delegation memory del = marketDelegation.getDelegation(delegationId);
    // Execute action on behalf of del.delegator
}
```

---

## Version History

**v1.0.0** (2026-05-29)
- Initial implementation
- All core features implemented
- Comprehensive test coverage
- Full documentation

---

## License

MIT License

---

## Support

For detailed usage examples, see `MARKET_DELEGATION_README.md`

For quick reference, see `MARKET_DELEGATION_QUICK_REFERENCE.md`

For implementation details, see `MARKET_DELEGATION_IMPLEMENTATION_SUMMARY.md`
