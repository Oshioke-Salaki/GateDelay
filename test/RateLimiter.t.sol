// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RateLimiter.sol";

contract RateLimiterTest is Test {
    RateLimiter rateLimiter;

    address admin = address(0x1);
    address operator = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);

    bytes32 constant LIMIT_TRADES = keccak256("LIMIT_TRADES");
    bytes32 constant LIMIT_WITHDRAWALS = keccak256("LIMIT_WITHDRAWALS");

    function setUp() public {
        vm.prank(admin);
        rateLimiter = new RateLimiter();

        vm.prank(admin);
        rateLimiter._grantRole(keccak256("OPERATOR_ROLE"), operator);
    }

    // ========== Configuration Tests ==========

    function test_ConfigureRateLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        (uint256 maxOps, uint256 window, bool enabled) = rateLimiter.getRateLimitConfig(LIMIT_TRADES);
        assertEq(maxOps, 5);
        assertEq(window, 1 hours);
        assertTrue(enabled);
    }

    function test_ConfigureMultipleLimits() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_WITHDRAWALS, 10, 24 hours, true);

        (uint256 maxOps1, uint256 window1, ) = rateLimiter.getRateLimitConfig(LIMIT_TRADES);
        (uint256 maxOps2, uint256 window2, ) = rateLimiter.getRateLimitConfig(LIMIT_WITHDRAWALS);

        assertEq(maxOps1, 5);
        assertEq(window1, 1 hours);
        assertEq(maxOps2, 10);
        assertEq(window2, 24 hours);
    }

    function test_EnableRateLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, false);

        vm.prank(admin);
        rateLimiter.enableRateLimit(LIMIT_TRADES);

        (, , bool enabled) = rateLimiter.getRateLimitConfig(LIMIT_TRADES);
        assertTrue(enabled);
    }

    function test_DisableRateLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        vm.prank(admin);
        rateLimiter.disableRateLimit(LIMIT_TRADES);

        (, , bool enabled) = rateLimiter.getRateLimitConfig(LIMIT_TRADES);
        assertFalse(enabled);
    }

    function test_OnlyAdminCanConfigure() public {
        vm.prank(user1);
        vm.expectRevert("RateLimiter: caller is not admin");
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);
    }

    function test_InvalidMaxOperationsRejected() public {
        vm.prank(admin);
        vm.expectRevert("RateLimiter: maxOperations must be positive");
        rateLimiter.configureRateLimit(LIMIT_TRADES, 0, 1 hours, true);
    }

    function test_InvalidTimeWindowRejected() public {
        vm.prank(admin);
        vm.expectRevert("RateLimiter: timeWindow must be positive");
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 0, true);
    }

    // ========== Rate Limiting Tests ==========

    function test_AllowOperationWithinLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        vm.prank(operator);
        bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertTrue(allowed);
    }

    function test_AllowMultipleOperationsWithinLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(operator);
            bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
            assertTrue(allowed);
        }
    }

    function test_BlockOperationWhenLimitExceeded() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 3, 1 hours, true);

        // Record 3 operations
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        // 4th should be blocked
        vm.prank(operator);
        bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(allowed);
    }

    function test_AllowOperationWhenDisabled() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 1, 1 hours, false);

        // Should allow any number when disabled
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(operator);
            bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
            assertTrue(allowed);
        }
    }

    function test_ResetWindowAfterTimeout() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        // Use up the limit
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // Should be blocked
        vm.prank(operator);
        bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(allowed);

        // Warp past the window
        vm.warp(block.timestamp + 1 hours + 1);

        // Should be allowed again (window reset)
        vm.prank(operator);
        allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertTrue(allowed);
    }

    function test_DifferentUsersIndependentLimits() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        // User1: 2 operations
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // User1 blocked
        vm.prank(operator);
        bool allowed1 = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(allowed1);

        // User2 still allowed
        vm.prank(operator);
        bool allowed2 = rateLimiter.checkRateLimit(LIMIT_TRADES, user2);
        assertTrue(allowed2);
    }

    function test_DifferentLimitsIndependent() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);
        rateLimiter.configureRateLimit(LIMIT_WITHDRAWALS, 3, 1 hours, true);

        // Use trades limit
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // Trades blocked
        vm.prank(operator);
        bool tradesAllowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(tradesAllowed);

        // Withdrawals still allowed (separate limit)
        vm.prank(operator);
        bool withdrawalsAllowed = rateLimiter.checkRateLimit(LIMIT_WITHDRAWALS, user1);
        assertTrue(withdrawalsAllowed);
    }

    // ========== Permission Override Tests ==========

    function test_SetLimitOverride() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        vm.prank(admin);
        rateLimiter.setLimitOverride(LIMIT_TRADES, user1, true);

        assertTrue(rateLimiter.isUserExempt(LIMIT_TRADES, user1));
    }

    function test_ExemptUserBypassesLimit() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 1, 1 hours, true);

        vm.prank(admin);
        rateLimiter.setLimitOverride(LIMIT_TRADES, user1, true);

        // User should be allowed any number of operations
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(operator);
            bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
            assertTrue(allowed);
        }
    }

    function test_RemoveOverride() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 1, 1 hours, true);

        vm.prank(admin);
        rateLimiter.setLimitOverride(LIMIT_TRADES, user1, true);
        assertTrue(rateLimiter.isUserExempt(LIMIT_TRADES, user1));

        vm.prank(admin);
        rateLimiter.setLimitOverride(LIMIT_TRADES, user1, false);
        assertFalse(rateLimiter.isUserExempt(LIMIT_TRADES, user1));

        // Now limit should apply
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        bool allowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(allowed);
    }

    // ========== Status Query Tests ==========

    function test_GetOperationCount() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        uint256 count = rateLimiter.getOperationCount(LIMIT_TRADES, user1);
        assertEq(count, 3);
    }

    function test_GetOperationCountAfterWindowExpires() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        vm.warp(block.timestamp + 1 hours + 1);

        uint256 count = rateLimiter.getOperationCount(LIMIT_TRADES, user1);
        assertEq(count, 0);
    }

    function test_GetOperationStatus() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        (
            uint256 currentCount,
            uint256 maxAllowed,
            uint256 remainingOps,
            uint256 timeUntilReset,
            bool isLimited
        ) = rateLimiter.getOperationStatus(LIMIT_TRADES, user1);

        assertEq(currentCount, 2);
        assertEq(maxAllowed, 5);
        assertEq(remainingOps, 3);
        assertTrue(timeUntilReset > 0);
        assertFalse(isLimited);
    }

    function test_GetOperationStatusWhenLimited() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        (
            uint256 currentCount,
            uint256 maxAllowed,
            uint256 remainingOps,
            ,
            bool isLimited
        ) = rateLimiter.getOperationStatus(LIMIT_TRADES, user1);

        assertEq(currentCount, 2);
        assertEq(maxAllowed, 2);
        assertEq(remainingOps, 0);
        assertTrue(isLimited);
    }

    function test_GetTimeToNextWindow() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        uint256 timeToReset = rateLimiter.getTimeToNextWindow(LIMIT_TRADES, user1);
        assertApproxEqAbs(timeToReset, 1 hours, 1);
    }

    function test_IsRateLimited() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        // Not limited yet
        bool limited = rateLimiter.isRateLimited(LIMIT_TRADES, user1);
        assertFalse(limited);

        // Use up limit
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // Now limited
        limited = rateLimiter.isRateLimited(LIMIT_TRADES, user1);
        assertTrue(limited);
    }

    function test_IsRateLimitedWhenDisabled() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 1, 1 hours, false);

        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // Should not be limited even though count exceeds max (limit is disabled)
        bool limited = rateLimiter.isRateLimited(LIMIT_TRADES, user1);
        assertFalse(limited);
    }

    function test_LimitsExist() public {
        assertFalse(rateLimiter.limitsExist(LIMIT_TRADES));

        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        assertTrue(rateLimiter.limitsExist(LIMIT_TRADES));
    }

    // ========== Management Tests ==========

    function test_ResetUserLimits() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(operator);
            rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        }

        uint256 countBefore = rateLimiter.getOperationCount(LIMIT_TRADES, user1);
        assertEq(countBefore, 3);

        vm.prank(admin);
        rateLimiter.resetUserLimits(LIMIT_TRADES, user1);

        uint256 countAfter = rateLimiter.getOperationCount(LIMIT_TRADES, user1);
        assertEq(countAfter, 0);
    }

    function test_OnlyAdminCanResetUserLimits() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 5, 1 hours, true);

        vm.prank(user1);
        vm.expectRevert("RateLimiter: caller is not admin");
        rateLimiter.resetUserLimits(LIMIT_TRADES, user1);
    }

    // ========== Edge Cases ==========

    function test_RecordOperationMethod() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 3, 1 hours, true);

        vm.prank(operator);
        rateLimiter.recordOperation(LIMIT_TRADES, user1);

        uint256 count = rateLimiter.getOperationCount(LIMIT_TRADES, user1);
        assertEq(count, 1);
    }

    function test_RecordOperationRevertsWhenLimited() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 1, 1 hours, true);

        vm.prank(operator);
        rateLimiter.recordOperation(LIMIT_TRADES, user1);

        vm.prank(operator);
        vm.expectRevert("RateLimiter: rate limit exceeded");
        rateLimiter.recordOperation(LIMIT_TRADES, user1);
    }

    function test_RecordOperationIfAllowedReturnsBoolean() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);

        vm.prank(operator);
        bool allowed1 = rateLimiter.recordOperationIfAllowed(LIMIT_TRADES, user1);
        assertTrue(allowed1);

        vm.prank(operator);
        bool allowed2 = rateLimiter.recordOperationIfAllowed(LIMIT_TRADES, user1);
        assertTrue(allowed2);

        vm.prank(operator);
        bool allowed3 = rateLimiter.recordOperationIfAllowed(LIMIT_TRADES, user1);
        assertFalse(allowed3);
    }

    function test_MultipleWindowsWithDifferentTimeWindows() public {
        vm.prank(admin);
        rateLimiter.configureRateLimit(LIMIT_TRADES, 2, 1 hours, true);
        rateLimiter.configureRateLimit(LIMIT_WITHDRAWALS, 3, 24 hours, true);

        // Use up trades
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        vm.prank(operator);
        rateLimiter.checkRateLimit(LIMIT_TRADES, user1);

        // Trades blocked but withdrawals allowed
        vm.prank(operator);
        bool tradeBlocked = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertFalse(tradeBlocked);

        vm.prank(operator);
        bool withdrawalAllowed = rateLimiter.checkRateLimit(LIMIT_WITHDRAWALS, user1);
        assertTrue(withdrawalAllowed);

        // After 1 hour, trades reset but not withdrawals
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(operator);
        bool tradeAllowed = rateLimiter.checkRateLimit(LIMIT_TRADES, user1);
        assertTrue(tradeAllowed);

        vm.prank(operator);
        withdrawalAllowed = rateLimiter.checkRateLimit(LIMIT_WITHDRAWALS, user1);
        assertTrue(withdrawalAllowed);
    }
}
