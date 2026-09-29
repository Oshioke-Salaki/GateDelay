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

    function test_DeployerIsAdmin() public view {
        assertTrue(manager.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertFalse(manager.hasRole(DEFAULT_ADMIN_ROLE, outsider));
    }

    function test_CreateRole() public {
        vm.expectEmit(true, false, false, true);
        emit RoleCreated(MARKET_ADMIN);

        vm.prank(admin);
        manager.createRole(MARKET_ADMIN);

        assertTrue(manager.roleExists(MARKET_ADMIN));
        assertEq(manager.getCreatedRoles().length, 2);
    }

    function test_AssignRole() public {
        vm.startPrank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectEmit(true, true, false, true);
        emit RoleAssigned(MARKET_ADMIN, operator);
        manager.assignRole(MARKET_ADMIN, operator);
        vm.stopPrank();

        assertTrue(manager.hasRole(MARKET_ADMIN, operator));
    }

    function test_GrantRole_AlwaysReverts() public {
        vm.prank(admin);
        manager.createRole(MARKET_ADMIN);

        vm.expectRevert("RoleManager: use assignRole");
        vm.prank(admin);
        manager.grantRole(MARKET_ADMIN, operator);
    }
}
