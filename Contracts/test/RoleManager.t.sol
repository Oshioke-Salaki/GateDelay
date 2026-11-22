// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {RoleManager} from "../src/RoleManager.sol";

contract RoleManagerTest is Test {
    RoleManager internal manager;

    address internal admin = address(0xA11CE);
    address internal operator = address(0xB0B);
    address internal outsider = address(0xC0FFEE);

    bytes32 internal constant MARKET_ADMIN = keccak256("MARKET_ADMIN");
    bytes32 internal constant UNREGISTERED = keccak256("UNREGISTERED");
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

    event RoleCreated(bytes32 indexed role);
    event RoleAssigned(bytes32 indexed role, address indexed account);
    event RoleUnassigned(bytes32 indexed role, address indexed account);

    function setUp() public {
        vm.prank(admin);
        manager = new RoleManager();
    }

    // ── Construction / deployment requirements ────────────────────────────────

    function test_DeployerIsAdmin() public view {
        assertTrue(manager.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertFalse(manager.hasRole(DEFAULT_ADMIN_ROLE, outsider));
    }

    function test_ConstructorRegistersDefaultAdminRole() public view {
        assertTrue(manager.roleExists(DEFAULT_ADMIN_ROLE));

        bytes32[] memory created = manager.getCreatedRoles();
        assertEq(created.length, 1);
        assertEq(created[0], DEFAULT_ADMIN_ROLE);
    }

    function test_ConstructorIndexesTheDeployersRole() public view {
        bytes32[] memory roles = manager.getRoles(admin);
        assertEq(roles.length, 1);
        assertEq(roles[0], DEFAULT_ADMIN_ROLE);
    }

    // ── createRole ────────────────────────────────────────────────────────────

    function test_CreateRole() public {
        vm.expectEmit(true, false, false, true);
        emit RoleCreated(MARKET_ADMIN);

        vm.prank(admin);
        manager.createRole(MARKET_ADMIN);

        assertTrue(manager.roleExists(MARKET_ADMIN));
        assertEq(manager.getCreatedRoles().length, 2);
    }

    function test_CreateRole_RevertsForNonAdmin() public {
        vm.expectRevert("RoleManager: caller is not admin");
        vm.prank(outsider);
        manager.createRole(MARKET_ADMIN);
    }

    function test_CreateRole_RevertsOnZeroRole() public {
        vm.expectRevert("RoleManager: invalid role");
        vm.prank(admin);
        manager.createRole(bytes32(0));
    }

    function test_CreateRole_RevertsOnDuplicate() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: role already exists");
        manager.createRole(MARKET_ADMIN);
        vm.stopPrank();
    }

    // ── assignRole ────────────────────────────────────────────────────────────

    function test_AssignRole() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectEmit(true, true, false, true);
        emit RoleAssigned(MARKET_ADMIN, operator);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        assertTrue(manager.hasRole(MARKET_ADMIN, operator));

        bytes32[] memory roles = manager.getRoles(operator);
        assertEq(roles.length, 1);
        assertEq(roles[0], MARKET_ADMIN);
    }

    /// @dev The registry is the point of the contract: an unregistered role can
    ///      never be handed out, so a mistyped `bytes32` cannot become live.
    function test_AssignRole_RevertsForUnregisteredRole() public {
        vm.expectRevert("RoleManager: role does not exist");
        vm.prank(admin);
        manager.assignRole(UNREGISTERED, operator);
    }

    function test_AssignRole_RevertsForNonAdmin() public {
        vm.prank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: caller is not admin");
        vm.prank(outsider);
        manager.assignRole(MARKET_ADMIN, outsider);
    }

    function test_AssignRole_RevertsOnZeroAccount() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: invalid account");
        manager.assignRole(MARKET_ADMIN, address(0));
        vm.stopPrank();
    }

    function test_AssignRole_RevertsOnZeroRole() public {
        vm.expectRevert("RoleManager: invalid role");
        vm.prank(admin);
        manager.assignRole(bytes32(0), operator);
    }

    function test_AssignRole_RevertsWhenAlreadyAssigned() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);

        vm.expectRevert("RoleManager: role already assigned");
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();
    }

    // ── revokeRole ────────────────────────────────────────────────────────────

    function test_RevokeRole() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);

        vm.expectEmit(true, true, false, true);
        emit RoleUnassigned(MARKET_ADMIN, operator);
        manager.revokeRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        assertFalse(manager.hasRole(MARKET_ADMIN, operator));
        assertEq(manager.getRoles(operator).length, 0);
        // The role stays registered and can be re-assigned.
        assertTrue(manager.roleExists(MARKET_ADMIN));
    }

    function test_RevokeRole_RevertsForNonAdmin() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        vm.expectRevert("RoleManager: caller is not admin");
        vm.prank(operator);
        manager.revokeRole(MARKET_ADMIN, operator);
    }

    function test_RevokeRole_RevertsForUnregisteredRole() public {
        vm.expectRevert("RoleManager: role does not exist");
        vm.prank(admin);
        manager.revokeRole(UNREGISTERED, operator);
    }

    function test_RevokeRole_RevertsWhenNotAssigned() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: role not assigned");
        manager.revokeRole(MARKET_ADMIN, operator);
        vm.stopPrank();
    }

    function test_ReassignAfterRevoke() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);
        manager.revokeRole(MARKET_ADMIN, operator);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        assertTrue(manager.hasRole(MARKET_ADMIN, operator));
        assertEq(manager.getRoles(operator).length, 1);
    }

    // ── grantRole is disabled ─────────────────────────────────────────────────

    function test_GrantRole_AlwaysReverts() public {
        vm.prank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: use assignRole");
        vm.prank(admin);
        manager.grantRole(MARKET_ADMIN, operator);
    }

    function test_GrantRole_RevertsForOutsiderToo() public {
        vm.expectRevert("RoleManager: use assignRole");
        vm.prank(outsider);
        manager.grantRole(MARKET_ADMIN, outsider);
    }

    // ── renounceRole keeps the per-account index honest ───────────────────────

    /// @dev Regression guard. OZ's `renounceRole` calls `_revokeRole` directly and
    ///      never passes through `revokeRole`, so bookkeeping done in the external
    ///      function alone would leave `getRoles` reporting a role the account no
    ///      longer holds.
    function test_RenounceRole_UpdatesGetRoles() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        assertEq(manager.getRoles(operator).length, 1);

        vm.prank(operator);
        manager.renounceRole(MARKET_ADMIN, operator);

        assertFalse(manager.hasRole(MARKET_ADMIN, operator));
        assertEq(manager.getRoles(operator).length, 0);
    }

    function test_RenounceRole_RevertsForOtherAccount() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlBadConfirmation.selector));
        vm.prank(outsider);
        manager.renounceRole(MARKET_ADMIN, operator);
    }

    // ── Enumeration ───────────────────────────────────────────────────────────

    function test_GetRoleMembersEnumeratesHolders() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.assignRole(MARKET_ADMIN, operator);
        manager.assignRole(MARKET_ADMIN, outsider);
        vm.stopPrank();

        address[] memory members = manager.getRoleMembers(MARKET_ADMIN);
        assertEq(members.length, 2);
        assertEq(manager.getRoleMemberCount(MARKET_ADMIN), 2);
        assertEq(members[0], operator);
        assertEq(members[1], outsider);
    }

    function test_GetRolesReturnsEveryHeldRole() public {
        bytes32 settler = keccak256("SETTLER");

        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);
        manager.createRole(settler);
        manager.assignRole(MARKET_ADMIN, operator);
        manager.assignRole(settler, operator);
        vm.stopPrank();

        bytes32[] memory roles = manager.getRoles(operator);
        assertEq(roles.length, 2);
        assertEq(roles[0], MARKET_ADMIN);
        assertEq(roles[1], settler);
    }

    function test_GetRolesIsEmptyForUnknownAccount() public view {
        assertEq(manager.getRoles(outsider).length, 0);
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_CreateAndAssignArbitraryRole(bytes32 role, address account) public {
        vm.assume(role != bytes32(0));
        vm.assume(role != DEFAULT_ADMIN_ROLE);
        vm.assume(account != address(0));

        vm.startPrank(admin);
        manager.createRole(role);
        manager.assignRole(role, account);
        vm.stopPrank();

        assertTrue(manager.hasRole(role, account));
        assertTrue(manager.roleExists(role));

        bytes32[] memory roles = manager.getRoles(account);
        // `admin` already holds DEFAULT_ADMIN_ROLE, so it carries two entries.
        assertEq(roles.length, account == admin ? 2 : 1);
    }

    function testFuzz_NonAdminCannotCreateRole(address caller) public {
        vm.assume(caller != admin);

        vm.expectRevert("RoleManager: caller is not admin");
        vm.prank(caller);
        manager.createRole(MARKET_ADMIN);
    }
}
