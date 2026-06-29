// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketAdmin.sol";

contract MarketAdminTest is Test {
    MarketAdmin internal admin;
    
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal charlie = address(0xC0FFEE);

    function setUp() public {
        admin = new MarketAdmin(alice);
    }

    // -------------------------------------------------------------------------
    // Admin Transfer Tests
    // -------------------------------------------------------------------------

    function test_InitialAdminSet() public {
        assertEq(admin.getCurrentAdmin(), alice);
    }

    function test_TransferAdmin() public {
        vm.prank(alice);
        admin.transferAdmin(bob);
        assertEq(admin.getCurrentAdmin(), bob);
    }

    function test_TransferAdminEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit MarketAdmin.AdminTransferred(alice, bob);
        admin.transferAdmin(bob);
    }

    function test_TransferAdminRevokesPreviousRole() public {
        vm.prank(alice);
        admin.transferAdmin(bob);
        
        vm.prank(alice);
        vm.expectRevert();
        admin.transferAdmin(charlie);
    }

    function test_TransferAdminGrantsNewRole() public {
        vm.prank(alice);
        admin.transferAdmin(bob);
        
        vm.prank(bob);
        admin.transferAdmin(charlie);
        assertEq(admin.getCurrentAdmin(), charlie);
    }

    function test_TransferAdminRejectsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert("Invalid admin address");
        admin.transferAdmin(address(0));
    }

    function test_TransferAdminRejectsSameAdmin() public {
        vm.prank(alice);
        vm.expectRevert("Already admin");
        admin.transferAdmin(alice);
    }

    function test_TransferAdminRejectsNonAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        admin.transferAdmin(charlie);
    }

    // -------------------------------------------------------------------------
    // Admin History Tests
    // -------------------------------------------------------------------------

    function test_AdminHistoryTracked() public {
        address[] memory history = admin.getAdminHistory();
        assertEq(history.length, 1);
        assertEq(history[0], alice);
    }

    function test_AdminHistoryUpdatedOnTransfer() public {
        vm.prank(alice);
        admin.transferAdmin(bob);
        
        address[] memory history = admin.getAdminHistory();
        assertEq(history.length, 2);
        assertEq(history[0], alice);
        assertEq(history[1], bob);
    }

    // -------------------------------------------------------------------------
    // Operator Management Tests
    // -------------------------------------------------------------------------

    function test_AddOperator() public {
        vm.prank(alice);
        admin.addOperator(bob);
        assertTrue(admin.isOperator(bob));
    }

    function test_AddOperatorEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit MarketAdmin.OperatorAdded(bob);
        admin.addOperator(bob);
    }

    function test_RemoveOperator() public {
        vm.prank(alice);
        admin.addOperator(bob);
        assertTrue(admin.isOperator(bob));
        
        vm.prank(alice);
        admin.removeOperator(bob);
        assertFalse(admin.isOperator(bob));
    }

    function test_RemoveOperatorEmitsEvent() public {
        vm.prank(alice);
        admin.addOperator(bob);
        
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit MarketAdmin.OperatorRemoved(bob);
        admin.removeOperator(bob);
    }

    function test_AddOperatorRejectsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert("Invalid operator address");
        admin.addOperator(address(0));
    }

    function test_RemoveOperatorRejectsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert("Invalid operator address");
        admin.removeOperator(address(0));
    }

    function test_AddOperatorRejectsNonAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        admin.addOperator(charlie);
    }

    function test_RemoveOperatorRejectsNonAdmin() public {
        vm.prank(alice);
        admin.addOperator(bob);
        
        vm.prank(charlie);
        vm.expectRevert();
        admin.removeOperator(bob);
    }

    // -------------------------------------------------------------------------
    // Query Tests
    // -------------------------------------------------------------------------

    function test_IsAdmin() public {
        assertTrue(admin.isAdmin(alice));
        assertFalse(admin.isAdmin(bob));
    }

    function test_IsOperator() public {
        assertFalse(admin.isOperator(bob));
        
        vm.prank(alice);
        admin.addOperator(bob);
        assertTrue(admin.isOperator(bob));
    }

    function test_MultipleOperators() public {
        vm.prank(alice);
        admin.addOperator(bob);
        admin.addOperator(charlie);
        
        assertTrue(admin.isOperator(bob));
        assertTrue(admin.isOperator(charlie));
    }
}
