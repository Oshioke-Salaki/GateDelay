// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/WithdrawalLimit.sol";

contract WithdrawalLimitTest is Test {
    WithdrawalLimit limits;

    address owner = address(0xA11CE);
    address enforcer = address(0xBEEF);
    address user1 = address(0xCAFE);
    address user2 = address(0xD00D);
    address tokenA = address(0xAAAA);
    address tokenB = address(0xBBBB);

    function setUp() public {
        limits = new WithdrawalLimit(owner);
        vm.prank(owner);
        limits.addEnforcer(enforcer);
    }

    // ------- enforcer registry -------

    function test_OwnerAddRemoveEnforcer() public {
        address e = address(0xE11);
        vm.prank(owner);
        limits.addEnforcer(e);
        assertTrue(limits.isEnforcer(e));

        vm.prank(owner);
        limits.removeEnforcer(e);
        assertFalse(limits.isEnforcer(e));
    }

    function test_NonOwnerCannotAddEnforcer() public {
        vm.prank(user1);
        vm.expectRevert();
        limits.addEnforcer(address(0xE11));
    }

    function test_CannotAddZeroEnforcer() public {
        vm.prank(owner);
        vm.expectRevert(WithdrawalLimit.ZeroAddress.selector);
        limits.addEnforcer(address(0));
    }

    function test_CannotAddDuplicateEnforcer() public {
        vm.prank(owner);
        vm.expectRevert(WithdrawalLimit.AlreadyEnforcer.selector);
        limits.addEnforcer(enforcer);
    }

    // ------- limit configuration -------

    function test_SetDefaultLimit() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 1_000 ether, 250 ether, 0);

        WithdrawalLimit.Limit memory lim = limits.getDefaultLimit(tokenA);
        assertTrue(lim.set);
        assertEq(lim.windowAmount, 1_000 ether);
        assertEq(lim.perTxCap, 250 ether);
        assertEq(lim.windowSeconds, limits.DEFAULT_WINDOW());
    }

    function test_SetDefaultLimitRespectsCustomWindow() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 0, 3600);
        assertEq(limits.getDefaultLimit(tokenA).windowSeconds, 3600);
    }

    function test_SetUserLimitOverridesDefault() public {
        vm.startPrank(owner);
        limits.setDefaultLimit(tokenA, 1_000, 0, 0);
        limits.setUserLimit(user1, tokenA, 500, 0, 0);
        vm.stopPrank();

        WithdrawalLimit.Limit memory eff = limits.effectiveLimit(user1, tokenA);
        assertEq(eff.windowAmount, 500);

        WithdrawalLimit.Limit memory other = limits.effectiveLimit(user2, tokenA);
        assertEq(other.windowAmount, 1_000);
    }

    function test_ClearUserLimitFallsBackToDefault() public {
        vm.startPrank(owner);
        limits.setDefaultLimit(tokenA, 1_000, 0, 0);
        limits.setUserLimit(user1, tokenA, 500, 0, 0);
        limits.clearUserLimit(user1, tokenA);
        vm.stopPrank();

        assertEq(limits.effectiveLimit(user1, tokenA).windowAmount, 1_000);
    }

    function test_NonOwnerCannotConfigure() public {
        vm.prank(user1);
        vm.expectRevert();
        limits.setDefaultLimit(tokenA, 1, 0, 0);
    }

    // ------- enforcement -------

    function test_RecordWithinLimitSucceeds() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100 ether, 0, 0);

        vm.prank(enforcer);
        limits.record(user1, tokenA, 60 ether);

        (uint256 used, uint256 rem, , ) = limits.getUsage(user1, tokenA);
        assertEq(used, 60 ether);
        assertEq(rem, 40 ether);
    }

    function test_RecordExceedingWindowReverts() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100 ether, 0, 0);

        vm.prank(enforcer);
        limits.record(user1, tokenA, 80 ether);

        vm.prank(enforcer);
        vm.expectRevert(abi.encodeWithSelector(WithdrawalLimit.LimitExceeded.selector, 30 ether, 20 ether));
        limits.record(user1, tokenA, 30 ether);
    }

    function test_PerTxCapEnforced() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 1_000 ether, 100 ether, 0);

        vm.prank(enforcer);
        vm.expectRevert(abi.encodeWithSelector(WithdrawalLimit.PerTxCapExceeded.selector, 150 ether, 100 ether));
        limits.record(user1, tokenA, 150 ether);
    }

    function test_NoLimitConfiguredAllowsAnyAmount() public {
        vm.prank(enforcer);
        limits.record(user1, tokenA, type(uint128).max);
        // no revert means pass
        (uint256 used, , , ) = limits.getUsage(user1, tokenA);
        assertEq(used, 0); // no window configured -> not tracked toward a budget
    }

    function test_NonEnforcerCannotRecord() public {
        vm.prank(user2);
        vm.expectRevert(WithdrawalLimit.NotEnforcer.selector);
        limits.record(user1, tokenA, 1);
    }

    function test_OwnerCanRecordWithoutBeingEnforcer() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 0, 0);
        vm.prank(owner);
        limits.record(user1, tokenA, 10);

        (uint256 used, , , ) = limits.getUsage(user1, tokenA);
        assertEq(used, 10);
    }

    // ------- window roll & resets -------

    function test_WindowRollsAfterDuration() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 0, 1 hours);

        vm.prank(enforcer);
        limits.record(user1, tokenA, 100);

        (uint256 used, uint256 rem, , uint64 windowEnd) = limits.getUsage(user1, tokenA);
        assertEq(used, 100);
        assertEq(rem, 0);

        vm.warp(uint256(windowEnd) + 1);

        // new window: should allow another 100
        vm.prank(enforcer);
        limits.record(user1, tokenA, 100);

        (used, rem, , ) = limits.getUsage(user1, tokenA);
        assertEq(used, 100);
        assertEq(rem, 0);
    }

    function test_RemainingHelper() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 50, 0, 0);

        assertEq(limits.remaining(user1, tokenA), 50);

        vm.prank(enforcer);
        limits.record(user1, tokenA, 30);
        assertEq(limits.remaining(user1, tokenA), 20);
    }

    function test_RemainingIsMaxWhenUnconfigured() public view {
        assertEq(limits.remaining(user1, tokenA), type(uint256).max);
    }

    function test_ResetUsageClears() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 0, 0);
        vm.prank(enforcer);
        limits.record(user1, tokenA, 100);

        vm.prank(owner);
        limits.resetUsage(user1, tokenA);

        (uint256 used, uint256 rem, , ) = limits.getUsage(user1, tokenA);
        assertEq(used, 0);
        assertEq(rem, 100);
    }

    // ------- check() preview -------

    function test_CheckMatchesRecord() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 80, 0);

        // within both caps
        limits.check(user1, tokenA, 50);

        // over per-tx cap
        vm.expectRevert(abi.encodeWithSelector(WithdrawalLimit.PerTxCapExceeded.selector, 90, 80));
        limits.check(user1, tokenA, 90);

        // commit some usage and re-check window enforcement
        vm.prank(enforcer);
        limits.record(user1, tokenA, 60);

        // 50 fits per-tx cap (80) but only 40 remains in the window
        vm.expectRevert(abi.encodeWithSelector(WithdrawalLimit.LimitExceeded.selector, 50, 40));
        limits.check(user1, tokenA, 50);
    }

    function test_PerTokenIsolation() public {
        vm.prank(owner);
        limits.setDefaultLimit(tokenA, 100, 0, 0);

        vm.prank(enforcer);
        limits.record(user1, tokenA, 100);

        // tokenB has no limit, should not be affected by tokenA usage
        assertEq(limits.remaining(user1, tokenB), type(uint256).max);
        vm.prank(enforcer);
        limits.record(user1, tokenB, 999);
    }
}
