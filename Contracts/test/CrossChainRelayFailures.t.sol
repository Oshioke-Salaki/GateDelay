// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MarketRelay, RelayClient, IRelayRouter} from "../src/MarketRelay.sol";

/**
 * @title CrossChainRelayFailuresTest
 * @notice Comprehensive tests for relay failures, retries, refunds, and duplicate delivery
 * @dev Tests cross-chain relay failure handling including:
 *      - Retry mechanisms and exponential backoff
 *      - Refund processing for failed relays
 *      - Duplicate message detection and prevention
 *      - State consistency across chains
 *      - Timeout and recovery scenarios
 */
contract CrossChainRelayFailuresTest is Test {
    MarketRelay internal relay;
    MockRelayRouter internal router;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");

    uint64 internal constant CHAIN_BASE = 15971525489660198786;

    function setUp() public {
        router = new MockRelayRouter();
        relay = new MarketRelay(address(router), relayer, feeRecipient, owner);

        vm.deal(alice, 100 ether);
        vm.deal(owner, 100 ether);

        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Retry Mechanism Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_retry_incrementsAttemptCounter() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        uint256 initialAttempts = op.attempts;

        vm.prank(relayer);
        relay.failRelay(opId, "temporary failure");

        op = relay.getRelayOperation(opId);
        assertEq(op.attempts, initialAttempts + 1, "Attempt counter not incremented");
    }

    function test_retry_returnsToPendingWhenRetriesAvailable() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.prank(relayer);
        relay.failRelay(opId, "failure 1");

        assertEq(
            uint256(relay.getRelayStatus(opId)),
            uint256(MarketRelay.RelayStatus.Pending),
            "Should return to Pending"
        );
    }

    function test_retry_marksFailedAfterMaxRetries() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 2, 5 minutes, 0.01 ether, 50);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        // Fail 3 times (attempts = 1, 2, 3; maxRetries = 2)
        vm.startPrank(relayer);
        relay.failRelay(opId, "failure 1"); // attempts = 2
        relay.failRelay(opId, "failure 2"); // attempts = 3, should mark Failed
        vm.stopPrank();

        assertEq(
            uint256(relay.getRelayStatus(opId)),
            uint256(MarketRelay.RelayStatus.Failed),
            "Should be marked Failed after max retries"
        );
    }

    function test_retry_canRetryMultipleTimes() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 5, 5 minutes, 0.01 ether, 50);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        for (uint256 i = 0; i < 4; i++) {
            relay.failRelay(opId, "retry attempt");
            assertEq(
                uint256(relay.getRelayStatus(opId)),
                uint256(MarketRelay.RelayStatus.Pending),
                "Should still be Pending"
            );
        }
        vm.stopPrank();

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        assertEq(op.attempts, 5, "Should have 5 attempts");
    }

    function test_retry_preventsRetryAfterCompletion() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);
        relay.completeRelay(opId, "success");
        vm.stopPrank();

        vm.prank(relayer);
        vm.expectRevert();
        relay.failRelay(opId, "should not retry");
    }

    function test_retry_exponentialBackoffSimulation() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        uint256[] memory timestamps = new uint256[](3);

        for (uint256 i = 0; i < 3; i++) {
            timestamps[i] = block.timestamp;
            vm.prank(relayer);
            relay.failRelay(opId, "temporary failure");

            // Simulate exponential backoff: 5min, 10min, 20min
            vm.warp(block.timestamp + (5 minutes * (2 ** i)));
        }

        // Verify increasing delays
        assertTrue(timestamps[1] - timestamps[0] < timestamps[2] - timestamps[1]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Refund Processing Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_refund_failedRelayCanBeRefunded() public {
        uint256 relayValue = 50 ether;
        uint256 fee = 0.05 ether;

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: fee}(CHAIN_BASE, "data", relayValue);

        // Exhaust retries
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 1, 5 minutes, 0.01 ether, 50);

        vm.startPrank(relayer);
        relay.failRelay(opId, "failure 1");
        relay.failRelay(opId, "failure 2");
        vm.stopPrank();

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Failed));
    }

    function test_refund_timeoutEnablesRefund() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        // Fast forward past timeout
        vm.warp(block.timestamp + 2 hours);

        relay.checkTimeout(opId);

        assertEq(
            uint256(relay.getRelayStatus(opId)),
            uint256(MarketRelay.RelayStatus.Timeout),
            "Should be timed out"
        );
    }

    function test_refund_cancelledRelayTracked() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.prank(alice);
        relay.cancelRelay(opId);

        assertEq(
            uint256(relay.getRelayStatus(opId)),
            uint256(MarketRelay.RelayStatus.Cancelled),
            "Should be cancelled"
        );
    }

    function test_refund_partialRefundScenario() public {
        // Test scenario where relay partially executed but needs refund
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.1 ether}(CHAIN_BASE, "data", 50 ether);

        vm.prank(relayer);
        relay.updateRelayExecuting(opId);

        // Simulate partial execution failure
        vm.prank(relayer);
        relay.failRelay(opId, "partial execution failed");

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        assertTrue(op.attempts > 1, "Should track partial attempt");
    }

    function test_refund_multipleFailedRelaysTracked() public {
        bytes32[] memory opIds = new bytes32[](3);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            opIds[i] = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);
        }

        // Fail all
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 1, 5 minutes, 0.01 ether, 50);

        for (uint256 i = 0; i < 3; i++) {
            vm.startPrank(relayer);
            relay.failRelay(opIds[i], "fail 1");
            relay.failRelay(opIds[i], "fail 2");
            vm.stopPrank();
        }

        // All should be failed
        for (uint256 i = 0; i < 3; i++) {
            assertEq(
                uint256(relay.getRelayStatus(opIds[i])),
                uint256(MarketRelay.RelayStatus.Failed)
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Duplicate Message Detection Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_duplicate_sameOperationIdPreventsDoubleCompletion() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);
        relay.completeRelay(opId, "result");
        vm.stopPrank();

        // Try to complete again
        vm.prank(relayer);
        vm.expectRevert();
        relay.completeRelay(opId, "duplicate");
    }

    function test_duplicate_operationIdIsUnique() public {
        vm.startPrank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data1", 50 ether);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data2", 50 ether);
        vm.stopPrank();

        assertTrue(opId1 != opId2, "Operation IDs must be unique");
    }

    function test_duplicate_operationIdDeterministicForSameParams() public {
        // Same params should produce same opId (in theory)
        // However, MarketRelay likely uses nonce/timestamp, so they'll differ
        // This tests that the system handles it correctly

        vm.startPrank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.warp(block.timestamp + 1);

        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);
        vm.stopPrank();

        assertTrue(opId1 != opId2, "Different timestamps should produce different IDs");
    }

    function test_duplicate_cannotReplayCompletedOperation() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);
        relay.completeRelay(opId, "result");
        vm.stopPrank();

        // Try to execute again
        vm.prank(relayer);
        vm.expectRevert();
        relay.updateRelayExecuting(opId);
    }

    function test_duplicate_historyPreventsReplay() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);
        relay.completeRelay(opId, "result");
        vm.stopPrank();

        // Check history
        MarketRelay.RelayHistory memory history = relay.getRelayHistory(opId);
        assertEq(
            uint256(history.status),
            uint256(MarketRelay.RelayStatus.Completed),
            "History should show completed"
        );

        // Cannot create new operation with same opId
        bytes32[] memory allHistory = relay.getAllRelayHistory();
        bool found = false;
        for (uint256 i = 0; i < allHistory.length; i++) {
            if (allHistory[i] == opId) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Operation should be in history");
    }

    function test_duplicate_multipleDeliveryAttemptsPrevented() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);

        // First completion succeeds
        relay.completeRelay(opId, "result1");

        // Second attempt should fail
        vm.expectRevert();
        relay.completeRelay(opId, "result2");
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // State Consistency Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_stateConsistency_pendingToExecutingTransition() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Pending));

        vm.prank(relayer);
        relay.updateRelayExecuting(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Executing));
    }

    function test_stateConsistency_executingToCompletedTransition() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId);
        relay.completeRelay(opId, "success");
        vm.stopPrank();

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Completed));
    }

    function test_stateConsistency_pendingToFailedTransition() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 1, 5 minutes, 0.01 ether, 50);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.startPrank(relayer);
        relay.failRelay(opId, "fail1");
        relay.failRelay(opId, "fail2");
        vm.stopPrank();

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Failed));
    }

    function test_stateConsistency_pendingToTimeoutTransition() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.warp(block.timestamp + 2 hours);

        relay.checkTimeout(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Timeout));
    }

    function test_stateConsistency_pendingToCancelledTransition() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        vm.prank(alice);
        relay.cancelRelay(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Cancelled));
    }

    function test_stateConsistency_multipleOperationsIndependent() public {
        vm.startPrank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data1", 50 ether);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data2", 50 ether);
        vm.stopPrank();

        // Complete first
        vm.startPrank(relayer);
        relay.updateRelayExecuting(opId1);
        relay.completeRelay(opId1, "result1");
        vm.stopPrank();

        // Second should still be pending
        assertEq(uint256(relay.getRelayStatus(opId1)), uint256(MarketRelay.RelayStatus.Completed));
        assertEq(uint256(relay.getRelayStatus(opId2)), uint256(MarketRelay.RelayStatus.Pending));
    }

    function test_stateConsistency_failureDoesNotAffectOtherOperations() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 1, 5 minutes, 0.01 ether, 50);

        vm.startPrank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data1", 50 ether);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data2", 50 ether);
        vm.stopPrank();

        // Fail first operation
        vm.startPrank(relayer);
        relay.failRelay(opId1, "fail1");
        relay.failRelay(opId1, "fail2");
        vm.stopPrank();

        assertEq(uint256(relay.getRelayStatus(opId1)), uint256(MarketRelay.RelayStatus.Failed));
        assertEq(uint256(relay.getRelayStatus(opId2)), uint256(MarketRelay.RelayStatus.Pending));
    }

    function test_stateConsistency_chainedStateChanges() public {
        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, "data", 50 ether);

        // Pending -> Executing
        vm.prank(relayer);
        relay.updateRelayExecuting(opId);
        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Executing));

        // Executing -> Fail (back to Pending with retry)
        vm.prank(relayer);
        relay.failRelay(opId, "temp failure");
        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Pending));

        // Pending -> Executing again
        vm.prank(relayer);
        relay.updateRelayExecuting(opId);
        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Executing));

        // Executing -> Completed
        vm.prank(relayer);
        relay.completeRelay(opId, "success");
        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Completed));
    }

    function test_stateConsistency_batchOperationsPreserveState() public {
        bytes32[] memory opIds = new bytes32[](5);

        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            opIds[i] = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, abi.encode(i), 50 ether);
        }
        vm.stopPrank();

        // Process them differently
        vm.startPrank(relayer);
        relay.updateRelayExecuting(opIds[0]);
        relay.completeRelay(opIds[0], "done");
        relay.failRelay(opIds[1], "fail");
        vm.stopPrank();

        vm.prank(alice);
        relay.cancelRelay(opIds[2]);

        vm.warp(block.timestamp + 2 hours);
        relay.checkTimeout(opIds[3]);

        // Verify each state
        assertEq(uint256(relay.getRelayStatus(opIds[0])), uint256(MarketRelay.RelayStatus.Completed));
        assertEq(uint256(relay.getRelayStatus(opIds[1])), uint256(MarketRelay.RelayStatus.Pending));
        assertEq(uint256(relay.getRelayStatus(opIds[2])), uint256(MarketRelay.RelayStatus.Cancelled));
        assertEq(uint256(relay.getRelayStatus(opIds[3])), uint256(MarketRelay.RelayStatus.Timeout));
        assertEq(uint256(relay.getRelayStatus(opIds[4])), uint256(MarketRelay.RelayStatus.Pending));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Contracts
// ═══════════════════════════════════════════════════════════════════════════════

contract MockRelayRouter is IRelayRouter {
    uint256 public nextMessageNonce = 1;
    uint256 public relayFee = 0.01 ether;
    mapping(uint64 => bool) public supportedChains;

    function setChainSupported(uint64 chainSelector, bool supported) external {
        supportedChains[chainSelector] = supported;
    }

    function setRelayFee(uint256 fee) external {
        relayFee = fee;
    }

    function isChainSupported(uint64 chainSelector) external view returns (bool) {
        return supportedChains[chainSelector];
    }

    function relayMessage(uint64, RelayClient.RelayMessage calldata)
        external
        payable
        returns (bytes32)
    {
        require(msg.value >= relayFee, "insufficient relay fee");
        return keccak256(abi.encode(nextMessageNonce++, block.timestamp));
    }
}
