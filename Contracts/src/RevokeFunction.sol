// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title RevokeFunction
/// @notice Comprehensive revoke functionality for contracts with permission management,
///         contract revocation tracking, partial revokes, and query capabilities.
/// @dev Uses OpenZeppelin's Ownable and EnumerableSet for robust permission management.
contract RevokeFunction is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidAddress();
    error InvalidPermission();
    error PermissionNotGranted();
    error PermissionAlreadyGranted();
    error ContractNotRevoked();
    error ContractAlreadyRevoked();
    error PartialRevokeNotFound();
    error CannotRevokeZeroPermissions();
    error NoPermissionsToRevoke();

    // -------------------------------------------------------------------------
    // Types & Constants
    // -------------------------------------------------------------------------
    
    /// @notice Permission identifiers
    bytes32 public constant EXECUTE_PERMISSION = keccak256("EXECUTE_PERMISSION");
    bytes32 public constant TRANSFER_PERMISSION = keccak256("TRANSFER_PERMISSION");
    bytes32 public constant MINT_PERMISSION = keccak256("MINT_PERMISSION");
    bytes32 public constant BURN_PERMISSION = keccak256("BURN_PERMISSION");
    bytes32 public constant ADMIN_PERMISSION = keccak256("ADMIN_PERMISSION");

    /// @notice Revocation status enum
    enum RevocationStatus {
        Active,           // Contract is active
        PartiallyRevoked, // Some permissions revoked
        FullyRevoked      // All permissions revoked
    }

    /// @notice Struct to track partial revoke details
    struct PartialRevoke {
        bytes32 permission;
        uint256 timestamp;
        address revokedBy;
        string reason;
    }

    /// @notice Struct to track contract revocation
    struct ContractRevocation {
        bool isRevoked;
        uint256 revokedAt;
        address revokedBy;
        string reason;
        RevocationStatus status;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    
    /// @dev account => permission => hasPermission
    mapping(address => mapping(bytes32 => bool)) private _permissions;

    /// @dev account => set of permissions
    mapping(address => EnumerableSet.Bytes32Set) private _accountPermissions;

    /// @dev permission => set of accounts with permission
    mapping(bytes32 => EnumerableSet.AddressSet) private _permissionHolders;

    /// @dev contract address => revocation details
    mapping(address => ContractRevocation) private _contractRevocations;

    /// @dev account => array of partial revokes
    mapping(address => PartialRevoke[]) private _partialRevokes;

    /// @dev Set of all revoked contracts
    EnumerableSet.AddressSet private _revokedContracts;

    /// @dev Set of all accounts with any permissions
    EnumerableSet.AddressSet private _accountsWithPermissions;

    /// @dev Permission descriptions
    mapping(bytes32 => string) private _permissionDescriptions;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    
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

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    
    constructor() Ownable(msg.sender) {
        // Set default permission descriptions
        _permissionDescriptions[EXECUTE_PERMISSION] = "Permission to execute functions";
        _permissionDescriptions[TRANSFER_PERMISSION] = "Permission to transfer assets";
        _permissionDescriptions[MINT_PERMISSION] = "Permission to mint tokens";
        _permissionDescriptions[BURN_PERMISSION] = "Permission to burn tokens";
        _permissionDescriptions[ADMIN_PERMISSION] = "Administrative permission";
    }

    // -------------------------------------------------------------------------
    // Permission Management Functions
    // -------------------------------------------------------------------------

    /// @notice Grant a permission to an account
    /// @param account The account to grant permission to
    /// @param permission The permission identifier
    function grantPermission(address account, bytes32 permission) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (permission == bytes32(0)) revert InvalidPermission();
        if (_permissions[account][permission]) revert PermissionAlreadyGranted();

        _permissions[account][permission] = true;
        _accountPermissions[account].add(permission);
        _permissionHolders[permission].add(account);
        _accountsWithPermissions.add(account);

        emit PermissionGranted(account, permission, msg.sender);
    }

    /// @notice Grant multiple permissions to an account
    /// @param account The account to grant permissions to
    /// @param permissions Array of permission identifiers
    function grantPermissions(address account, bytes32[] calldata permissions) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        
        for (uint256 i = 0; i < permissions.length; i++) {
            bytes32 permission = permissions[i];
            if (permission == bytes32(0)) revert InvalidPermission();
            if (_permissions[account][permission]) continue; // Skip already granted

            _permissions[account][permission] = true;
            _accountPermissions[account].add(permission);
            _permissionHolders[permission].add(account);
            _accountsWithPermissions.add(account);

            emit PermissionGranted(account, permission, msg.sender);
        }
    }

    /// @notice Revoke a permission from an account
    /// @param account The account to revoke permission from
    /// @param permission The permission identifier
    /// @param reason Reason for revocation
    function revokePermission(
        address account,
        bytes32 permission,
        string calldata reason
    ) external onlyOwner {
        if (!_permissions[account][permission]) revert PermissionNotGranted();

        _permissions[account][permission] = false;
        _accountPermissions[account].remove(permission);
        _permissionHolders[permission].remove(account);

        // Record partial revoke
        _partialRevokes[account].push(PartialRevoke({
            permission: permission,
            timestamp: block.timestamp,
            revokedBy: msg.sender,
            reason: reason
        }));

        // Update account status
        if (_accountPermissions[account].length() == 0) {
            _accountsWithPermissions.remove(account);
        }

        emit PermissionRevoked(account, permission, msg.sender, reason);
        emit PartialRevokeRecorded(account, permission, msg.sender, reason);
    }

    /// @notice Revoke multiple permissions from an account (partial revoke)
    /// @param account The account to revoke permissions from
    /// @param permissions Array of permission identifiers
    /// @param reason Reason for revocation
    function revokePermissions(
        address account,
        bytes32[] calldata permissions,
        string calldata reason
    ) external onlyOwner {
        if (permissions.length == 0) revert CannotRevokeZeroPermissions();

        for (uint256 i = 0; i < permissions.length; i++) {
            bytes32 permission = permissions[i];
            if (!_permissions[account][permission]) continue; // Skip not granted

            _permissions[account][permission] = false;
            _accountPermissions[account].remove(permission);
            _permissionHolders[permission].remove(account);

            // Record partial revoke
            _partialRevokes[account].push(PartialRevoke({
                permission: permission,
                timestamp: block.timestamp,
                revokedBy: msg.sender,
                reason: reason
            }));

            emit PermissionRevoked(account, permission, msg.sender, reason);
            emit PartialRevokeRecorded(account, permission, msg.sender, reason);
        }

        // Update account status
        if (_accountPermissions[account].length() == 0) {
            _accountsWithPermissions.remove(account);
        }
    }

    /// @notice Revoke all permissions from an account
    /// @param account The account to revoke all permissions from
    /// @param reason Reason for revocation
    function revokeAllPermissions(
        address account,
        string calldata reason
    ) external onlyOwner {
        if (_accountPermissions[account].length() == 0) revert NoPermissionsToRevoke();

        bytes32[] memory permissions = _accountPermissions[account].values();
        
        for (uint256 i = 0; i < permissions.length; i++) {
            bytes32 permission = permissions[i];
            _permissions[account][permission] = false;
            _permissionHolders[permission].remove(account);

            // Record partial revoke
            _partialRevokes[account].push(PartialRevoke({
                permission: permission,
                timestamp: block.timestamp,
                revokedBy: msg.sender,
                reason: reason
            }));

            emit PermissionRevoked(account, permission, msg.sender, reason);
        }

        // Clear all permissions for account
        while (_accountPermissions[account].length() > 0) {
            _accountPermissions[account].remove(_accountPermissions[account].at(0));
        }

        _accountsWithPermissions.remove(account);
    }

    // -------------------------------------------------------------------------
    // Contract Revocation Functions
    // -------------------------------------------------------------------------

    /// @notice Revoke a contract completely
    /// @param contractAddress The contract address to revoke
    /// @param reason Reason for revocation
    function revokeContract(
        address contractAddress,
        string calldata reason
    ) external onlyOwner {
        if (contractAddress == address(0)) revert InvalidAddress();
        if (_contractRevocations[contractAddress].isRevoked) revert ContractAlreadyRevoked();

        _contractRevocations[contractAddress] = ContractRevocation({
            isRevoked: true,
            revokedAt: block.timestamp,
            revokedBy: msg.sender,
            reason: reason,
            status: RevocationStatus.FullyRevoked
        });

        _revokedContracts.add(contractAddress);

        emit ContractRevoked(contractAddress, msg.sender, block.timestamp, reason);
    }

    /// @notice Reinstate a revoked contract
    /// @param contractAddress The contract address to reinstate
    function reinstateContract(address contractAddress) external onlyOwner {
        if (!_contractRevocations[contractAddress].isRevoked) revert ContractNotRevoked();

        delete _contractRevocations[contractAddress];
        _revokedContracts.remove(contractAddress);

        emit ContractReinstated(contractAddress, msg.sender, block.timestamp);
    }

    /// @notice Update contract revocation status
    /// @param contractAddress The contract address
    /// @param status New revocation status
    function updateRevocationStatus(
        address contractAddress,
        RevocationStatus status
    ) external onlyOwner {
        if (!_contractRevocations[contractAddress].isRevoked) revert ContractNotRevoked();
        
        _contractRevocations[contractAddress].status = status;
    }

    // -------------------------------------------------------------------------
    // Query Functions - Permissions
    // -------------------------------------------------------------------------

    /// @notice Check if an account has a specific permission
    /// @param account The account to check
    /// @param permission The permission identifier
    /// @return bool True if account has permission
    function hasPermission(address account, bytes32 permission) external view returns (bool) {
        return _permissions[account][permission];
    }

    /// @notice Get all permissions for an account
    /// @param account The account to query
    /// @return bytes32[] Array of permission identifiers
    function getAccountPermissions(address account) external view returns (bytes32[] memory) {
        return _accountPermissions[account].values();
    }

    /// @notice Get permission count for an account
    /// @param account The account to query
    /// @return uint256 Number of permissions
    function getAccountPermissionCount(address account) external view returns (uint256) {
        return _accountPermissions[account].length();
    }

    /// @notice Get all accounts with a specific permission
    /// @param permission The permission identifier
    /// @return address[] Array of account addresses
    function getPermissionHolders(bytes32 permission) external view returns (address[] memory) {
        return _permissionHolders[permission].values();
    }

    /// @notice Get holder count for a permission
    /// @param permission The permission identifier
    /// @return uint256 Number of holders
    function getPermissionHolderCount(bytes32 permission) external view returns (uint256) {
        return _permissionHolders[permission].length();
    }

    /// @notice Get all accounts with any permissions
    /// @return address[] Array of account addresses
    function getAllAccountsWithPermissions() external view returns (address[] memory) {
        return _accountsWithPermissions.values();
    }

    /// @notice Get permission description
    /// @param permission The permission identifier
    /// @return string Permission description
    function getPermissionDescription(bytes32 permission) external view returns (string memory) {
        return _permissionDescriptions[permission];
    }

    /// @notice Set permission description
    /// @param permission The permission identifier
    /// @param description The description text
    function setPermissionDescription(
        bytes32 permission,
        string calldata description
    ) external onlyOwner {
        _permissionDescriptions[permission] = description;
        emit PermissionDescriptionSet(permission, description);
    }

    // -------------------------------------------------------------------------
    // Query Functions - Revocations
    // -------------------------------------------------------------------------

    /// @notice Check if a contract is revoked
    /// @param contractAddress The contract address to check
    /// @return bool True if contract is revoked
    function isContractRevoked(address contractAddress) external view returns (bool) {
        return _contractRevocations[contractAddress].isRevoked;
    }

    /// @notice Get contract revocation details
    /// @param contractAddress The contract address to query
    /// @return ContractRevocation Revocation details
    function getContractRevocation(address contractAddress) 
        external 
        view 
        returns (ContractRevocation memory) 
    {
        return _contractRevocations[contractAddress];
    }

    /// @notice Get revocation status for a contract
    /// @param contractAddress The contract address to query
    /// @return RevocationStatus Current status
    function getRevocationStatus(address contractAddress) 
        external 
        view 
        returns (RevocationStatus) 
    {
        return _contractRevocations[contractAddress].status;
    }

    /// @notice Get all revoked contracts
    /// @return address[] Array of revoked contract addresses
    function getAllRevokedContracts() external view returns (address[] memory) {
        return _revokedContracts.values();
    }

    /// @notice Get count of revoked contracts
    /// @return uint256 Number of revoked contracts
    function getRevokedContractCount() external view returns (uint256) {
        return _revokedContracts.length();
    }

    // -------------------------------------------------------------------------
    // Query Functions - Partial Revokes
    // -------------------------------------------------------------------------

    /// @notice Get all partial revokes for an account
    /// @param account The account to query
    /// @return PartialRevoke[] Array of partial revoke records
    function getPartialRevokes(address account) external view returns (PartialRevoke[] memory) {
        return _partialRevokes[account];
    }

    /// @notice Get partial revoke count for an account
    /// @param account The account to query
    /// @return uint256 Number of partial revokes
    function getPartialRevokeCount(address account) external view returns (uint256) {
        return _partialRevokes[account].length;
    }

    /// @notice Get a specific partial revoke by index
    /// @param account The account to query
    /// @param index The index of the partial revoke
    /// @return PartialRevoke The partial revoke record
    function getPartialRevokeByIndex(address account, uint256 index) 
        external 
        view 
        returns (PartialRevoke memory) 
    {
        if (index >= _partialRevokes[account].length) revert PartialRevokeNotFound();
        return _partialRevokes[account][index];
    }

    /// @notice Get recent partial revokes for an account
    /// @param account The account to query
    /// @param count Number of recent revokes to return
    /// @return PartialRevoke[] Array of recent partial revoke records
    function getRecentPartialRevokes(address account, uint256 count) 
        external 
        view 
        returns (PartialRevoke[] memory) 
    {
        uint256 totalRevokes = _partialRevokes[account].length;
        uint256 returnCount = count > totalRevokes ? totalRevokes : count;
        
        PartialRevoke[] memory recentRevokes = new PartialRevoke[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            recentRevokes[i] = _partialRevokes[account][totalRevokes - returnCount + i];
        }
        
        return recentRevokes;
    }

    // -------------------------------------------------------------------------
    // Utility Functions
    // -------------------------------------------------------------------------

    /// @notice Check if account has any of the specified permissions
    /// @param account The account to check
    /// @param permissions Array of permission identifiers
    /// @return bool True if account has any of the permissions
    function hasAnyPermission(address account, bytes32[] calldata permissions) 
        external 
        view 
        returns (bool) 
    {
        for (uint256 i = 0; i < permissions.length; i++) {
            if (_permissions[account][permissions[i]]) return true;
        }
        return false;
    }

    /// @notice Check if account has all of the specified permissions
    /// @param account The account to check
    /// @param permissions Array of permission identifiers
    /// @return bool True if account has all of the permissions
    function hasAllPermissions(address account, bytes32[] calldata permissions) 
        external 
        view 
        returns (bool) 
    {
        for (uint256 i = 0; i < permissions.length; i++) {
            if (!_permissions[account][permissions[i]]) return false;
        }
        return true;
    }
}
