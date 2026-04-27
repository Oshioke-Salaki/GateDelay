// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PausableMarket.sol";

contract PausableMarketTest is Test {
    PausableMarket internal market;
    
    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    function setUp() public {
        vm.prank(owner);
        market = new PausableMarket();
    }

    // -------------------------------------------------------------------------
    // Pause Tests
    // -------------------------------------------------------------------------

    function test_InitiallyNotPaused() public {
        assertFalse(market.isPaused());
    }

    function test_PauseMarket() public {
        vm.prank(owner);
        market.pause("Emergency maintenance");
        assertTrue(market.isPaused());
    }

    function test_PauseEmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit PausableMarket.MarketPaused(owner, "Emergency maintenance");
        market.pause("Emergency maintenance");
    }

    function test_PauseStoreReason() public {
        vm.prank(owner);
        market.pause("System upgrade");
        assertEq(market.getPauseReason(), "System upgrade");
    }

    function test_PauseStoresPausedBy() public {
        vm.prank(owner);
        market.pause("Emergency");
        assertEq(market.getPausedBy(), owner);
    }

    function test_PauseStoresPausedAt() public {
        vm.prank(owner);
        uint256 blockTime = block.timestamp;
        market.pause("Emergency");
        assertEq(market.getPausedAt(), blockTime);
    }

    function test_PauseRejectsNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        market.pause("Unauthorized");
    }

    function test_PauseRejectsWhenAlreadyPaused() public {
        vm.prank(owner);
        market.pause("First pause");
        
        vm.prank(owner);
        vm.expectRevert("Already paused");
        market.pause("Second pause");
    }

    // -------------------------------------------------------------------------
    // Unpause Tests
    // -------------------------------------------------------------------------

    function test_UnpauseMarket() public {
        vm.prank(owner);
        market.pause("Emergency");
        assertTrue(market.isPaused());
        
        vm.prank(owner);
        market.unpause();
        assertFalse(market.isPaused());
    }

    function test_UnpauseEmitsEvent() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit PausableMarket.MarketUnpaused(owner);
        market.unpause();
    }

    function test_UnpauseClearsPauseReason() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.prank(owner);
        market.unpause();
        assertEq(market.getPauseReason(), "");
    }

    function test_UnpauseClearsPausedBy() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.prank(owner);
        market.unpause();
        assertEq(market.getPausedBy(), address(0));
    }

    function test_UnpauseClearsPausedAt() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.prank(owner);
        market.unpause();
        assertEq(market.getPausedAt(), 0);
    }

    function test_UnpauseRejectsNonOwner() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.prank(user);
        vm.expectRevert();
        market.unpause();
    }

    function test_UnpauseRejectsWhenNotPaused() public {
        vm.prank(owner);
        vm.expectRevert("Not paused");
        market.unpause();
    }

    // -------------------------------------------------------------------------
    // Protected Function Tests
    // -------------------------------------------------------------------------

    function test_ExecuteMarketOperationWhenNotPaused() public {
        assertTrue(market.executeMarketOperation());
    }

    function test_ExecuteMarketOperationRejectsWhenPaused() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        vm.expectRevert();
        market.executeMarketOperation();
    }

    function test_EmergencyWithdrawRejectsWhenNotPaused() public {
        vm.expectRevert();
        market.emergencyWithdraw();
    }

    function test_EmergencyWithdrawWhenPaused() public {
        vm.prank(owner);
        market.pause("Emergency");
        
        assertTrue(market.emergencyWithdraw());
    }

    // -------------------------------------------------------------------------
    // Status Query Tests
    // -------------------------------------------------------------------------

    function test_IsPausedQuery() public {
        assertFalse(market.isPaused());
        
        vm.prank(owner);
        market.pause("Emergency");
        assertTrue(market.isPaused());
        
        vm.prank(owner);
        market.unpause();
        assertFalse(market.isPaused());
    }
}
