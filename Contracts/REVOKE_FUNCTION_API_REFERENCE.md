# RevokeFunction API Reference

## Table of Contents
- [Permission Management](#permission-management)
- [Contract Revocation](#contract-revocation)
- [Query Functions](#query-functions)
- [Utility Functions](#utility-functions)
- [Events](#events)
- [Errors](#errors)
- [Data Structures](#data-structures)

---

## Permission Management

### grantPermission

```solidity
function grantPermission(address account, bytes32 permission) external onlyOwner
```

Grants a single permission to an account.

**Parameters:**
- `account` (address): The account to grant permission to
- `permission` (bytes32): The permission identifier

**Requirements:**
- Caller must be owner
- Account cannot be zero address
- Permission cannot be zero
- Permission must not already be granted

**Emits:** `PermissionGranted(account, permission, msg.sender)`

**Example:**
```solidity
revokeFunc.grantPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());
```

---

### grantPermissions

```solidity
function grantPermissions(address account, bytes32[] calldata permissions) external onlyOwner
```

Grants multiple permissions to an account in a single transaction.

**Parameters:**
- `account` (address): The account to grant permissions to
- `permissions` (bytes32[]): Array of permission identifiers

**Requirements:**
- Caller must be owner
- Account cannot be zero address
- Permissions cannot be zero

**Emits:** `PermissionGranted` for each permission

**Example:**
```solidity
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.EXECUTE_PERMISSION();
perms[1] = revokeFunc.TRANSFER_PERMISSION();
revokeFunc.grantPermissions(userAddress, perms);
```

---

### revokePermission

```solidity
function revokePermission(
    address account,
    bytes32 permission,
    string calldata reason
) external onlyOwner
```

Revokes a single permission from an account and records the revocation.

**Parameters:**
- `account` (address): The account to revoke permission from
- `permission` (bytes32): The permission identifier
- `reason` (string): Reason for revocation (for audit trail)

**Requirements:**
- Caller must be owner
- Permission must be currently granted

**Emits:** 
- `PermissionRevoked(account, permission, msg.sender, reason)`
- `PartialRevokeRecorded(account, permission, msg.sender, reason)`

**Example:**
```solidity
revokeFunc.revokePermission(
    userAddress,
    revokeFunc.EXECUTE_PERMISSION(),
    "Security policy update"
);
```

---

### revokePermissions

```solidity
function revokePermissions(
    address account,
    bytes32[] calldata permissions,
    string calldata reason
) external onlyOwner
```

Revokes multiple permissions from an account (partial revoke).

**Parameters:**
- `account` (address): The account to revoke permissions from
- `permissions` (bytes32[]): Array of permission identifiers
- `reason` (string): Reason for revocation

**Requirements:**
- Caller must be owner
- Permissions array cannot be empty

**Emits:** `PermissionRevoked` and `PartialRevokeRecorded` for each permission

**Example:**
```solidity
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.EXECUTE_PERMISSION();
perms[1] = revokeFunc.TRANSFER_PERMISSION();
revokeFunc.revokePermissions(userAddress, perms, "Privilege downgrade");
```

---

### revokeAllPermissions

```solidity
function revokeAllPermissions(
    address account,
    string calldata reason
) external onlyOwner
```

Revokes all permissions from an account.

**Parameters:**
- `account` (address): The account to revoke all permissions from
- `reason` (string): Reason for revocation

**Requirements:**
- Caller must be owner
- Account must have at least one permission

**Emits:** `PermissionRevoked` for each permission

**Example:**
```solidity
revokeFunc.revokeAllPermissions(userAddress, "Account suspended");
```

---

## Contract Revocation

### revokeContract

```solidity
function revokeContract(
    address contractAddress,
    string calldata reason
) external onlyOwner
```

Fully revokes a contract with reason tracking.

**Parameters:**
- `contractAddress` (address): The contract address to revoke
- `reason` (string): Reason for revocation

**Requirements:**
- Caller must be owner
- Contract address cannot be zero
- Contract must not already be revoked

**Emits:** `ContractRevoked(contractAddress, msg.sender, block.timestamp, reason)`

**Example:**
```solidity
revokeFunc.revokeContract(contractAddress, "Critical security vulnerability");
```

---

### reinstateContract

```solidity
function reinstateContract(address contractAddress) external onlyOwner
```

Reinstates a previously revoked contract.

**Parameters:**
- `contractAddress` (address): The contract address to reinstate

**Requirements:**
- Caller must be owner
- Contract must be currently revoked

**Emits:** `ContractReinstated(contractAddress, msg.sender, block.timestamp)`

**Example:**
```solidity
revokeFunc.reinstateContract(contractAddress);
```

---

### updateRevocationStatus

```solidity
function updateRevocationStatus(
    address contractAddress,
    RevocationStatus status
) external onlyOwner
```

Updates the revocation status of a contract.

**Parameters:**
- `contractAddress` (address): The contract address
- `status` (RevocationStatus): New revocation status

**Requirements:**
- Caller must be owner
- Contract must be currently revoked

**Example:**
```solidity
revokeFunc.updateRevocationStatus(
    contractAddress,
    RevokeFunction.RevocationStatus.PartiallyRevoked
);
```

---

## Query Functions

### Permission Queries

#### hasPermission

```solidity
function hasPermission(address account, bytes32 permission) external view returns (bool)
```

Checks if an account has a specific permission.

**Returns:** `true` if account has permission, `false` otherwise

**Example:**
```solidity
bool canExecute = revokeFunc.hasPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());
```

---

#### getAccountPermissions

```solidity
function getAccountPermissions(address account) external view returns (bytes32[] memory)
```

Gets all permissions for an account.

**Returns:** Array of permission identifiers

**Example:**
```solidity
bytes32[] memory permissions = revokeFunc.getAccountPermissions(userAddress);
```

---

#### getAccountPermissionCount

```solidity
function getAccountPermissionCount(address account) external view returns (uint256)
```

Gets the number of permissions an account has.

**Returns:** Number of permissions

**Example:**
```solidity
uint256 count = revokeFunc.getAccountPermissionCount(userAddress);
```

---

#### getPermissionHolders

```solidity
function getPermissionHolders(bytes32 permission) external view returns (address[] memory)
```

Gets all accounts that have a specific permission.

**Returns:** Array of account addresses

**Example:**
```solidity
address[] memory executors = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());
```

---

#### getPermissionHolderCount

```solidity
function getPermissionHolderCount(bytes32 permission) external view returns (uint256)
```

Gets the number of accounts that have a specific permission.

**Returns:** Number of holders

**Example:**
```solidity
uint256 count = revokeFunc.getPermissionHolderCount(revokeFunc.EXECUTE_PERMISSION());
```

---

#### getAllAccountsWithPermissions

```solidity
function getAllAccountsWithPermissions() external view returns (address[] memory)
```

Gets all accounts that have any permissions.

**Returns:** Array of account addresses

**Example:**
```solidity
address[] memory accounts = revokeFunc.getAllAccountsWithPermissions();
```

---

#### getPermissionDescription

```solidity
function getPermissionDescription(bytes32 permission) external view returns (string memory)
```

Gets the description for a permission.

**Returns:** Permission description string

**Example:**
```solidity
string memory desc = revokeFunc.getPermissionDescription(revokeFunc.EXECUTE_PERMISSION());
```

---

#### setPermissionDescription

```solidity
function setPermissionDescription(
    bytes32 permission,
    string calldata description
) external onlyOwner
```

Sets the description for a permission.

**Parameters:**
- `permission` (bytes32): The permission identifier
- `description` (string): The description text

**Emits:** `PermissionDescriptionSet(permission, description)`

**Example:**
```solidity
revokeFunc.setPermissionDescription(
    revokeFunc.EXECUTE_PERMISSION(),
    "Custom execute permission description"
);
```

---

### Revocation Queries

#### isContractRevoked

```solidity
function isContractRevoked(address contractAddress) external view returns (bool)
```

Checks if a contract is revoked.

**Returns:** `true` if contract is revoked, `false` otherwise

**Example:**
```solidity
bool isRevoked = revokeFunc.isContractRevoked(contractAddress);
```

---

#### getContractRevocation

```solidity
function getContractRevocation(address contractAddress) 
    external view returns (ContractRevocation memory)
```

Gets complete revocation details for a contract.

**Returns:** ContractRevocation struct with all details

**Example:**
```solidity
RevokeFunction.ContractRevocation memory details = 
    revokeFunc.getContractRevocation(contractAddress);
```

---

#### getRevocationStatus

```solidity
function getRevocationStatus(address contractAddress) 
    external view returns (RevocationStatus)
```

Gets the revocation status for a contract.

**Returns:** RevocationStatus enum value

**Example:**
```solidity
RevokeFunction.RevocationStatus status = 
    revokeFunc.getRevocationStatus(contractAddress);
```

---

#### getAllRevokedContracts

```solidity
function getAllRevokedContracts() external view returns (address[] memory)
```

Gets all revoked contracts.

**Returns:** Array of revoked contract addresses

**Example:**
```solidity
address[] memory revokedContracts = revokeFunc.getAllRevokedContracts();
```

---

#### getRevokedContractCount

```solidity
function getRevokedContractCount() external view returns (uint256)
```

Gets the number of revoked contracts.

**Returns:** Number of revoked contracts

**Example:**
```solidity
uint256 count = revokeFunc.getRevokedContractCount();
```

---

### Partial Revoke Queries

#### getPartialRevokes

```solidity
function getPartialRevokes(address account) external view returns (PartialRevoke[] memory)
```

Gets all partial revokes for an account.

**Returns:** Array of PartialRevoke structs

**Example:**
```solidity
RevokeFunction.PartialRevoke[] memory revokes = 
    revokeFunc.getPartialRevokes(userAddress);
```

---

#### getPartialRevokeCount

```solidity
function getPartialRevokeCount(address account) external view returns (uint256)
```

Gets the number of partial revokes for an account.

**Returns:** Number of partial revokes

**Example:**
```solidity
uint256 count = revokeFunc.getPartialRevokeCount(userAddress);
```

---

#### getPartialRevokeByIndex

```solidity
function getPartialRevokeByIndex(address account, uint256 index) 
    external view returns (PartialRevoke memory)
```

Gets a specific partial revoke by index.

**Parameters:**
- `account` (address): The account to query
- `index` (uint256): The index of the partial revoke

**Returns:** PartialRevoke struct

**Example:**
```solidity
RevokeFunction.PartialRevoke memory revoke = 
    revokeFunc.getPartialRevokeByIndex(userAddress, 0);
```

---

#### getRecentPartialRevokes

```solidity
function getRecentPartialRevokes(address account, uint256 count) 
    external view returns (PartialRevoke[] memory)
```

Gets recent partial revokes for an account.

**Parameters:**
- `account` (address): The account to query
- `count` (uint256): Number of recent revokes to return

**Returns:** Array of recent PartialRevoke structs

**Example:**
```solidity
RevokeFunction.PartialRevoke[] memory recent = 
    revokeFunc.getRecentPartialRevokes(userAddress, 5);
```

---

## Utility Functions

### hasAnyPermission

```solidity
function hasAnyPermission(address account, bytes32[] calldata permissions) 
    external view returns (bool)
```

Checks if account has any of the specified permissions.

**Returns:** `true` if account has at least one permission, `false` otherwise

**Example:**
```solidity
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.ADMIN_PERMISSION();
perms[1] = revokeFunc.EXECUTE_PERMISSION();
bool hasAny = revokeFunc.hasAnyPermission(userAddress, perms);
```

---

### hasAllPermissions

```solidity
function hasAllPermissions(address account, bytes32[] calldata permissions) 
    external view returns (bool)
```

Checks if account has all of the specified permissions.

**Returns:** `true` if account has all permissions, `false` otherwise

**Example:**
```solidity
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.ADMIN_PERMISSION();
perms[1] = revokeFunc.EXECUTE_PERMISSION();
bool hasAll = revokeFunc.hasAllPermissions(userAddress, perms);
```

---

## Events

### PermissionGranted

```solidity
event PermissionGranted(
    address indexed account,
    bytes32 indexed permission,
    address indexed grantor
)
```

Emitted when a permission is granted to an account.

---

### PermissionRevoked

```solidity
event PermissionRevoked(
    address indexed account,
    bytes32 indexed permission,
    address indexed revoker,
    string reason
)
```

Emitted when a permission is revoked from an account.

---

### ContractRevoked

```solidity
event ContractRevoked(
    address indexed contractAddress,
    address indexed revoker,
    uint256 timestamp,
    string reason
)
```

Emitted when a contract is revoked.

---

### ContractReinstated

```solidity
event ContractReinstated(
    address indexed contractAddress,
    address indexed reinstater,
    uint256 timestamp
)
```

Emitted when a contract is reinstated.

---

### PartialRevokeRecorded

```solidity
event PartialRevokeRecorded(
    address indexed account,
    bytes32 indexed permission,
    address indexed revoker,
    string reason
)
```

Emitted when a partial revoke is recorded.

---

### PermissionDescriptionSet

```solidity
event PermissionDescriptionSet(
    bytes32 indexed permission,
    string description
)
```

Emitted when a permission description is set.

---

## Errors

### InvalidAddress
```solidity
error InvalidAddress()
```
Thrown when an invalid address (zero address) is provided.

---

### InvalidPermission
```solidity
error InvalidPermission()
```
Thrown when an invalid permission (zero bytes32) is provided.

---

### PermissionNotGranted
```solidity
error PermissionNotGranted()
```
Thrown when trying to revoke a permission that wasn't granted.

---

### PermissionAlreadyGranted
```solidity
error PermissionAlreadyGranted()
```
Thrown when trying to grant a permission that's already granted.

---

### ContractNotRevoked
```solidity
error ContractNotRevoked()
```
Thrown when trying to operate on a non-revoked contract that should be revoked.

---

### ContractAlreadyRevoked
```solidity
error ContractAlreadyRevoked()
```
Thrown when trying to revoke an already revoked contract.

---

### PartialRevokeNotFound
```solidity
error PartialRevokeNotFound()
```
Thrown when trying to access a non-existent partial revoke.

---

### CannotRevokeZeroPermissions
```solidity
error CannotRevokeZeroPermissions()
```
Thrown when trying to revoke an empty array of permissions.

---

### NoPermissionsToRevoke
```solidity
error NoPermissionsToRevoke()
```
Thrown when trying to revoke all permissions from an account with no permissions.

---

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

---

### PartialRevoke

```solidity
struct PartialRevoke {
    bytes32 permission;  // Permission that was revoked
    uint256 timestamp;   // When it was revoked
    address revokedBy;   // Who revoked it
    string reason;       // Why it was revoked
}
```

---

### RevocationStatus

```solidity
enum RevocationStatus {
    Active,           // Contract is active (0)
    PartiallyRevoked, // Some permissions revoked (1)
    FullyRevoked      // All permissions revoked (2)
}
```

---

## Constants

### Permission Identifiers

```solidity
bytes32 public constant EXECUTE_PERMISSION = keccak256("EXECUTE_PERMISSION");
bytes32 public constant TRANSFER_PERMISSION = keccak256("TRANSFER_PERMISSION");
bytes32 public constant MINT_PERMISSION = keccak256("MINT_PERMISSION");
bytes32 public constant BURN_PERMISSION = keccak256("BURN_PERMISSION");
bytes32 public constant ADMIN_PERMISSION = keccak256("ADMIN_PERMISSION");
```

---

## Version

**Contract Version:** 1.0.0  
**Solidity Version:** ^0.8.20  
**License:** MIT
