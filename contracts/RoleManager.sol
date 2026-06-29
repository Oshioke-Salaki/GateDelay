// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract RoleManager is AccessControlEnumerable {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    EnumerableSet.Bytes32Set private _createdRoles;
    mapping(address => EnumerableSet.Bytes32Set) private _accountRoles;

    event RoleCreated(bytes32 indexed role);
    event RoleAssigned(bytes32 indexed role, address indexed account);
    event RoleRevoked(bytes32 indexed role, address indexed account);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "RoleManager: caller is not admin");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _createdRoles.add(DEFAULT_ADMIN_ROLE);
        _accountRoles[msg.sender].add(DEFAULT_ADMIN_ROLE);
        emit RoleCreated(DEFAULT_ADMIN_ROLE);
    }

    function createRole(bytes32 role) external onlyAdmin {
        require(role != bytes32(0), "RoleManager: invalid role");
        require(!_createdRoles.contains(role), "RoleManager: role already exists");

        _createdRoles.add(role);
        emit RoleCreated(role);
    }

    function assignRole(bytes32 role, address account) external onlyAdmin {
        require(role != bytes32(0), "RoleManager: invalid role");
        require(account != address(0), "RoleManager: invalid account");
        require(_createdRoles.contains(role), "RoleManager: role does not exist");
        require(!hasRole(role, account), "RoleManager: role already assigned");

        _grantRole(role, account);
        _accountRoles[account].add(role);
        emit RoleAssigned(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyAdmin {
        require(_createdRoles.contains(role), "RoleManager: role does not exist");
        require(hasRole(role, account), "RoleManager: role not assigned");

        _revokeRole(role, account);
        _accountRoles[account].remove(role);
        emit RoleRevoked(role, account);
    }

    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return super.hasRole(role, account);
    }

    function getRoles(address account) external view returns (bytes32[] memory) {
        EnumerableSet.Bytes32Set storage roles = _accountRoles[account];
        bytes32[] memory result = new bytes32[](roles.length());
        for (uint256 i = 0; i < roles.length(); i++) {
            result[i] = roles.at(i);
        }
        return result;
    }

    function getRoleMembers(bytes32 role) external view returns (address[] memory) {
        uint256 count = getRoleMemberCount(role);
        address[] memory members = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            members[i] = getRoleMember(role, i);
        }
        return members;
    }

    function grantRole(bytes32, address) public virtual override {
        revert("RoleManager: use assignRole");
    }

    function revokeRole(bytes32, address) public virtual override {
        revert("RoleManager: use revokeRole");
    }
}
