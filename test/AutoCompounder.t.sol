// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/contracts/AutoCompounder.sol";
import "../Contracts/contracts/MarketCompound.sol";

contract AutoCompounderTest is Test {
    AutoCompounder public autoCompounder;
    MarketCompound public marketCompound;

    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public treasury = address(0x4);

    function setUp() public {
        // Deploy MarketCompound first
        vm.startPrank(owner);
        marketCompound = new MarketCompound(treasury);

        // Deploy AutoCompounder with MarketCompound address
        autoCompounder = new AutoCompounder(address(marketCompound));
        vm.stopPrank();
    }

    // ── Deployment & Initialization Tests ──────────────────────────────────────
    function test_Initialization() public {
        assertEq(autoCompounder.owner(), owner);
        assertEq(autoCompounder.marketCompoundAddress(), address(marketCompound));

        (uint256 totalCompounds, uint256 totalYield, uint256 totalFees) = autoCompounder.getPerformanceMetrics();
        assertEq(totalCompounds, 0);
        assertEq(totalYield, 0);
        assertEq(totalFees, 0);
    }

    function test_SetFeeTreasury() public {
        address newTreasury = address(0x5);

        vm.prank(owner);
        marketCompound.setFeeTreasury(newTreasury);
        assertEq(marketCompound.feeTreasury(), newTreasury);
    }

    // ── Position Management Tests ──────────────────────────────────────────────
    function test_RegisterPosition() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        uint256 positionId = autoCompounder.registerPosition(marketId, alice, 1e18);
        vm.stopPrank();

        assertEq(positionId, 1);

        (
            uint256 mid,
            address user,
            uint256 threshold,
            ,
            bool isActive
        ) = autoCompounder.positions(positionId);

        assertEq(mid, marketId);
        assertEq(user, alice);
        assertEq(threshold, 1e18);
        assertTrue(isActive);
    }

    function test_UnregisterPosition() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        uint256 positionId = autoCompounder.registerPosition(marketId, alice, 1e18);
        autoCompounder.unregisterPosition(positionId);
        vm.stopPrank();

        AutoCompoundPosition memory pos = autoCompounder.positions(positionId);
        assertFalse(pos.isActive);
    }

    function test_UpdateYieldThreshold() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        uint256 positionId = autoCompounder.registerPosition(marketId, alice, 1e18);
        autoCompounder.updateYieldThreshold(positionId, 5e18);
        vm.stopPrank();

        assertEq(autoCompounder.positions(positionId).minYieldThreshold, 5e18);
    }

    // ── Auto-Compound Tests ───────────────────────────────────────────────────
    function test_AutoCompound() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        // Alice deposits
        vm.startPrank(alice);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Register position
        vm.startPrank(owner);
        uint256 positionId = autoCompounder.registerPosition(marketId, alice, 1e18);
        vm.stopPrank();

        // Warp 10 seconds
        vm.warp(block.timestamp + 10);

        // Check eligibility
        assertTrue(autoCompounder.checkCompoundEligibility(positionId));

        // Perform auto-compound
        vm.prank(alice);
        uint256 netAmount = autoCompounder.performCompound(positionId);

        assertGt(netAmount, 0);

        // Check performance updated
        (uint256 compounds, uint256 totalYield, uint256 totalFees) = autoCompounder.getPerformanceMetrics();
        assertEq(compounds, 1);
        assertGt(totalYield, 0);
        assertGt(totalFees, 0);
    }

    function test_PerformMultiplePositions() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        // Alice and Bob deposit
        vm.startPrank(alice);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Register positions
        vm.startPrank(owner);
        uint256 posId1 = autoCompounder.registerPosition(marketId, alice, 1e18);
        uint256 posId2 = autoCompounder.registerPosition(marketId, bob, 1e18);
        vm.stopPrank();

        // Warp 10 seconds
        vm.warp(block.timestamp + 10);

        // Perform all eligible compounds
        uint256 executed = autoCompounder.performAllEligibleCompounds();

        assertEq(executed, 2);

        // Check history
        AutoCompounder.AutoCompoundRecord[] memory aliceHistory = autoCompounder.getAutoCompoundHistory(posId1);
        assertEq(aliceHistory.length, 1);

        AutoCompounder.AutoCompoundRecord[] memory bobHistory = autoCompounder.getAutoCompoundHistory(posId2);
        assertEq(bobHistory.length, 1);
    }

    // ── Query Tests ─────────────────────────────────────────────────────────────
    function test_GetEligiblePositionsCount() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        // Alice deposits
        vm.startPrank(alice);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Register position with low threshold
        vm.startPrank(owner);
        autoCompounder.registerPosition(marketId, alice, 1e18);
        vm.stopPrank();

        // No yield yet
        assertEq(autoCompounder.getEligiblePositionsCount(), 0);

        // Warp to generate yield
        vm.warp(block.timestamp + 10);

        // Now eligible
        assertEq(autoCompounder.getEligiblePositionsCount(), 1);
    }

    function test_CheckAllTriggers() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        // Alice and Bob deposit
        vm.startPrank(alice);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        marketCompound.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Register positions with different thresholds
        vm.startPrank(owner);
        autoCompounder.registerPosition(marketId, alice, 1e18);
        autoCompounder.registerPosition(marketId, bob, 1000e18);
        vm.stopPrank();

        // Warp to generate yield
        vm.warp(block.timestamp + 10);

        // Check triggers
        AutoCompounder.CompoundTrigger[] memory triggers = autoCompounder.checkAllTriggers();
        assertEq(triggers.length, 2);
        assertTrue(triggers[0].triggerMet); // Alice should be triggered (low threshold)
        assertFalse(triggers[1].triggerMet); // Bob should not be triggered (high threshold)
    }

    function test_GetUserPositions() public {
        vm.startPrank(owner);
        uint256 marketId = marketCompound.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        // Register multiple positions for Alice
        vm.startPrank(owner);
        uint256 posId1 = autoCompounder.registerPosition(marketId, alice, 1e18);
        uint256 posId2 = autoCompounder.registerPosition(marketId, alice, 2e18);
        vm.stopPrank();

        uint256[] memory positions = autoCompounder.getUserPositions(alice);
        assertEq(positions.length, 2);
        assertEq(positions[0], posId1);
        assertEq(positions[1], posId2);
    }
}