// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AccessControl
/// @notice Comprehensive access control system with role-based permissions.
contract AccessControl {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error AccessDenied();
    error InvalidRole();
    error RoleAlreadyAssigned();
    error RoleNotAssigned();
    error CannotRevokeOwnRole();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev role => account => hasRole
    mapping(bytes32 => mapping(address => bool)) private _roles;

    /// @dev role => list of accounts with role
    mapping(bytes32 => address[]) private _roleMembers;

    /// @dev account => list of roles
    mapping(address => bytes32[]) private _accountRoles;

    /// @dev role => role description
    mapping(bytes32 => string) private _roleDescriptions;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed grantor);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed revoker);
    event RoleDescriptionSet(bytes32 indexed role, string description);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() {
        _roles[ADMIN_ROLE][msg.sender] = true;
        _roleMembers[ADMIN_ROLE].push(msg.sender);
        _accountRoles[msg.sender].push(ADMIN_ROLE);

        _roleDescriptions[ADMIN_ROLE] = "Administrator role with full permissions";
        _roleDescriptions[MANAGER_ROLE] = "Manager role with elevated permissions";
        _roleDescriptions[OPERATOR_ROLE] = "Operator role with operational permissions";
        _roleDescriptions[USER_ROLE] = "User role with basic permissions";
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Require caller to have a specific role.
    modifier onlyRole(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert AccessDenied();
        _;
    }

    /// @notice Require caller to have admin role.
    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    // -------------------------------------------------------------------------
    // Role management functions
    // -------------------------------------------------------------------------

    /// @notice Grant a role to an account.
    /// @param role Role identifier.
    /// @param account Account to grant role to.
    function grantRole(bytes32 role, address account) external onlyAdmin {
        if (account == address(0)) revert InvalidRole();
        if (_roles[role][account]) revert RoleAlreadyAssigned();

        _roles[role][account] = true;
        _roleMembers[role].push(account);
        _accountRoles[account].push(role);

        emit RoleGranted(role, account, msg.sender);
    }

    /// @notice Revoke a role from an account.
    /// @param role Role identifier.
    /// @param account Account to revoke role from.
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        if (!_roles[role][account]) revert RoleNotAssigned();

        _roles[role][account] = false;

        // Remove from roleMembers
        address[] storage members = _roleMembers[role];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == account) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }

        // Remove from accountRoles
        bytes32[] storage roles = _accountRoles[account];
        for (uint256 i = 0; i < roles.length; i++) {
            if (roles[i] == role) {
                roles[i] = roles[roles.length - 1];
                roles.pop();
                break;
            }
        }

        emit RoleRevoked(role, account, msg.sender);
    }

    /// @notice Renounce a role (self-revocation).
    /// @param role Role identifier.
    function renounceRole(bytes32 role) external {
        if (!_roles[role][msg.sender]) revert RoleNotAssigned();

        _roles[role][msg.sender] = false;

        // Remove from roleMembers
        address[] storage members = _roleMembers[role];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == msg.sender) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }

        // Remove from accountRoles
        bytes32[] storage roles = _accountRoles[msg.sender];
        for (uint256 i = 0; i < roles.length; i++) {
            if (roles[i] == role) {
                roles[i] = roles[roles.length - 1];
                roles.pop();
                break;
            }
        }

        emit RoleRevoked(role, msg.sender, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Check if an account has a role.
    /// @param role Role identifier.
    /// @param account Account to check.
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    /// @notice Get all members of a role.
    /// @param role Role identifier.
    function getRoleMembers(bytes32 role) external view returns (address[] memory) {
        return _roleMembers[role];
    }

    /// @notice Get member count for a role.
    /// @param role Role identifier.
    function getRoleMemberCount(bytes32 role) external view returns (uint256) {
        return _roleMembers[role].length;
    }

    /// @notice Get all roles for an account.
    /// @param account Account to check.
    function getAccountRoles(address account) external view returns (bytes32[] memory) {
        return _accountRoles[account];
    }

    /// @notice Get role count for an account.
    /// @param account Account to check.
    function getAccountRoleCount(address account) external view returns (uint256) {
        return _accountRoles[account].length;
    }

    /// @notice Get role description.
    /// @param role Role identifier.
    function getRoleDescription(bytes32 role) external view returns (string memory) {
        return _roleDescriptions[role];
    }

    /// @notice Set role description.
    /// @param role Role identifier.
    /// @param description Role description.
    function setRoleDescription(bytes32 role, string calldata description)
        external
        onlyAdmin
    {
        _roleDescriptions[role] = description;
        emit RoleDescriptionSet(role, description);
    }

    /// @notice Check if account has any of the specified roles.
    /// @param roles Array of role identifiers.
    /// @param account Account to check.
    function hasAnyRole(bytes32[] calldata roles, address account)
        external
        view
        returns (bool)
    {
        for (uint256 i = 0; i < roles.length; i++) {
            if (_roles[roles[i]][account]) return true;
        }
        return false;
    }

    /// @notice Check if account has all of the specified roles.
    /// @param roles Array of role identifiers.
    /// @param account Account to check.
    function hasAllRoles(bytes32[] calldata roles, address account)
        external
        view
        returns (bool)
    {
        for (uint256 i = 0; i < roles.length; i++) {
            if (!_roles[roles[i]][account]) return false;
        }
        return true;
    }
}
