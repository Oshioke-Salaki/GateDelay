// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/contracts/CompoundInterval.sol";

contract CompoundIntervalTest is Test {
    CompoundInterval public compoundInterval;

    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        compoundInterval = new CompoundInterval();
        vm.stopPrank();
    }

    // ── Deployment & Initialization Tests ──────────────────────────────────────
    function test_Initialization() public {
        assertEq(compoundInterval.owner(), owner);
        assertEq(compoundInterval.intervalCount(), 0);
    }

    // ── Interval Management Tests ──────────────────────────────────────────────
    function test_AddInterval() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        vm.stopPrank();

        assertEq(intervalId, 1);

        (
            uint256 id,
            string memory name,
            uint256 seconds,
            uint256 minYield,
            bool isActive
        ) = compoundInterval.intervals(1);

        assertEq(id, 1);
        assertEq(name, "Hourly");
        assertEq(seconds, 3600);
        assertEq(minYield, 1e18);
        assertTrue(isActive);
    }

    function test_AddDifferentIntervals() public {
        vm.startPrank(owner);
        uint256 hourly = compoundInterval.addInterval("Hourly", 3600, 1e18);
        uint256 daily = compoundInterval.addInterval("Daily", 86400, 10e18);
        uint256 weekly = compoundInterval.addInterval("Weekly", 604800, 100e18);
        vm.stopPrank();

        assertEq(hourly, 1);
        assertEq(daily, 2);
        assertEq(weekly, 3);

        assertEq(compoundInterval.intervals(1).intervalSeconds, 3600);
        assertEq(compoundInterval.intervals(2).intervalSeconds, 86400);
        assertEq(compoundInterval.intervals(3).intervalSeconds, 604800);
    }

    function test_UpdateInterval() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.updateInterval(intervalId, 7200, 2e18, false);
        vm.stopPrank();

        (
            ,,
            uint256 seconds,
            uint256 minYield,
            bool active
        ) = compoundInterval.intervals(intervalId);

        assertEq(seconds, 7200);
        assertEq(minYield, 2e18);
        assertFalse(active);
    }

    // ── Scheduling Tests ─────────────────────────────────────────────────────────
    function test_SchedulePosition() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        vm.stopPrank();

        assertEq(compoundInterval.getNextCompoundTime(intervalId, alice), block.timestamp + 3600);
        assertEq(compoundInterval.positions(intervalId, alice).totalCompounds, 0);
    }

    function test_CustomSchedule() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        compoundInterval.setCustomSchedule(intervalId, alice, 1800, 5e18);
        vm.stopPrank();

        assertTrue(compoundInterval.hasCustomSchedule(intervalId, alice));

        (uint256 customSeconds, uint256 maxYield) = compoundInterval.getCustomSchedule(
            intervalId,
            alice
        );
        assertEq(customSeconds, 1800);
        assertEq(maxYield, 5e18);
    }

    function test_RemoveCustomSchedule() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        compoundInterval.setCustomSchedule(intervalId, alice, 1800, 5e18);
        compoundInterval.removeCustomSchedule(intervalId, alice);
        vm.stopPrank();

        assertFalse(compoundInterval.hasCustomSchedule(intervalId, alice));
    }

    // ── Interval Eligibility Tests ─────────────────────────────────────────────
    function test_CheckEligibility() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        vm.stopPrank();

        // Not yet eligible (just scheduled)
        assertFalse(compoundInterval.checkIntervalEligibility(intervalId, alice));

        // Not eligible yet (time hasn't passed)
        assertFalse(compoundInterval.checkIntervalEligibility(intervalId, alice));

        // Advance time past interval
        vm.warp(block.timestamp + 3601);

        // Now eligible
        assertTrue(compoundInterval.checkIntervalEligibility(intervalId, alice));
    }

    // ── Compound Execution Tests ─────────────────────────────────────────────────
    function test_ExecuteCompound() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 3601);

        // Execute compound
        uint256 netAmount = compoundInterval.executeCompound(intervalId, alice, 10e18, 1e18);

        assertEq(netAmount, 9e18);
        assertEq(compoundInterval.positions(intervalId, alice).totalCompounds, 1);
    }

    // ── History Tracking Tests ───────────────────────────────────────────────────
    function test_CompoundHistory() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        vm.stopPrank();

        // Advance and execute compound
        vm.warp(block.timestamp + 3601);
        compoundInterval.executeCompound(intervalId, alice, 10e18, 1e18);

        // Check history
        assertEq(compoundInterval.getIntervalHistoryCount(), 1);

        CompoundInterval.IntervalRecord memory record = compoundInterval.getIntervalRecord(0);
        assertEq(record.user, alice);
        assertEq(record.yieldAmount, 10e18);
        assertEq(record.feeAmount, 1e18);
        assertEq(record.netAmount, 9e18);

        // Second compound
        vm.warp(block.timestamp + 3601);
        compoundInterval.executeCompound(intervalId, alice, 20e18, 2e18);

        assertEq(compoundInterval.getIntervalHistoryCount(), 2);

        CompoundInterval.IntervalRecord[] memory userHistory = compoundInterval.getIntervalHistory(
            intervalId,
            alice
        );
        assertEq(userHistory.length, 2);
    }

    // ── Time Query Tests ─────────────────────────────────────────────────────────
    function test_TimeQueries() public {
        vm.startPrank(owner);
        uint256 intervalId = compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.schedulePosition(intervalId, alice);
        vm.stopPrank();

        uint256 timeUntil = compoundInterval.getTimeUntilNextCompound(intervalId, alice);
        assertEq(timeUntil, 3600);

        // Advance time
        vm.warp(block.timestamp + 1800);
        timeUntil = compoundInterval.getTimeUntilNextCompound(intervalId, alice);
        assertEq(timeUntil, 1800);
    }

    // ── Active Intervals Query ─────────────────────────────────────────────────────
    function test_GetActiveIntervals() public {
        vm.startPrank(owner);
        compoundInterval.addInterval("Hourly", 3600, 1e18);
        compoundInterval.addInterval("Daily", 86400, 10e18);
        uint256 weekly = compoundInterval.addInterval("Weekly", 604800, 100e18);
        vm.stopPrank();

        CompoundInterval.CompoundIntervalConfig[] memory active = compoundInterval.getActiveIntervals();
        assertEq(active.length, 3);

        // Deactivate one
        vm.startPrank(owner);
        compoundInterval.updateInterval(weekly, 604800, 100e18, false);
        vm.stopPrank();

        active = compoundInterval.getActiveIntervals();
        assertEq(active.length, 2);
    }
}