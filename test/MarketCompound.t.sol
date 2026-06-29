// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/contracts/MarketCompound.sol";

contract MarketCompoundTest is Test {
    MarketCompound public compounder;

    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public treasury = address(0x4);

    function setUp() public {
        vm.startPrank(owner);
        compounder = new MarketCompound(treasury);
        vm.stopPrank();
    }

    // ── Deployment & Initialization Tests ──────────────────────────────────────
    function test_Initialization() public {
        assertEq(compounder.owner(), owner);
        assertEq(compounder.feeTreasury(), treasury);
        assertEq(compounder.marketCount(), 0);
    }

    function test_SetFeeTreasury() public {
        address newTreasury = address(0x5);

        vm.prank(owner);
        compounder.setFeeTreasury(newTreasury);
        assertEq(compounder.feeTreasury(), newTreasury);

        // Revert when not owner
        vm.prank(alice);
        vm.expectRevert();
        compounder.setFeeTreasury(newTreasury);
    }

    // ── Market Management Tests ──────────────────────────────────────────────
    function test_AddMarket() public {
        vm.startPrank(owner);
        uint256 marketId = compounder.addMarket("Test Market", 1e18, 500);
        vm.stopPrank();

        assertEq(marketId, 1);
        assertEq(compounder.marketCount(), 1);

        (
            uint256 id,
            string memory name,
            uint256 baseYieldRate,
            ,
            ,
            uint256 feeBps,
            bool active
        ) = compounder.markets(1);

        assertEq(id, 1);
        assertEq(name, "Test Market");
        assertEq(baseYieldRate, 1e18);
        assertEq(feeBps, 500);
        assertTrue(active);
    }

    function test_UpdateMarket() public {
        vm.startPrank(owner);
        uint256 marketId = compounder.addMarket("Test Market", 1e18, 500);
        compounder.updateMarket(marketId, 2e18, 1000, false);
        vm.stopPrank();

        (
            ,,
            uint256 baseYieldRate,
            ,,
            ,
            uint256 feeBps,
            bool active
        ) = compounder.markets(marketId);

        assertEq(baseYieldRate, 2e18);
        assertEq(feeBps, 1000);
        assertFalse(active);
    }

    // ── Deposit and Yield Tests ────────────────────────────────────────────────
    function test_DepositAndYieldAccrual() public {
        vm.startPrank(owner);
        uint256 marketId = compounder.addMarket("Test Market", 1e18, 1000);
        vm.stopPrank();

        // Alice deposits
        vm.startPrank(alice);
        compounder.deposit(marketId, 1000e18);
        vm.stopPrank();

        (uint256 depositAmount,) = compounder.userPositions(marketId, alice);
        assertEq(depositAmount, 1000e18);

        // Advance time by 10 seconds
        vm.warp(block.timestamp + 10);

        // Alice should have yield accrued
        uint256 pending = compounder.getPendingYield(marketId, alice);
        assertGt(pending, 0);
    }

    // ── Compound & Fee Calculation Tests ───────────────────────────────────────
    function test_CompoundAndFees() public {
        vm.startPrank(owner);
        uint256 marketId = compounder.addMarket("Test Market", 1e18, 1000);
        vm.stopPrank();

        // Alice deposits
        vm.startPrank(alice);
        compounder.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Warp 10 seconds
        vm.warp(block.timestamp + 10);

        // Calculate expected fee
        uint256 expectedFee = compounder.calculateCompoundFee(10e18, 1000);
        assertEq(expectedFee, 1e18);

        uint256 depositBefore = compounder.userPositions(marketId, alice).depositAmount;

        // Alice compounds
        vm.prank(alice);
        uint256 netAmount = compounder.compound(marketId, alice);

        assertEq(netAmount, 9e18);
        assertEq(compounder.userPositions(marketId, alice).depositAmount, depositBefore + 9e18);

        // Double compound should revert
        vm.prank(alice);
        vm.expectRevert(MarketCompound.NoYieldToCompound.selector);
        compounder.compound(marketId, alice);
    }

    // ── History Tracking & Queries Tests ────────────────────────────────────────
    function test_CompoundHistoryTracking() public {
        vm.startPrank(owner);
        uint256 marketId = compounder.addMarket("Test Market", 1e18, 1000);
        vm.stopPrank();

        // Alice deposits
        vm.startPrank(alice);
        compounder.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Alice compounds
        vm.prank(alice);
        compounder.compound(marketId, alice);

        // Bob deposits
        vm.startPrank(bob);
        compounder.deposit(marketId, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Bob compounds
        vm.prank(bob);
        compounder.compound(marketId, bob);

        // Verify history queries
        assertEq(compounder.getCompoundHistoryCount(), 2);

        MarketCompound.CompoundRecord memory record1 = compounder.getCompoundHistoryRecord(0);
        assertEq(record1.user, alice);

        MarketCompound.CompoundRecord memory record2 = compounder.getCompoundHistoryRecord(1);
        assertEq(record2.user, bob);

        // Get user-specific compound history
        MarketCompound.CompoundRecord[] memory aliceHistory = compounder.getCompoundHistory(marketId, alice);
        assertEq(aliceHistory.length, 1);
        assertEq(aliceHistory[0].user, alice);

        MarketCompound.CompoundRecord[] memory bobHistory = compounder.getCompoundHistory(marketId, bob);
        assertEq(bobHistory.length, 1);
        assertEq(bobHistory[0].user, bob);
    }

    function test_GetActiveMarketsCount() public {
        vm.startPrank(owner);
        compounder.addMarket("Market 1", 1e18, 500);
        compounder.addMarket("Market 2", 2e18, 500);
        uint256 market3 = compounder.addMarket("Market 3", 3e18, 500);

        assertEq(compounder.getActiveMarketsCount(), 3);

        // Deactivate market 3
        compounder.updateMarket(market3, 3e18, 500, false);
        assertEq(compounder.getActiveMarketsCount(), 2);
        vm.stopPrank();
    }

    function test_CompoundMultiple() public {
        vm.startPrank(owner);
        uint256 marketId1 = compounder.addMarket("Market 1", 1e18, 500);
        uint256 marketId2 = compounder.addMarket("Market 2", 1e18, 500);
        vm.stopPrank();

        // Alice deposits in both markets
        vm.startPrank(alice);
        compounder.deposit(marketId1, 1000e18);
        compounder.deposit(marketId2, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Alice compounds from both markets
        uint256[] memory marketIds = new uint256[](2);
        marketIds[0] = marketId1;
        marketIds[1] = marketId2;

        vm.prank(alice);
        uint256[] memory netAmounts = compounder.compoundMultiple(marketIds, alice);

        // Each market should have yield compounded
        assertGt(netAmounts[0], 0);
        assertGt(netAmounts[1], 0);
    }
}