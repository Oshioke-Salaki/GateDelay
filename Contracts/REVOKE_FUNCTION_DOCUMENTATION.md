# RevokeFunction Contract Documentation

## Overview

The `RevokeFunction` contract provides comprehensive revoke functionality for smart contracts with permission management, contract revocation tracking, partial revokes, and extensive query capabilities. Built using OpenZeppelin's battle-tested libraries for security and reliability.

## Features

### ✅ Permission Management
- Grant individual or multiple permissions to accounts
- Revoke individual, multiple, or all permissions from accounts
- Track permission holders and account permissions
- Support for custom permission types

### ✅ Contract Revocation
- Fully revoke contracts with reason tracking
- Reinstate previously revoked contracts
- Track revocation status (Active, PartiallyRevoked, FullyRevoked)
- Query all revoked contracts

### ✅ Partial Revoke Tracking
- Complete history of all permission revocations
- Timestamp and reason tracking for each revoke
- Query recent or all partial revokes
- Audit trail for compliance

### ✅ Comprehensive Queries
- Check permissions for accounts
- Get all permission holders
- Query revocation status
- Access partial revoke history
- Utility functions for permission checks

## Architecture

### Inheritance
- `Ownable`: Access control for administrative functions
- `EnumerableSet`: Efficient set operations for permissions and accounts

### Storage Structure

```solidity
// Permission tracking
mapping(address => mapping(bytes32 => bool)) private _permissions;
mapping(address => EnumerableSet.Bytes32Set) private _accountPermissions;
mapping(bytes32 => EnumerableSet.AddressSet) private _permissionHolders;

// Contract revocation tracking
mapping(address => ContractRevocation) private _contractRevocations;
EnumerableSet.AddressSet private _revokedContracts;

// Partial revoke history
mapping(address => PartialRevoke[]) private _partialRevokes;
```

## Permission Types

The contract includes five predefined permission types:

| Permission | Identifier | Description |
|------------|-----------|-------------|
| EXECUTE_PERMISSION | `keccak256("EXECUTE_PERMISSION")` | Permission to execute functions |
| TRANSFER_PERMISSION | `keccak256("TRANSFER_PERMISSION")` | Permission to transfer assets |
| MINT_PERMISSION | `keccak256("MINT_PERMISSION")` | Permission to mint tokens |
| BURN_PERMISSION | `keccak256("BURN_PERMISSION")` | Permission to burn tokens |
| ADMIN_PERMISSION | `keccak256("ADMIN_PERMISSION")` | Administrative permission |

## Core Functions

### Permission Management

#### Grant Permission
```solidity
function grantPermission(address account, bytes32 permission) external onlyOwner
```
Grants a single permission to an account.

**Parameters:**
- `account`: The account to grant permission to
- `permission`: The permission identifier

**Emits:** `PermissionGranted`

#### Grant Multiple Permissions
```solidity
function grantPermissions(address account, bytes32[] calldata permissions) external onlyOwner
```
Grants multiple permissions to an account in a single transaction.

**Parameters:**
- `account`: The account to grant permissions to
- `permissions`: Array of permission identifiers

**Emits:** `PermissionGranted` (for each permission)

#### Revoke Permission
```solidity
function revokePermission(
    address account,
    bytes32 permission,
    string calldata reason
) external onlyOwner
```
Revokes a single permission from an account and records the revocation.

**Parameters:**
- `account`: The account to revoke permission from
- `permission`: The permission identifier
- `reason`: Reason for revocation (for audit trail)

**Emits:** `PermissionRevoked`, `PartialRevokeRecorded`

#### Revoke Multiple Permissions
```solidity
function revokePermissions(
    address account,
    bytes32[] calldata permissions,
    string calldata reason
) external onlyOwner
```
Revokes multiple permissions from an account (partial revoke).

**Parameters:**
- `account`: The account to revoke permissions from
- `permissions`: Array of permission identifiers
- `reason`: Reason for revocation

**Emits:** `PermissionRevoked`, `PartialRevokeRecorded` (for each permission)

#### Revoke All Permissions
```solidity
function revokeAllPermissions(
    address account,
    string calldata reason
) external onlyOwner
```
Revokes all permissions from an account.

**Parameters:**
- `account`: The account to revoke all permissions from
- `reason`: Reason for revocation

**Emits:** `PermissionRevoked` (for each permission)

### Contract Revocation

#### Revoke Contract
```solidity
function revokeContract(
    address contractAddress,
    string calldata reason
) external onlyOwner
```
Fully revokes a contract with reason tracking.

**Parameters:**
- `contractAddress`: The contract address to revoke
- `reason`: Reason for revocation

**Emits:** `ContractRevoked`

#### Reinstate Contract
```solidity
function reinstateContract(address contractAddress) external onlyOwner
```
Reinstates a previously revoked contract.

**Parameters:**
- `contractAddress`: The contract address to reinstate

**Emits:** `ContractReinstated`

#### Update Revocation Status
```solidity
function updateRevocationStatus(
    address contractAddress,
    RevocationStatus status
) external onlyOwner
```
Updates the revocation status of a contract.

**Parameters:**
- `contractAddress`: The contract address
- `status`: New revocation status (Active, PartiallyRevoked, FullyRevoked)

### Query Functions

#### Permission Queries

```solidity
// Check if account has permission
function hasPermission(address account, bytes32 permission) external view returns (bool)

// Get all permissions for an account
function getAccountPermissions(address account) external view returns (bytes32[] memory)

// Get permission count for an account
function getAccountPermissionCount(address account) external view returns (uint256)

// Get all accounts with a specific permission
function getPermissionHolders(bytes32 permission) external view returns (address[] memory)

// Get holder count for a permission
function getPermissionHolderCount(bytes32 permission) external view returns (uint256)

// Get all accounts with any permissions
function getAllAccountsWithPermissions() external view returns (address[] memory)
```

#### Revocation Queries

```solidity
// Check if contract is revoked
function isContractRevoked(address contractAddress) external view returns (bool)

// Get contract revocation details
function getContractRevocation(address contractAddress) 
    external view returns (ContractRevocation memory)

// Get revocation status
function getRevocationStatus(address contractAddress) 
    external view returns (RevocationStatus)

// Get all revoked contracts
function getAllRevokedContracts() external view returns (address[] memory)

// Get count of revoked contracts
function getRevokedContractCount() external view returns (uint256)
```

#### Partial Revoke Queries

```solidity
// Get all partial revokes for an account
function getPartialRevokes(address account) external view returns (PartialRevoke[] memory)

// Get partial revoke count
function getPartialRevokeCount(address account) external view returns (uint256)

// Get specific partial revoke by index
function getPartialRevokeByIndex(address account, uint256 index) 
    external view returns (PartialRevoke memory)

// Get recent partial revokes
function getRecentPartialRevokes(address account, uint256 count) 
    external view returns (PartialRevoke[] memory)
```

#### Utility Functions

```solidity
// Check if account has any of the specified permissions
function hasAnyPermission(address account, bytes32[] calldata permissions) 
    external view returns (bool)

// Check if account has all of the specified permissions
function hasAllPermissions(address account, bytes32[] calldata permissions) 
    external view returns (bool)
```

## Data Structures

### ContractRevocation
```solidity
struct ContractRevocation {
    bool isRevoked;           // Whether contract is revoked
    uint256 revokedAt;        // Timestamp of revocation
    address revokedBy;        // Address that revoked the contract
    string reason;            // Reason for revocation
    RevocationStatus status;  // Current revocation status
}
```

### PartialRevoke
```solidity
struct PartialRevoke {
    bytes32 permission;  // Permission that was revoked
    uint256 timestamp;   // When it was revoked
    address revokedBy;   // Who revoked it
    string reason;       // Why it was revoked
}
```

### RevocationStatus
```solidity
enum RevocationStatus {
    Active,           // Contract is active
    PartiallyRevoked, // Some permissions revoked
    FullyRevoked      // All permissions revoked
}
```

## Events

```solidity
event PermissionGranted(
    address indexed account,
    bytes32 indexed permission,
    address indexed grantor
);

event PermissionRevoked(
    address indexed account,
    bytes32 indexed permission,
    address indexed revoker,
    string reason
);

event ContractRevoked(
    address indexed contractAddress,
    address indexed revoker,
    uint256 timestamp,
    string reason
);

event ContractReinstated(
    address indexed contractAddress,
    address indexed reinstater,
    uint256 timestamp
);

event PartialRevokeRecorded(
    address indexed account,
    bytes32 indexed permission,
    address indexed revoker,
    string reason
);

event PermissionDescriptionSet(
    bytes32 indexed permission,
    string description
);
```

## Error Handling

The contract uses custom errors for gas efficiency:

```solidity
error InvalidAddress();
error InvalidPermission();
error PermissionNotGranted();
error PermissionAlreadyGranted();
error ContractNotRevoked();
error ContractAlreadyRevoked();
error PartialRevokeNotFound();
error CannotRevokeZeroPermissions();
error NoPermissionsToRevoke();
```

## Usage Examples

### Example 1: Grant and Revoke Permissions

```solidity
// Deploy contract
RevokeFunction revokeFunc = new RevokeFunction();

// Grant execute permission to user
revokeFunc.grantPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());

// Check permission
bool hasPermission = revokeFunc.hasPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());

// Revoke permission
revokeFunc.revokePermission(userAddress, revokeFunc.EXECUTE_PERMISSION(), "Security policy update");

// Check revocation history
RevokeFunction.PartialRevoke[] memory revokes = revokeFunc.getPartialRevokes(userAddress);
```

### Example 2: Partial Revoke

```solidity
// Grant multiple permissions
bytes32[] memory permissions = new bytes32[](3);
permissions[0] = revokeFunc.EXECUTE_PERMISSION();
permissions[1] = revokeFunc.TRANSFER_PERMISSION();
permissions[2] = revokeFunc.MINT_PERMISSION();

revokeFunc.grantPermissions(userAddress, permissions);

// Revoke only execute and transfer (partial revoke)
bytes32[] memory toRevoke = new bytes32[](2);
toRevoke[0] = revokeFunc.EXECUTE_PERMISSION();
toRevoke[1] = revokeFunc.TRANSFER_PERMISSION();

revokeFunc.revokePermissions(userAddress, toRevoke, "Downgrade user privileges");

// User still has mint permission
bool hasMint = revokeFunc.hasPermission(userAddress, revokeFunc.MINT_PERMISSION()); // true
```

### Example 3: Contract Revocation

```solidity
// Revoke a contract
revokeFunc.revokeContract(contractAddress, "Security vulnerability detected");

// Check revocation status
bool isRevoked = revokeFunc.isContractRevoked(contractAddress); // true

// Get revocation details
RevokeFunction.ContractRevocation memory revocation = revokeFunc.getContractRevocation(contractAddress);

// Update status to partially revoked
revokeFunc.updateRevocationStatus(contractAddress, RevokeFunction.RevocationStatus.PartiallyRevoked);

// Reinstate contract after fix
revokeFunc.reinstateContract(contractAddress);
```

### Example 4: Query Operations

```solidity
// Get all permissions for a user
bytes32[] memory userPermissions = revokeFunc.getAccountPermissions(userAddress);

// Get all users with execute permission
address[] memory executors = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());

// Get all revoked contracts
address[] memory revokedContracts = revokeFunc.getAllRevokedContracts();

// Check if user has any admin permissions
bytes32[] memory adminPerms = new bytes32[](2);
adminPerms[0] = revokeFunc.ADMIN_PERMISSION();
adminPerms[1] = revokeFunc.MINT_PERMISSION();

bool hasAnyAdmin = revokeFunc.hasAnyPermission(userAddress, adminPerms);
```

## Security Considerations

1. **Access Control**: All administrative functions are protected by the `onlyOwner` modifier
2. **Input Validation**: All inputs are validated to prevent invalid states
3. **Reentrancy**: No external calls are made, eliminating reentrancy risks
4. **Gas Optimization**: Uses EnumerableSet for efficient operations
5. **Audit Trail**: Complete history of all revocations with reasons and timestamps

## Testing

The contract includes comprehensive tests covering:

- ✅ Permission grant operations
- ✅ Permission revoke operations (single, multiple, all)
- ✅ Contract revocation and reinstatement
- ✅ Partial revoke tracking
- ✅ Query functions
- ✅ Utility functions
- ✅ Access control
- ✅ Error conditions
- ✅ Edge cases
- ✅ Integration workflows

Run tests with:
```bash
forge test --match-contract RevokeFunctionTest -vv
```

## Gas Optimization

The contract is optimized for gas efficiency:

- Uses `EnumerableSet` for O(1) lookups
- Custom errors instead of require strings
- Efficient storage patterns
- Batch operations for multiple permissions

## Integration Guide

### Step 1: Deploy Contract
```solidity
RevokeFunction revokeFunc = new RevokeFunction();
```

### Step 2: Grant Initial Permissions
```solidity
bytes32[] memory permissions = new bytes32[](2);
permissions[0] = revokeFunc.EXECUTE_PERMISSION();
permissions[1] = revokeFunc.TRANSFER_PERMISSION();

revokeFunc.grantPermissions(adminAddress, permissions);
```

### Step 3: Implement Permission Checks
```solidity
modifier onlyExecutor() {
    require(revokeFunc.hasPermission(msg.sender, revokeFunc.EXECUTE_PERMISSION()), "Not authorized");
    _;
}
```

### Step 4: Monitor and Revoke as Needed
```solidity
// Monitor permissions
address[] memory executors = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());

// Revoke if needed
revokeFunc.revokePermission(suspiciousAddress, revokeFunc.EXECUTE_PERMISSION(), "Suspicious activity");
```

## License

MIT License

## Version

1.0.0

## Dependencies

- OpenZeppelin Contracts v5.0.0+
- Solidity ^0.8.20
- Foundry for testing
