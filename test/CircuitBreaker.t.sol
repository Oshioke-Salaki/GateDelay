// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CircuitBreaker.sol";

contract CircuitBreakerTest is Test {
    CircuitBreaker circuitBreaker;

    address admin = address(0x1);
    address breaker = address(0x2);
    address monitor = address(0x3);
    address user = address(0x4);

    function setUp() public {
        vm.prank(admin);
        circuitBreaker = new CircuitBreaker();

        vm.prank(admin);
        circuitBreaker.grantBreakerRole(breaker);

        vm.prank(admin);
        circuitBreaker.grantMonitorRole(monitor);
    }

    // ========== Health Monitoring Tests ==========

    function test_RecordSuccessIncrementsCounter() public {
        vm.prank(monitor);
        circuitBreaker.recordSuccess();

        (
            CircuitBreaker.State state,
            uint256 failures,
            uint256 successes,
            ,
            ,

        ) = circuitBreaker.getStatus();

        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
        assertEq(successes, 1);
        assertEq(failures, 0);
    }

    function test_RecordFailureIncrementsCounter() public {
        vm.prank(monitor);
        circuitBreaker.recordFailure("Test failure");

        (
            CircuitBreaker.State state,
            uint256 failures,
            uint256 successes,
            ,
            ,

        ) = circuitBreaker.getStatus();

        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
        assertEq(failures, 1);
        assertEq(successes, 0);
    }

    function test_MultipleSuccessesRecorded() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(monitor);
            circuitBreaker.recordSuccess();
        }

        (
            ,
            uint256 failures,
            uint256 successes,
            uint256 total,
            uint256 health,

        ) = circuitBreaker.getStatus();

        assertEq(successes, 5);
        assertEq(failures, 0);
        assertEq(total, 5);
        assertEq(health, 100);
    }

    function test_HealthPercentageCalculated() public {
        // 3 successes, 2 failures = 60% health
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(monitor);
            circuitBreaker.recordSuccess();
        }

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Test failure");
        }

        (
            ,
            uint256 failures,
            uint256 successes,
            uint256 total,
            uint256 health,

        ) = circuitBreaker.getStatus();

        assertEq(successes, 3);
        assertEq(failures, 2);
        assertEq(total, 5);
        assertEq(health, 60);
    }

    function test_OnlyMonitorCanRecordSuccess() public {
        vm.prank(user);
        vm.expectRevert("CircuitBreaker: caller cannot record health");
        circuitBreaker.recordSuccess();
    }

    function test_OnlyMonitorCanRecordFailure() public {
        vm.prank(user);
        vm.expectRevert("CircuitBreaker: caller cannot record health");
        circuitBreaker.recordFailure("Test failure");
    }

    // ========== Break Triggering Tests ==========

    function test_BreakTriggeredOnFailureThreshold() public {
        vm.prank(admin);
        circuitBreaker.setFailureThreshold(3);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Test failure");
        }

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
    }

    function test_ManualTriggerBreak() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Manual trigger");

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
    }

    function test_CannotTriggerBreakWhenAlreadyOpen() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("First trigger");

        vm.prank(breaker);
        vm.expectRevert("CircuitBreaker: already open");
        circuitBreaker.triggerBreak("Second trigger");
    }

    function test_OnlyBreakerCanTrigger() public {
        vm.prank(user);
        vm.expectRevert("CircuitBreaker: caller cannot trigger breaks");
        circuitBreaker.triggerBreak("Unauthorized");
    }

    function test_BreakTriggeredOnFailureRate() public {
        vm.prank(admin);
        circuitBreaker.setFailureRateThreshold(50);

        // Record 3 successes and 3 failures = 50% failure rate
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(monitor);
            circuitBreaker.recordSuccess();
        }

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Test failure");
        }

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
    }

    // ========== Recovery Tests ==========

    function test_AttemptRecoveryTransitionsToHalfOpen() public {
        // Trigger break
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        // Warp time past recovery timeout
        vm.warp(block.timestamp + 1 hours + 1);

        // Attempt recovery
        vm.prank(breaker);
        circuitBreaker.attemptRecovery();

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.HalfOpen));
    }

    function test_CannotRecoverBeforeTimeout() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        vm.prank(breaker);
        vm.expectRevert("CircuitBreaker: recovery timeout not reached");
        circuitBreaker.attemptRecovery();
    }

    function test_SuccessInHalfOpenClosesCircuit() public {
        // Trigger break and attempt recovery
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(breaker);
        circuitBreaker.attemptRecovery();

        // Record success in half-open state
        vm.prank(monitor);
        circuitBreaker.recordSuccess();

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
    }

    function test_RecordingStopsWhenOpenWithoutAttemptingRecovery() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        uint256 failureCountBefore = 5;
        for (uint256 i = 0; i < failureCountBefore; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Should be ignored");
        }

        (
            ,
            uint256 failures,
            ,
            ,
            ,

        ) = circuitBreaker.getStatus();

        // Failures should still be at breakTriggered count, not incremented
        assertEq(failures, 0);
    }

    function test_ResetMetricsClosesCircuit() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        vm.prank(admin);
        circuitBreaker.resetMetrics();

        (
            CircuitBreaker.State state,
            uint256 failures,
            uint256 successes,
            ,
            ,

        ) = circuitBreaker.getStatus();

        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
        assertEq(failures, 0);
        assertEq(successes, 0);
    }

    // ========== Permission Control Tests ==========

    function test_GrantBreakerRole() public {
        address newBreaker = address(0x5);

        vm.prank(admin);
        circuitBreaker.grantBreakerRole(newBreaker);

        vm.prank(newBreaker);
        circuitBreaker.triggerBreak("New breaker can trigger");

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
    }

    function test_RevokeBreakerRole() public {
        vm.prank(admin);
        circuitBreaker.revokeBreakerRole(breaker);

        vm.prank(breaker);
        vm.expectRevert("CircuitBreaker: caller cannot trigger breaks");
        circuitBreaker.triggerBreak("Should fail");
    }

    function test_GrantMonitorRole() public {
        address newMonitor = address(0x5);

        vm.prank(admin);
        circuitBreaker.grantMonitorRole(newMonitor);

        vm.prank(newMonitor);
        circuitBreaker.recordSuccess();

        (
            ,
            ,
            uint256 successes,
            ,
            ,

        ) = circuitBreaker.getStatus();

        assertEq(successes, 1);
    }

    function test_RevokeMonitorRole() public {
        vm.prank(admin);
        circuitBreaker.revokeMonitorRole(monitor);

        vm.prank(monitor);
        vm.expectRevert("CircuitBreaker: caller cannot record health");
        circuitBreaker.recordSuccess();
    }

    // ========== Configuration Tests ==========

    function test_SetFailureThreshold() public {
        vm.prank(admin);
        circuitBreaker.setFailureThreshold(10);

        assertEq(circuitBreaker.failureThreshold(), 10);
    }

    function test_SetFailureRateThreshold() public {
        vm.prank(admin);
        circuitBreaker.setFailureRateThreshold(75);

        assertEq(circuitBreaker.failureRateThreshold(), 75);
    }

    function test_SetRecoveryTimeout() public {
        vm.prank(admin);
        circuitBreaker.setRecoveryTimeout(2 hours);

        assertEq(circuitBreaker.recoveryTimeout(), 2 hours);
    }

    function test_OnlyAdminCanConfigureThresholds() public {
        vm.prank(user);
        vm.expectRevert("CircuitBreaker: caller is not admin");
        circuitBreaker.setFailureThreshold(10);
    }

    function test_InvalidFailureThresholdRejected() public {
        vm.prank(admin);
        vm.expectRevert("CircuitBreaker: threshold must be positive");
        circuitBreaker.setFailureThreshold(0);
    }

    function test_InvalidRateThresholdRejected() public {
        vm.prank(admin);
        vm.expectRevert("CircuitBreaker: rate must be between 0 and 100");
        circuitBreaker.setFailureRateThreshold(101);
    }

    // ========== Status Reporting Tests ==========

    function test_GetStatusReturnsAllMetrics() public {
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(monitor);
            circuitBreaker.recordSuccess();
        }

        for (uint256 i = 0; i < 1; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Test failure");
        }

        (
            CircuitBreaker.State state,
            uint256 failures,
            uint256 successes,
            uint256 total,
            uint256 health,
            bool isHealthy

        ) = circuitBreaker.getStatus();

        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
        assertEq(failures, 1);
        assertEq(successes, 4);
        assertEq(total, 5);
        assertEq(health, 80);
        assertTrue(isHealthy);
    }

    function test_GetRecoveryInfo() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Initial break");

        vm.warp(block.timestamp + 30 minutes);

        (
            CircuitBreaker.State state,
            uint256 timeSinceBreak,
            uint256 timeUntilRecoveryAttempt,
            bool recoveryReady

        ) = circuitBreaker.getRecoveryInfo();

        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
        assertEq(timeSinceBreak, 30 minutes);
        assertEq(timeUntilRecoveryAttempt, 30 minutes);
        assertFalse(recoveryReady);
    }

    function test_GetFailureMetrics() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(monitor);
            circuitBreaker.recordSuccess();
        }

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("Test failure");
        }

        (
            uint256 totalFailures,
            uint256 failureRate,
            uint256 lastFailure,
            uint256 lastSuccess

        ) = circuitBreaker.getFailureMetrics();

        assertEq(totalFailures, 2);
        assertEq(failureRate, 40);
        assertTrue(lastFailure > 0);
        assertTrue(lastSuccess > 0);
    }

    function test_IsCircuitOpenQuery() public {
        assertFalse(circuitBreaker.isCircuitOpen());

        vm.prank(breaker);
        circuitBreaker.triggerBreak("Break");

        assertTrue(circuitBreaker.isCircuitOpen());
    }

    function test_IsCircuitHalfOpenQuery() public {
        assertFalse(circuitBreaker.isCircuitHalfOpen());

        vm.prank(breaker);
        circuitBreaker.triggerBreak("Break");

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(breaker);
        circuitBreaker.attemptRecovery();

        assertTrue(circuitBreaker.isCircuitHalfOpen());
    }

    function test_IsCircuitClosedQuery() public {
        assertTrue(circuitBreaker.isCircuitClosed());

        vm.prank(breaker);
        circuitBreaker.triggerBreak("Break");

        assertFalse(circuitBreaker.isCircuitClosed());
    }

    // ========== State Transition Tests ==========

    function test_StateTransitionClosedToOpen() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Test break");

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Open));
    }

    function test_StateTransitionOpenToHalfOpen() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Test break");

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(breaker);
        circuitBreaker.attemptRecovery();

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.HalfOpen));
    }

    function test_StateTransitionHalfOpenToClosed() public {
        vm.prank(breaker);
        circuitBreaker.triggerBreak("Test break");

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(breaker);
        circuitBreaker.attemptRecovery();

        vm.prank(monitor);
        circuitBreaker.recordSuccess();

        (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
        assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
    }

    // ========== Edge Cases ==========

    function test_EmptyStatusReturnsHealthyDefault() public {
        (
            ,
            uint256 failures,
            uint256 successes,
            uint256 total,
            uint256 health,
            bool isHealthy

        ) = circuitBreaker.getStatus();

        assertEq(failures, 0);
        assertEq(successes, 0);
        assertEq(total, 0);
        assertEq(health, 100);
        assertTrue(isHealthy);
    }

    function test_CanRecoverMultipleTimes() public {
        for (uint256 cycle = 0; cycle < 3; cycle++) {
            // Trigger break
            vm.prank(breaker);
            circuitBreaker.triggerBreak("Break cycle");

            // Wait for recovery
            vm.warp(block.timestamp + 1 hours + 1);

            // Attempt recovery
            vm.prank(breaker);
            circuitBreaker.attemptRecovery();

            // Record success to close
            vm.prank(monitor);
            circuitBreaker.recordSuccess();

            // Verify closed
            (CircuitBreaker.State state, , , , , ) = circuitBreaker.getStatus();
            assertEq(uint256(state), uint256(CircuitBreaker.State.Closed));
        }
    }
}
