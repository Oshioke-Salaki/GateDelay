// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title RoleManager
/// @notice Registry-backed access control: a role must be *created* before it can
///         be assigned, and every grant flows through a single admin-gated path.
/// @dev Extends OpenZeppelin `AccessControlEnumerable` (v5.x). Two things differ
///      from stock `AccessControl` and matter to integrators:
///
///      1. `grantRole` is disabled and reverts. Use {assignRole}, which refuses
///         roles that were never registered with {createRole}. This is what keeps
///         a typo'd `bytes32` from silently becoming a live privileged role.
///      2. A per-account role index (`_accountRoles`) backs {getRoles}. It is
///         maintained inside the `_grantRole`/`_revokeRole` overrides rather than
///         in the external functions, so `renounceRole` — which OZ routes
///         straight to `_revokeRole` — cannot leave the index stale.
///
/// ## Deployment
///
/// The constructor takes no arguments and grants `DEFAULT_ADMIN_ROLE` to
/// `msg.sender`, so **the deploying account becomes the sole admin**. When
/// deploying from a script or factory, the deployer is that contract, not the
/// EOA running it; transfer admin explicitly afterwards if that is not intended:
///
/// ```solidity
/// RoleManager manager = new RoleManager();      // msg.sender is admin
/// manager.createRole(keccak256("MARKET_ADMIN"));
/// manager.assignRole(keccak256("MARKET_ADMIN"), operator);
/// ```
///
/// There is no second admin and no timelock. `DEFAULT_ADMIN_ROLE` is registered
/// in the role set at construction, so it can be assigned to a co-admin via
/// {assignRole} — do that before renouncing, or the contract is left with no
/// admin and no way to appoint one.
contract RoleManager is AccessControlEnumerable {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /// @dev Roles registered through {createRole}; the assignable set.
    EnumerableSet.Bytes32Set private _createdRoles;

    /// @dev Reverse index of roles held per account, backing {getRoles}.
    mapping(address => EnumerableSet.Bytes32Set) private _accountRoles;

    /// @notice Emitted when a role is registered as assignable.
    event RoleCreated(bytes32 indexed role);

    /// @notice Emitted when a role is granted through {assignRole}.
    /// @dev Complements OZ's `RoleGranted`, which is also emitted.
    event RoleAssigned(bytes32 indexed role, address indexed account);

    /// @notice Emitted when a role is removed through {revokeRole}.
    /// @dev Complements OZ's `RoleRevoked`, which is also emitted.
    event RoleUnassigned(bytes32 indexed role, address indexed account);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "RoleManager: caller is not admin");
        _;
    }

    /// @notice Grants `DEFAULT_ADMIN_ROLE` to the deployer and registers it.
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _createdRoles.add(DEFAULT_ADMIN_ROLE);
        emit RoleCreated(DEFAULT_ADMIN_ROLE);
    }

    /// @notice Registers `role` so it can be handed out by {assignRole}.
    /// @param role Non-zero role identifier, conventionally `keccak256("NAME")`.
    function createRole(bytes32 role) external onlyAdmin {
        require(role != bytes32(0), "RoleManager: invalid role");
        require(!_createdRoles.contains(role), "RoleManager: role already exists");

        _createdRoles.add(role);
        emit RoleCreated(role);
    }

    /// @notice Grants a previously created `role` to `account`.
    /// @dev The sanctioned replacement for the disabled {grantRole}.
    function assignRole(bytes32 role, address account) external onlyAdmin {
        require(role != bytes32(0), "RoleManager: invalid role");
        require(account != address(0), "RoleManager: invalid account");
        require(_createdRoles.contains(role), "RoleManager: role does not exist");
        require(!hasRole(role, account), "RoleManager: role already assigned");

        _grantRole(role, account);
        emit RoleAssigned(role, account);
    }

    /// @notice Removes `role` from `account`.
    /// @dev Overrides `AccessControl.revokeRole` to gate on `DEFAULT_ADMIN_ROLE`
    ///      and to require that the role was registered. Bookkeeping happens in
    ///      the `_revokeRole` override, so `renounceRole` stays consistent too.
    function revokeRole(bytes32 role, address account)
        public
        virtual
        override(AccessControl, IAccessControl)
        onlyAdmin
    {
        require(_createdRoles.contains(role), "RoleManager: role does not exist");
        require(hasRole(role, account), "RoleManager: role not assigned");

        _revokeRole(role, account);
        emit RoleUnassigned(role, account);
    }

    /// @notice Disabled. Use {assignRole} so the role registry stays authoritative.
    function grantRole(bytes32, address) public virtual override(AccessControl, IAccessControl) {
        revert("RoleManager: use assignRole");
    }

    /// @notice Every role currently held by `account`.
    function getRoles(address account) external view returns (bytes32[] memory) {
        return _accountRoles[account].values();
    }

    /// @notice Every role registered through {createRole}, including `DEFAULT_ADMIN_ROLE`.
    function getCreatedRoles() external view returns (bytes32[] memory) {
        return _createdRoles.values();
    }

    /// @notice Whether `role` has been registered and is therefore assignable.
    function roleExists(bytes32 role) external view returns (bool) {
        return _createdRoles.contains(role);
    }

    /// @dev Single write point for the per-account index on the grant path.
    function _grantRole(bytes32 role, address account) internal virtual override returns (bool) {
        bool granted = super._grantRole(role, account);
        if (granted) {
            _accountRoles[account].add(role);
        }
        return granted;
    }

    /// @dev Single write point for the per-account index on the revoke path.
    ///      Covers {revokeRole} and OZ's `renounceRole` alike.
    function _revokeRole(bytes32 role, address account) internal virtual override returns (bool) {
        bool revoked = super._revokeRole(role, account);
        if (revoked) {
            _accountRoles[account].remove(role);
        }
        return revoked;
    }
}
