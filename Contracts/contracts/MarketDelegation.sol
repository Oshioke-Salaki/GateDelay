// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MarketDelegation
/// @notice Comprehensive delegation system for prediction markets with permission management.
/// @dev Handles delegation requests, tracks status, manages permissions, and supports revocation.
contract MarketDelegation is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error SelfDelegation();
    error DelegationLoop();
    error InvalidMarketId();
    error DelegationNotFound();
    error DelegationAlreadyExists();
    error DelegationNotActive();
    error UnauthorizedDelegator();
    error InvalidPermission();
    error PermissionAlreadyGranted();
    error PermissionNotGranted();
    error MaxDelegationsExceeded();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Status of a delegation request
    enum DelegationStatus {
        PENDING,    // Delegation requested but not yet active
        ACTIVE,     // Delegation is currently active
        REVOKED,    // Delegation was revoked by delegator
        EXPIRED     // Delegation expired (if time-limited)
    }

    /// @notice Types of permissions that can be delegated
    enum Permission {
        TRADE,          // Permission to execute trades
        CREATE_MARKET,  // Permission to create markets
        RESOLVE_MARKET, // Permission to resolve markets
        MANAGE_LIQUIDITY, // Permission to add/remove liquidity
        ADMIN           // Full administrative permissions
    }

    /// @notice Represents a delegation record
    struct Delegation {
        address delegator;      // Address delegating permissions
        address delegatee;      // Address receiving permissions
        uint256 marketId;       // Market ID (0 for global delegation)
        DelegationStatus status; // Current status
        uint256 createdAt;      // Timestamp of creation
        uint256 revokedAt;      // Timestamp of revocation (0 if not revoked)
        uint256 expiresAt;      // Expiration timestamp (0 for no expiration)
    }

    /// @notice Permission grant record
    struct PermissionGrant {
        Permission permission;
        bool granted;
        uint256 grantedAt;
    }

    /// @notice Delegation statistics
    struct DelegationStats {
        uint256 totalDelegations;
        uint256 activeDelegations;
        uint256 revokedDelegations;
        uint256 expiredDelegations;
    }

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant MAX_DELEGATIONS_PER_DELEGATOR = 100;
    uint256 public constant MAX_DELEGATION_DURATION = 365 days;

    // ── Events ─────────────────────────────────────────────────────────────────
    event DelegationRequested(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 marketId,
        uint256 timestamp
    );

    event DelegationActivated(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );

    event DelegationRevoked(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );

    event DelegationExpired(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );

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

    event DelegationStatusChanged(
        bytes32 indexed delegationId,
        DelegationStatus oldStatus,
        DelegationStatus newStatus
    );

    // ── Storage ────────────────────────────────────────────────────────────────

    /// @dev delegationId => Delegation
    mapping(bytes32 => Delegation) private _delegations;

    /// @dev delegator => list of delegation IDs
    mapping(address => bytes32[]) private _delegatorDelegations;

    /// @dev delegatee => list of delegation IDs
    mapping(address => bytes32[]) private _delegateeDelegations;

    /// @dev marketId => list of delegation IDs
    mapping(uint256 => bytes32[]) private _marketDelegations;

    /// @dev delegationId => Permission => PermissionGrant
    mapping(bytes32 => mapping(Permission => PermissionGrant)) private _permissions;

    /// @dev delegationId => list of granted permissions
    mapping(bytes32 => Permission[]) private _grantedPermissions;

    /// @dev Track total delegations
    uint256 private _totalDelegations;
    uint256 private _activeDelegations;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Delegation Management ──────────────────────────────────────────────────

    /// @notice Request a new delegation
    /// @param delegatee Address to delegate to
    /// @param marketId Market ID (0 for global delegation)
    /// @param duration Duration in seconds (0 for no expiration)
    /// @return delegationId Unique identifier for the delegation
    function requestDelegation(
        address delegatee,
        uint256 marketId,
        uint256 duration
    ) external nonReentrant returns (bytes32 delegationId) {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert SelfDelegation();
        if (duration > MAX_DELEGATION_DURATION) revert InvalidPermission();

        // Check max delegations limit
        if (_delegatorDelegations[msg.sender].length >= MAX_DELEGATIONS_PER_DELEGATOR) {
            revert MaxDelegationsExceeded();
        }

        // Generate unique delegation ID
        delegationId = keccak256(
            abi.encodePacked(msg.sender, delegatee, marketId, block.timestamp, _totalDelegations)
        );

        // Check for existing delegation
        if (_delegations[delegationId].delegator != address(0)) {
            revert DelegationAlreadyExists();
        }

        uint256 expiresAt = duration > 0 ? block.timestamp + duration : 0;

        // Create delegation
        _delegations[delegationId] = Delegation({
            delegator: msg.sender,
            delegatee: delegatee,
            marketId: marketId,
            status: DelegationStatus.PENDING,
            createdAt: block.timestamp,
            revokedAt: 0,
            expiresAt: expiresAt
        });

        // Update mappings
        _delegatorDelegations[msg.sender].push(delegationId);
        _delegateeDelegations[delegatee].push(delegationId);
        if (marketId > 0) {
            _marketDelegations[marketId].push(delegationId);
        }

        _totalDelegations++;

        emit DelegationRequested(delegationId, msg.sender, delegatee, marketId, block.timestamp);

        return delegationId;
    }

    /// @notice Activate a pending delegation
    /// @param delegationId ID of the delegation to activate
    function activateDelegation(bytes32 delegationId) external nonReentrant {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.delegator != msg.sender) revert UnauthorizedDelegator();
        if (delegation.status != DelegationStatus.PENDING) revert DelegationNotActive();

        // Check if expired
        if (delegation.expiresAt > 0 && block.timestamp >= delegation.expiresAt) {
            delegation.status = DelegationStatus.EXPIRED;
            emit DelegationExpired(delegationId, delegation.delegator, delegation.delegatee, block.timestamp);
            revert DelegationNotActive();
        }

        DelegationStatus oldStatus = delegation.status;
        delegation.status = DelegationStatus.ACTIVE;
        _activeDelegations++;

        emit DelegationStatusChanged(delegationId, oldStatus, DelegationStatus.ACTIVE);
        emit DelegationActivated(delegationId, delegation.delegator, delegation.delegatee, block.timestamp);
    }

    /// @notice Revoke an active delegation
    /// @param delegationId ID of the delegation to revoke
    function revokeDelegation(bytes32 delegationId) external nonReentrant {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.delegator != msg.sender) revert UnauthorizedDelegator();
        if (delegation.status != DelegationStatus.ACTIVE && delegation.status != DelegationStatus.PENDING) {
            revert DelegationNotActive();
        }

        DelegationStatus oldStatus = delegation.status;
        delegation.status = DelegationStatus.REVOKED;
        delegation.revokedAt = block.timestamp;

        if (oldStatus == DelegationStatus.ACTIVE) {
            _activeDelegations--;
        }

        // Revoke all permissions
        Permission[] memory grantedPerms = _grantedPermissions[delegationId];
        for (uint256 i = 0; i < grantedPerms.length; i++) {
            _permissions[delegationId][grantedPerms[i]].granted = false;
        }

        emit DelegationStatusChanged(delegationId, oldStatus, DelegationStatus.REVOKED);
        emit DelegationRevoked(delegationId, delegation.delegator, delegation.delegatee, block.timestamp);
    }

    // ── Permission Management ──────────────────────────────────────────────────

    /// @notice Grant a permission to a delegation
    /// @param delegationId ID of the delegation
    /// @param permission Permission to grant
    function grantPermission(bytes32 delegationId, Permission permission) external nonReentrant {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.delegator != msg.sender) revert UnauthorizedDelegator();
        if (delegation.status != DelegationStatus.ACTIVE) revert DelegationNotActive();

        PermissionGrant storage permGrant = _permissions[delegationId][permission];
        if (permGrant.granted) revert PermissionAlreadyGranted();

        permGrant.permission = permission;
        permGrant.granted = true;
        permGrant.grantedAt = block.timestamp;

        _grantedPermissions[delegationId].push(permission);

        emit PermissionGranted(delegationId, delegation.delegatee, permission, block.timestamp);
    }

    /// @notice Revoke a permission from a delegation
    /// @param delegationId ID of the delegation
    /// @param permission Permission to revoke
    function revokePermission(bytes32 delegationId, Permission permission) external nonReentrant {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.delegator != msg.sender) revert UnauthorizedDelegator();

        PermissionGrant storage permGrant = _permissions[delegationId][permission];
        if (!permGrant.granted) revert PermissionNotGranted();

        permGrant.granted = false;

        emit PermissionRevoked(delegationId, delegation.delegatee, permission, block.timestamp);
    }

    /// @notice Grant multiple permissions at once
    /// @param delegationId ID of the delegation
    /// @param permissions Array of permissions to grant
    function grantPermissions(
        bytes32 delegationId,
        Permission[] calldata permissions
    ) external nonReentrant {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.delegator != msg.sender) revert UnauthorizedDelegator();
        if (delegation.status != DelegationStatus.ACTIVE) revert DelegationNotActive();

        for (uint256 i = 0; i < permissions.length; i++) {
            Permission permission = permissions[i];
            PermissionGrant storage permGrant = _permissions[delegationId][permission];
            
            if (!permGrant.granted) {
                permGrant.permission = permission;
                permGrant.granted = true;
                permGrant.grantedAt = block.timestamp;
                _grantedPermissions[delegationId].push(permission);

                emit PermissionGranted(delegationId, delegation.delegatee, permission, block.timestamp);
            }
        }
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Get delegation details
    /// @param delegationId ID of the delegation
    /// @return delegation Delegation struct
    function getDelegation(bytes32 delegationId) external view returns (Delegation memory) {
        Delegation memory delegation = _delegations[delegationId];
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        return delegation;
    }

    /// @notice Get delegation status
    /// @param delegationId ID of the delegation
    /// @return status Current status of the delegation
    function getDelegationStatus(bytes32 delegationId) external view returns (DelegationStatus) {
        Delegation memory delegation = _delegations[delegationId];
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        
        // Check if expired
        if (delegation.status == DelegationStatus.ACTIVE && 
            delegation.expiresAt > 0 && 
            block.timestamp >= delegation.expiresAt) {
            return DelegationStatus.EXPIRED;
        }
        
        return delegation.status;
    }

    /// @notice Check if a delegation is active
    /// @param delegationId ID of the delegation
    /// @return active True if delegation is active
    function isDelegationActive(bytes32 delegationId) external view returns (bool) {
        Delegation memory delegation = _delegations[delegationId];
        if (delegation.delegator == address(0)) return false;
        if (delegation.status != DelegationStatus.ACTIVE) return false;
        if (delegation.expiresAt > 0 && block.timestamp >= delegation.expiresAt) return false;
        return true;
    }

    /// @notice Check if a delegatee has a specific permission
    /// @param delegationId ID of the delegation
    /// @param permission Permission to check
    /// @return hasPermission True if permission is granted
    function hasPermission(
        bytes32 delegationId,
        Permission permission
    ) external view returns (bool) {
        Delegation memory delegation = _delegations[delegationId];
        if (delegation.delegator == address(0)) return false;
        if (delegation.status != DelegationStatus.ACTIVE) return false;
        if (delegation.expiresAt > 0 && block.timestamp >= delegation.expiresAt) return false;
        
        return _permissions[delegationId][permission].granted;
    }

    /// @notice Get all permissions for a delegation
    /// @param delegationId ID of the delegation
    /// @return permissions Array of granted permissions
    function getGrantedPermissions(bytes32 delegationId) external view returns (Permission[] memory) {
        if (_delegations[delegationId].delegator == address(0)) revert DelegationNotFound();
        return _grantedPermissions[delegationId];
    }

    /// @notice Get all delegations by a delegator
    /// @param delegator Address of the delegator
    /// @return delegationIds Array of delegation IDs
    function getDelegationsByDelegator(address delegator) external view returns (bytes32[] memory) {
        return _delegatorDelegations[delegator];
    }

    /// @notice Get all delegations to a delegatee
    /// @param delegatee Address of the delegatee
    /// @return delegationIds Array of delegation IDs
    function getDelegationsByDelegatee(address delegatee) external view returns (bytes32[] memory) {
        return _delegateeDelegations[delegatee];
    }

    /// @notice Get all delegations for a market
    /// @param marketId Market ID
    /// @return delegationIds Array of delegation IDs
    function getDelegationsByMarket(uint256 marketId) external view returns (bytes32[] memory) {
        return _marketDelegations[marketId];
    }

    /// @notice Get delegation statistics
    /// @return stats DelegationStats struct
    function getDelegationStats() external view returns (DelegationStats memory stats) {
        uint256 revoked = 0;
        uint256 expired = 0;

        // This is a simplified version - in production, you'd track these separately
        stats.totalDelegations = _totalDelegations;
        stats.activeDelegations = _activeDelegations;
        stats.revokedDelegations = revoked;
        stats.expiredDelegations = expired;

        return stats;
    }

    /// @notice Get total number of delegations
    /// @return total Total delegations created
    function getTotalDelegations() external view returns (uint256) {
        return _totalDelegations;
    }

    /// @notice Get number of active delegations
    /// @return active Active delegations count
    function getActiveDelegations() external view returns (uint256) {
        return _activeDelegations;
    }

    // ── Admin Functions ────────────────────────────────────────────────────────

    /// @notice Emergency function to expire a delegation (admin only)
    /// @param delegationId ID of the delegation to expire
    function expireDelegation(bytes32 delegationId) external onlyOwner {
        Delegation storage delegation = _delegations[delegationId];
        
        if (delegation.delegator == address(0)) revert DelegationNotFound();
        if (delegation.status != DelegationStatus.ACTIVE) revert DelegationNotActive();

        DelegationStatus oldStatus = delegation.status;
        delegation.status = DelegationStatus.EXPIRED;
        _activeDelegations--;

        emit DelegationStatusChanged(delegationId, oldStatus, DelegationStatus.EXPIRED);
        emit DelegationExpired(delegationId, delegation.delegator, delegation.delegatee, block.timestamp);
    }
}
