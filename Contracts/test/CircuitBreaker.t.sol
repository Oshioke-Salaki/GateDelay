// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CircuitBreaker} from "../contracts/CircuitBreaker.sol";

contract CircuitBreakerTest is Test {
    CircuitBreaker breaker;

    // Actors
    address owner = makeAddr("owner");
    address guardian = makeAddr("guardian");
    address user = makeAddr("user");
    address caller = makeAddr("caller");

    // Mock operation id
    bytes32 constant OP_SWAP = keccak256("OP_SWAP");
    bytes32 constant OP_BRIDGE = keccak256("OP_BRIDGE");

    // Config parameters
    uint256 constant FAIL_THRESHOLD = 3;
    uint256 constant RECOVERY_DELAY = 3600; // 1 hour
    uint256 constant SUCCESS_THRESHOLD = 2;

    event GuardianSet(address indexed account, bool indexed isGuardian);
    event OperationRegistered(
        bytes32 indexed operationId,
        uint256 failureThreshold,
        uint256 recoveryDelay,
        uint256 successThreshold
    );
    event CircuitTripped(bytes32 indexed operationId, address indexed triggerer, string reason);
    event CircuitHalfOpened(bytes32 indexed operationId);
    event CircuitReset(bytes32 indexed operationId, address indexed recoverer);
    event ExecutionRecorded(bytes32 indexed operationId, bool success);

    function setUp() public {
        vm.warp(1000); // Start at a known timestamp to avoid edge cases
        vm.prank(owner);
        breaker = new CircuitBreaker();
    }

    // ──── Admin / Registration Tests ──────────────────────────────────────────────

    function test_registerOperation_success() public {
        vm.expectEmit(true, true, true, true);
        emit OperationRegistered(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        vm.prank(owner);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        (CircuitBreaker.OperationConfig memory config, CircuitBreaker.OperationStatus memory status, CircuitBreaker.State state) =
            breaker.getOperation(OP_SWAP);

        assertEq(config.failureThreshold, FAIL_THRESHOLD);
        assertEq(config.recoveryDelay, RECOVERY_DELAY);
        assertEq(config.successThreshold, SUCCESS_THRESHOLD);
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.Closed));
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));
    }

    function test_registerOperation_revertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);
    }

    function test_registerOperation_revertsIfZeroId() public {
        vm.prank(owner);
        vm.expectRevert(CircuitBreaker.InvalidConfiguration.selector);
        breaker.registerOperation(bytes32(0), FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);
    }

    function test_registerOperation_revertsIfZeroParameters() public {
        vm.startPrank(owner);

        vm.expectRevert(CircuitBreaker.InvalidConfiguration.selector);
        breaker.registerOperation(OP_SWAP, 0, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        vm.expectRevert(CircuitBreaker.InvalidConfiguration.selector);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, 0, SUCCESS_THRESHOLD);

        vm.expectRevert(CircuitBreaker.InvalidConfiguration.selector);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, 0);

        vm.stopPrank();
    }

    function test_registerOperation_revertsIfAlreadyRegistered() public {
        vm.startPrank(owner);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        vm.expectRevert(CircuitBreaker.OperationAlreadyRegistered.selector);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);
        vm.stopPrank();
    }

    function test_updateOperationConfig_success() public {
        vm.startPrank(owner);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        uint256 newFail = 5;
        uint256 newDelay = 1800;
        uint256 newSuccess = 3;

        vm.expectEmit(true, true, true, true);
        emit OperationRegistered(OP_SWAP, newFail, newDelay, newSuccess);

        breaker.updateOperationConfig(OP_SWAP, newFail, newDelay, newSuccess);
        vm.stopPrank();

        (CircuitBreaker.OperationConfig memory config, , ) = breaker.getOperation(OP_SWAP);
        assertEq(config.failureThreshold, newFail);
        assertEq(config.recoveryDelay, newDelay);
        assertEq(config.successThreshold, newSuccess);
    }

    function test_updateOperationConfig_revertsIfNotRegistered() public {
        vm.prank(owner);
        vm.expectRevert(CircuitBreaker.OperationNotRegistered.selector);
        breaker.updateOperationConfig(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);
    }

    function test_updateOperationConfig_revertsIfInvalidParameters() public {
        vm.startPrank(owner);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);

        vm.expectRevert(CircuitBreaker.InvalidConfiguration.selector);
        breaker.updateOperationConfig(OP_SWAP, 0, RECOVERY_DELAY, SUCCESS_THRESHOLD);
        vm.stopPrank();
    }

    // ──── Guardian Management Tests ──────────────────────────────────────────────

    function test_setGuardian_success() public {
        vm.expectEmit(true, true, true, true);
        emit GuardianSet(guardian, true);

        vm.prank(owner);
        breaker.setGuardian(guardian, true);

        assertTrue(breaker.isGuardian(guardian));
    }

    function test_setGuardian_revertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        breaker.setGuardian(guardian, true);
    }

    function test_setGuardian_revertsForZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(CircuitBreaker.ZeroAddress.selector);
        breaker.setGuardian(address(0), true);
    }

    // ──── Manual Trip & Reset Tests ──────────────────────────────────────────────

    function test_manualTrip_successAsGuardian() public {
        _registerSwap();

        vm.prank(owner);
        breaker.setGuardian(guardian, true);

        vm.expectEmit(true, true, true, true);
        emit CircuitTripped(OP_SWAP, guardian, "Testing manual trip");

        vm.prank(guardian);
        breaker.trip(OP_SWAP, "Testing manual trip");

        ( , CircuitBreaker.OperationStatus memory status, CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.Open));
        assertEq(uint8(state), uint8(CircuitBreaker.State.Open));
        assertEq(status.lastFailureTimestamp, block.timestamp);
    }

    function test_manualTrip_successAsOwnerImplicitly() public {
        _registerSwap();

        vm.prank(owner);
        breaker.trip(OP_SWAP, "Owner trip");

        ( , , CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(state), uint8(CircuitBreaker.State.Open));
    }

    function test_manualTrip_revertsForNonGuardian() public {
        _registerSwap();

        vm.prank(user);
        vm.expectRevert(CircuitBreaker.NotGuardian.selector);
        breaker.trip(OP_SWAP, "Malicious attempt");
    }

    function test_manualTrip_revertsIfNotRegistered() public {
        vm.prank(owner);
        vm.expectRevert(CircuitBreaker.OperationNotRegistered.selector);
        breaker.trip(OP_SWAP, "No registration");
    }

    function test_manualReset_success() public {
        _registerSwap();

        // Trip first
        vm.prank(owner);
        breaker.trip(OP_SWAP, "Initial trip");

        vm.prank(owner);
        breaker.setGuardian(guardian, true);

        vm.expectEmit(true, true, true, true);
        emit CircuitReset(OP_SWAP, guardian);

        vm.prank(guardian);
        breaker.reset(OP_SWAP);

        ( , , CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));
    }

    function test_manualReset_revertsForNonGuardian() public {
        _registerSwap();

        vm.prank(owner);
        breaker.trip(OP_SWAP, "Trip");

        vm.prank(user);
        vm.expectRevert(CircuitBreaker.NotGuardian.selector);
        breaker.reset(OP_SWAP);
    }

    // ──── Automatic Trip Tests ───────────────────────────────────────────

    function test_automaticTrip_consecutiveFailures() public {
        _registerSwap();

        // 1st failure
        vm.expectEmit(true, true, true, true);
        emit ExecutionRecorded(OP_SWAP, false);
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false);

        ( , CircuitBreaker.OperationStatus memory status, CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(status.consecutiveFailures, 1);
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));

        // 2nd failure
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false);
        ( , status, state) = breaker.getOperation(OP_SWAP);
        assertEq(status.consecutiveFailures, 2);
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));

        // Success resets the consecutive counter!
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, true);
        ( , status, state) = breaker.getOperation(OP_SWAP);
        assertEq(status.consecutiveFailures, 0);
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));

        // Fail three times consecutively now
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false); // 1
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false); // 2

        vm.expectEmit(true, true, true, true);
        emit CircuitTripped(OP_SWAP, address(breaker), "Consecutive failures exceeded threshold");

        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false); // 3 -> Trip!

        ( , status, state) = breaker.getOperation(OP_SWAP);
        assertEq(status.consecutiveFailures, 0); // resets counter on trip
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.Open));
        assertEq(uint8(state), uint8(CircuitBreaker.State.Open));
        assertEq(status.lastFailureTimestamp, block.timestamp);
    }

    function test_recordExecution_revertsWhenOpen() public {
        _registerSwap();

        // Trip the circuit
        vm.prank(owner);
        breaker.trip(OP_SWAP, "Break");

        // Attempting to record execution when open should revert
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(CircuitBreaker.CircuitOpen.selector, OP_SWAP));
        breaker.recordExecution(OP_SWAP, true);
    }

    // ──── Recovery Tests (HalfOpen) ──────────────────────────────────────────────

    function test_recovery_autoTransitionToHalfOpen() public {
        _registerSwap();

        vm.prank(owner);
        breaker.trip(OP_SWAP, "Manual Trip");

        // Travel forward in time but not enough
        vm.warp(block.timestamp + RECOVERY_DELAY - 1);
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.Open));

        // Travel to the exact recovery delay mark
        vm.warp(block.timestamp + 1);
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.HalfOpen));
    }

    function test_recovery_halfOpenSuccessToClosed() public {
        _registerSwap();

        vm.prank(owner);
        breaker.trip(OP_SWAP, "Trip");

        // Travel forward past the recovery delay
        vm.warp(block.timestamp + RECOVERY_DELAY);

        // State is view-computed as HalfOpen
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.HalfOpen));

        // First success in HalfOpen
        vm.expectEmit(true, true, true, true);
        emit CircuitHalfOpened(OP_SWAP);

        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, true);

        ( , CircuitBreaker.OperationStatus memory status, CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.HalfOpen));
        assertEq(uint8(state), uint8(CircuitBreaker.State.HalfOpen));
        assertEq(status.consecutiveSuccesses, 1);

        // Second success in HalfOpen -> transitions to Closed!
        vm.expectEmit(true, true, true, true);
        emit CircuitReset(OP_SWAP, caller);

        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, true);

        ( , status, state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.Closed));
        assertEq(uint8(state), uint8(CircuitBreaker.State.Closed));
        assertEq(status.consecutiveSuccesses, 0);
        assertEq(status.consecutiveFailures, 0);
    }

    function test_recovery_halfOpenFailureToOpen() public {
        _registerSwap();

        // Record the trip timestamp explicitly
        uint256 tripTime = block.timestamp;
        vm.prank(owner);
        breaker.trip(OP_SWAP, "Trip");

        // Move to HalfOpen window
        vm.warp(tripTime + RECOVERY_DELAY);
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.HalfOpen));

        // First success in HalfOpen
        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, true);

        // Advance a bit then fail -> should trip back to Open
        uint256 failTime = tripTime + RECOVERY_DELAY + 100;
        vm.warp(failTime);

        vm.expectEmit(true, true, true, true);
        emit CircuitTripped(OP_SWAP, caller, "Execution failure in HalfOpen state");

        vm.prank(caller);
        breaker.recordExecution(OP_SWAP, false);

        // Verify state is Open and failure timestamp is updated
        ( , CircuitBreaker.OperationStatus memory status, CircuitBreaker.State state) = breaker.getOperation(OP_SWAP);
        assertEq(uint8(status.state), uint8(CircuitBreaker.State.Open));
        assertEq(uint8(state), uint8(CircuitBreaker.State.Open));
        assertEq(status.consecutiveSuccesses, 0);
        assertEq(status.lastFailureTimestamp, failTime);

        // Verify still Open well before the new recovery delay elapses
        vm.warp(failTime + RECOVERY_DELAY / 2);
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.Open));

        // Verify transitions to HalfOpen after full new recovery delay
        vm.warp(failTime + RECOVERY_DELAY);
        assertEq(uint8(breaker.getCircuitState(OP_SWAP)), uint8(CircuitBreaker.State.HalfOpen));
    }

    // ──── Helper Methods ─────────────────────────────────────────────────────────

    function _registerSwap() internal {
        vm.prank(owner);
        breaker.registerOperation(OP_SWAP, FAIL_THRESHOLD, RECOVERY_DELAY, SUCCESS_THRESHOLD);
    }
}
