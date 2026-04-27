// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AccessControl.sol";

contract AccessControlTest is Test {
    AccessControl ac;
    address admin = address(0x1);
    address manager = address(0x2);
    address operator = address(0x3);
    address user = address(0x4);

    function setUp() public {
        vm.prank(admin);
        ac = new AccessControl();
    }

    function test_AdminRoleGrantedToDeployer() public {
        assertTrue(ac.hasRole(ac.ADMIN_ROLE(), admin));
    }

    function test_GrantRole() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        assertTrue(ac.hasRole(ac.MANAGER_ROLE(), manager));
    }

    function test_RevokeRole() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        vm.prank(admin);
        ac.revokeRole(ac.MANAGER_ROLE(), manager);

        assertFalse(ac.hasRole(ac.MANAGER_ROLE(), manager));
    }

    function test_RenounceRole() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        vm.prank(manager);
        ac.renounceRole(ac.MANAGER_ROLE());

        assertFalse(ac.hasRole(ac.MANAGER_ROLE(), manager));
    }

    function test_CannotGrantRoleToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(AccessControl.InvalidRole.selector);
        ac.grantRole(ac.MANAGER_ROLE(), address(0));
    }

    function test_CannotGrantRoleTwice() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        vm.prank(admin);
        vm.expectRevert(AccessControl.RoleAlreadyAssigned.selector);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
    }

    function test_CannotRevokeUnassignedRole() public {
        vm.prank(admin);
        vm.expectRevert(AccessControl.RoleNotAssigned.selector);
        ac.revokeRole(ac.MANAGER_ROLE(), manager);
    }

    function test_OnlyAdminCanGrantRole() public {
        vm.prank(manager);
        vm.expectRevert(AccessControl.AccessDenied.selector);
        ac.grantRole(ac.OPERATOR_ROLE(), operator);
    }

    function test_OnlyAdminCanRevokeRole() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        vm.prank(manager);
        vm.expectRevert(AccessControl.AccessDenied.selector);
        ac.revokeRole(ac.MANAGER_ROLE(), manager);
    }

    function test_GetRoleMembers() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        address[] memory members = ac.getRoleMembers(ac.MANAGER_ROLE());
        assertEq(members.length, 1);
        assertEq(members[0], manager);
    }

    function test_GetRoleMemberCount() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        ac.grantRole(ac.MANAGER_ROLE(), operator);

        assertEq(ac.getRoleMemberCount(ac.MANAGER_ROLE()), 2);
    }

    function test_GetAccountRoles() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        ac.grantRole(ac.OPERATOR_ROLE(), manager);

        bytes32[] memory roles = ac.getAccountRoles(manager);
        assertEq(roles.length, 2);
    }

    function test_GetAccountRoleCount() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        ac.grantRole(ac.OPERATOR_ROLE(), manager);

        assertEq(ac.getAccountRoleCount(manager), 2);
    }

    function test_SetRoleDescription() public {
        string memory description = "Custom manager role";
        vm.prank(admin);
        ac.setRoleDescription(ac.MANAGER_ROLE(), description);

        assertEq(ac.getRoleDescription(ac.MANAGER_ROLE()), description);
    }

    function test_HasAnyRole() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        bytes32[] memory roles = new bytes32[](2);
        roles[0] = ac.OPERATOR_ROLE();
        roles[1] = ac.MANAGER_ROLE();

        assertTrue(ac.hasAnyRole(roles, manager));
    }

    function test_HasAllRoles() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        ac.grantRole(ac.OPERATOR_ROLE(), manager);

        bytes32[] memory roles = new bytes32[](2);
        roles[0] = ac.MANAGER_ROLE();
        roles[1] = ac.OPERATOR_ROLE();

        assertTrue(ac.hasAllRoles(roles, manager));
    }

    function test_HasAllRolesFails() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);

        bytes32[] memory roles = new bytes32[](2);
        roles[0] = ac.MANAGER_ROLE();
        roles[1] = ac.OPERATOR_ROLE();

        assertFalse(ac.hasAllRoles(roles, manager));
    }

    function test_MultipleRolesPerAccount() public {
        vm.prank(admin);
        ac.grantRole(ac.MANAGER_ROLE(), manager);
        ac.grantRole(ac.OPERATOR_ROLE(), manager);
        ac.grantRole(ac.USER_ROLE(), manager);

        assertTrue(ac.hasRole(ac.MANAGER_ROLE(), manager));
        assertTrue(ac.hasRole(ac.OPERATOR_ROLE(), manager));
        assertTrue(ac.hasRole(ac.USER_ROLE(), manager));
        assertEq(ac.getAccountRoleCount(manager), 3);
    }

    function test_RoleDescriptions() public {
        string memory adminDesc = ac.getRoleDescription(ac.ADMIN_ROLE());
        assertEq(adminDesc, "Administrator role with full permissions");

        string memory managerDesc = ac.getRoleDescription(ac.MANAGER_ROLE());
        assertEq(managerDesc, "Manager role with elevated permissions");
    }
}
