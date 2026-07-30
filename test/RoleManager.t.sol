// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RoleManager.sol";

contract RoleManagerTest is Test {
    RoleManager roleManager;

    address admin = address(0x1);
    address alice = address(0x2);
    address bob = address(0x3);

    bytes32 constant ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;

    function setUp() public {
        vm.prank(admin);
        roleManager = new RoleManager();
    }

    function test_CanCreateRole() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        address[] memory members = roleManager.getRoleMembers(role);
        assertEq(members.length, 0);
    }

    function test_AssignRoleSetsPermission() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        vm.prank(admin);
        roleManager.assignRole(role, alice);

        assertTrue(roleManager.hasRole(role, alice));
    }

    function test_RevokeRoleRemovesPermission() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        vm.prank(admin);
        roleManager.assignRole(role, alice);
        assertTrue(roleManager.hasRole(role, alice));

        vm.prank(admin);
        roleManager.revokeRole(role, alice);

        assertFalse(roleManager.hasRole(role, alice));
    }

    function test_NonAdminCannotCreateRole() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(alice);
        vm.expectRevert(bytes("RoleManager: caller is not admin"));
        roleManager.createRole(role);
    }

    function test_NonAdminCannotAssignRole() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        vm.prank(alice);
        vm.expectRevert(bytes("RoleManager: caller is not admin"));
        roleManager.assignRole(role, bob);
    }

    function test_NonAdminCannotRevokeRole() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);
        vm.prank(admin);
        roleManager.assignRole(role, alice);

        vm.prank(alice);
        vm.expectRevert(bytes("RoleManager: caller is not admin"));
        roleManager.revokeRole(role, alice);
    }

    function test_AssignRoleTwiceReverts() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);
        vm.prank(admin);
        roleManager.assignRole(role, alice);

        vm.prank(admin);
        vm.expectRevert(bytes("RoleManager: role already assigned"));
        roleManager.assignRole(role, alice);
    }

    function test_RevokeUnassignedRoleReverts() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        vm.prank(admin);
        vm.expectRevert(bytes("RoleManager: role not assigned"));
        roleManager.revokeRole(role, alice);
    }

    function test_MultipleRolesPerAccount() public {
        bytes32 roleA = keccak256("ROLE_A");
        bytes32 roleB = keccak256("ROLE_B");

        vm.prank(admin);
        roleManager.createRole(roleA);
        vm.prank(admin);
        roleManager.createRole(roleB);

        vm.prank(admin);
        roleManager.assignRole(roleA, alice);
        vm.prank(admin);
        roleManager.assignRole(roleB, alice);

        bytes32[] memory roles = roleManager.getRoles(alice);
        assertEq(roles.length, 2);
        assertTrue(roleManager.hasRole(roleA, alice));
        assertTrue(roleManager.hasRole(roleB, alice));
    }

    function test_RoleEnumerationWorks() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        vm.prank(admin);
        roleManager.assignRole(role, alice);

        address[] memory members = roleManager.getRoleMembers(role);
        assertEq(members.length, 1);
        assertEq(members[0], alice);
    }

    function test_QueryEmptyRolesReturnsEmptyLists() public {
        bytes32 role = keccak256("CUSTOM_ROLE");

        vm.prank(admin);
        roleManager.createRole(role);

        address[] memory members = roleManager.getRoleMembers(role);
        assertEq(members.length, 0);

        bytes32[] memory roles = roleManager.getRoles(bob);
        assertEq(roles.length, 0);
    }
}
