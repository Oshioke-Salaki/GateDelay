// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MarketRelay, RelayClient, IRelayRouter} from "../contracts/MarketRelay.sol";

// ---------------------------------------------------------------
// Mock Relay Router
// ---------------------------------------------------------------

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

// ---------------------------------------------------------------
// Test Contract
// ---------------------------------------------------------------

contract MarketRelayTest is Test {
    MarketRelay internal relay;
    MockRelayRouter internal router;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint64 internal constant CHAIN_AVALANCHE = 6433500567565415381;
    uint64 internal constant CHAIN_BASE = 15971525489660198786;
    uint64 internal constant CHAIN_ARBITRUM = 4949039107694359331;

    function setUp() public {
        router = new MockRelayRouter();
        relay = new MarketRelay(address(router), relayer, feeRecipient, owner);

        // Setup test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(owner, 100 ether);
    }

    // ---------------------------------------------------------------
    // Chain Configuration Tests
    // ---------------------------------------------------------------

    function test_ConfigureChain_SetsConfigAndEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MarketRelay.ChainConfigured(CHAIN_BASE, 1 hours, 3, 0.01 ether, 50);

        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);

        assertTrue(relay.isChainSupported(CHAIN_BASE));
        MarketRelay.RelayConfig memory cfg = relay.getChainConfig(CHAIN_BASE);
        assertEq(cfg.defaultTimeout, 1 hours);
        assertEq(cfg.maxRetries, 3);
        assertEq(cfg.baseFee, 0.01 ether);
        assertEq(cfg.feeBps, 50);
    }

    function test_RevertWhen_ConfiguringChainWithInvalidTimeout() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__InvalidTimeout.selector,
                30 seconds
            )
        );
        relay.configureChain(CHAIN_BASE, 30 seconds, 3, 5 minutes, 0.01 ether, 50);
    }

    function test_RevertWhen_ConfiguringChainWithExcessiveTimeout() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__InvalidTimeout.selector,
                31 days
            )
        );
        relay.configureChain(CHAIN_BASE, 31 days, 3, 5 minutes, 0.01 ether, 50);
    }

    function test_RevertWhen_ConfiguringAlreadyConfiguredChain() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__ChainAlreadyConfigured.selector,
                CHAIN_BASE
            )
        );
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
    }

    function test_RemoveChain_DisablesRelayingToChain() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);

        vm.prank(owner);
        relay.removeChain(CHAIN_BASE);

        assertFalse(relay.isChainSupported(CHAIN_BASE));
    }

    function test_UpdateChainConfig_UpdatesTimeoutAndRetries() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);

        vm.prank(owner);
        relay.updateChainConfig(CHAIN_BASE, 2 hours, 5);

        MarketRelay.RelayConfig memory cfg = relay.getChainConfig(CHAIN_BASE);
        assertEq(cfg.defaultTimeout, 2 hours);
        assertEq(cfg.maxRetries, 5);
    }

    function test_GetSupportedChains_ListsAllConfiguredChains() public {
        vm.startPrank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        relay.configureChain(CHAIN_AVALANCHE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        relay.configureChain(CHAIN_ARBITRUM, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        vm.stopPrank();

        uint64[] memory chains = relay.getSupportedChains();
        assertEq(chains.length, 3);
        assertEq(chains[0], CHAIN_BASE);
        assertEq(chains[1], CHAIN_AVALANCHE);
        assertEq(chains[2], CHAIN_ARBITRUM);
    }

    // ---------------------------------------------------------------
    // Fee Calculation Tests
    // ---------------------------------------------------------------

    function test_CalculateRelayFee_CombinesFlatAndProportional() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.1 ether, 100); // 0.1 ether flat + 1%

        uint256 fee = relay.calculateRelayFee(CHAIN_BASE, 100 ether);
        assertEq(fee, 0.1 ether + 1 ether); // 0.1 ether flat + 1 ether (1% of 100)
    }

    function test_CalculateRelayFee_WithZeroValue() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.1 ether, 100);

        uint256 fee = relay.calculateRelayFee(CHAIN_BASE, 0);
        assertEq(fee, 0.1 ether); // just the base fee
    }

    function test_RevertWhen_CalculatingFeeForUnsupportedChain() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__ChainNotSupported.selector,
                CHAIN_BASE
            )
        );
        relay.calculateRelayFee(CHAIN_BASE, 10 ether);
    }

    // ---------------------------------------------------------------
    // Relay Initiation Tests
    // ---------------------------------------------------------------

    function test_InitiateRelay_CreatesOperationWithPendingStatus() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        assertEq(op.initiator, alice);
        assertEq(op.destChain, CHAIN_BASE);
        assertEq(op.value, 50 ether);
        assertEq(uint256(op.status), uint256(MarketRelay.RelayStatus.Pending));
        assertTrue(op.createdAt > 0);
    }

    function test_InitiateRelay_SetCorrectTimeout() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 2 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);
        uint256 blockTimeBefore = block.timestamp;

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        assertEq(op.timeoutAt, blockTimeBefore + 2 hours);
    }

    function test_RevertWhen_InitiatingRelayWithoutSufficientFee() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.1 ether, 100);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__InsufficientFundsForFee.selector,
                1.1 ether,
                0.01 ether
            )
        );
        relay.initiateRelay{value: 0.01 ether}(CHAIN_BASE, opData, 100 ether);
    }

    function test_RevertWhen_InitiatingRelayToUnsupportedChain() public {
        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__ChainNotSupported.selector,
                CHAIN_BASE
            )
        );
        relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);
    }

    function test_InitiateRelay_TracksFeeCollection() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.1 ether, 100); // 0.1 ether + 1%
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        relay.initiateRelay{value: 1.2 ether}(CHAIN_BASE, opData, 100 ether);

        assertEq(relay.totalFeesCollected(), 1.1 ether);
    }
}

    // ---------------------------------------------------------------
    // Status Transition Tests
    // ---------------------------------------------------------------

    function test_UpdateRelayExecuting_TransitionsFromPendingToExecuting() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        vm.expectEmit(true, false, false, true);
        emit MarketRelay.RelayExecuting(opId, block.timestamp);
        relay.updateRelayExecuting(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Executing));
    }

    function test_CompleteRelay_TransitionsToCompleted() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        relay.updateRelayExecuting(opId);

        bytes memory result = abi.encode(true);
        vm.prank(relayer);
        vm.expectEmit(true, false, false, false);
        emit MarketRelay.RelayCompleted(opId, result, block.timestamp);
        relay.completeRelay(opId, result);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Completed));
    }

    function test_FailRelay_WithRetriesAvailable_ReturnsToP pending() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        relay.failRelay(opId, "execution failed");

        MarketRelay.RelayOperation memory op = relay.getRelayOperation(opId);
        assertEq(uint256(op.status), uint256(MarketRelay.RelayStatus.Pending));
        assertEq(op.attempts, 2);
    }

    function test_FailRelay_MaxRetriesExceeded_SetToFailed() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 1, 5 minutes, 0.01 ether, 50); // maxRetries = 1
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        relay.failRelay(opId, "first failure");

        // At this point, attempts = 2, maxRetries = 1, so next failure marks as Failed
        vm.prank(relayer);
        relay.failRelay(opId, "second failure");

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Failed));
    }

    function test_RevertWhen_FailingAlreadyCompletedRelay() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        relay.updateRelayExecuting(opId);

        vm.prank(relayer);
        relay.completeRelay(opId, "");

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__OperationAlreadyCompleted.selector,
                opId
            )
        );
        relay.failRelay(opId, "too late");
    }

    // ---------------------------------------------------------------
    // Timeout Tests
    // ---------------------------------------------------------------

    function test_CheckTimeout_MarksExpiredOperationAsTimeout() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        // Fast-forward past timeout
        vm.warp(block.timestamp + 2 hours);

        vm.expectEmit(true, false, false, true);
        emit MarketRelay.RelayTimeout(opId, block.timestamp);
        relay.checkTimeout(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Timeout));
    }

    function test_RevertWhen_CheckingTimeoutBeforeExpiration() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        // No time warp - still within timeout window
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__OperationNotExpired.selector,
                opId
            )
        );
        relay.checkTimeout(opId);
    }

    function test_GetExpiredRelays_ReturnsOnlyExpiredOperations() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData1 = abi.encode(address(0x123), 100 ether);
        bytes memory opData2 = abi.encode(address(0x456), 200 ether);

        vm.prank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData1, 50 ether);

        vm.warp(block.timestamp + 30 minutes); // Move forward but not past timeout

        vm.prank(alice);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData2, 50 ether);

        vm.warp(block.timestamp + 45 minutes); // Now opId1 is expired (1.25 hours), opId2 is not

        bytes32[] memory expired = relay.getExpiredRelays();
        assertEq(expired.length, 1);
        assertEq(expired[0], opId1);
    }

    // ---------------------------------------------------------------
    // Cancellation Tests
    // ---------------------------------------------------------------

    function test_CancelRelay_ByInitiator_SetsToCancelled() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit MarketRelay.RelayCancelled(opId, block.timestamp);
        relay.cancelRelay(opId);

        assertEq(uint256(relay.getRelayStatus(opId)), uint256(MarketRelay.RelayStatus.Cancelled));
    }

    function test_RevertWhen_CancellingRelayByNonInitiator() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__NotInitiator.selector,
                bob
            )
        );
        relay.cancelRelay(opId);
    }

    // ---------------------------------------------------------------
    // Query Tests
    // ---------------------------------------------------------------

    function test_GetRelaysByInitiator_ReturnsSingleUserOperations() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData1 = abi.encode(address(0x123), 100 ether);
        bytes memory opData2 = abi.encode(address(0x456), 200 ether);

        vm.prank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData1, 50 ether);

        vm.prank(alice);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData2, 50 ether);

        vm.prank(bob);
        relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData1, 50 ether);

        bytes32[] memory aliceOps = relay.getRelaysByInitiator(alice);
        assertEq(aliceOps.length, 2);
        assertEq(aliceOps[0], opId1);
        assertEq(aliceOps[1], opId2);
    }

    function test_GetPendingRelaysByInitiator_ReturnsOnlyPendingOperations() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData1 = abi.encode(address(0x123), 100 ether);
        bytes memory opData2 = abi.encode(address(0x456), 200 ether);

        vm.prank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData1, 50 ether);

        vm.prank(alice);
        bytes32 opId2 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData2, 50 ether);

        // Complete one operation
        vm.prank(relayer);
        relay.updateRelayExecuting(opId1);

        vm.prank(relayer);
        relay.completeRelay(opId1, "");

        bytes32[] memory pendingOps = relay.getPendingRelaysByInitiator(alice);
        assertEq(pendingOps.length, 1);
        assertEq(pendingOps[0], opId2);
    }

    function test_GetPendingRelaysByChain_ReturnsChainPendingOperations() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        relay.configureChain(CHAIN_AVALANCHE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);
        router.setChainSupported(CHAIN_AVALANCHE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 baseOpId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        bytes32 avaxOpId = relay.initiateRelay{value: 0.05 ether}(CHAIN_AVALANCHE, opData, 50 ether);

        bytes32[] memory basePending = relay.getPendingRelaysByChain(CHAIN_BASE);
        assertEq(basePending.length, 1);
        assertEq(basePending[0], baseOpId);

        bytes32[] memory avaxPending = relay.getPendingRelaysByChain(CHAIN_AVALANCHE);
        assertEq(avaxPending.length, 1);
        assertEq(avaxPending[0], avaxOpId);
    }

    function test_GetRelayCount_ReturnsCorrectCount() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        assertEq(relay.getRelayCount(), 3);
    }

    // ---------------------------------------------------------------
    // History Tests
    // ---------------------------------------------------------------

    function test_RelayHistory_RecordedWhenCompleted() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        bytes memory result = abi.encode(true, "success");

        vm.prank(relayer);
        relay.updateRelayExecuting(opId);

        vm.prank(relayer);
        relay.completeRelay(opId, result);

        MarketRelay.RelayHistory memory history = relay.getRelayHistory(opId);
        assertEq(history.operationId, opId);
        assertEq(history.initiator, alice);
        assertEq(uint256(history.status), uint256(MarketRelay.RelayStatus.Completed));
        assertEq(keccak256(history.result), keccak256(result));
    }

    function test_AddRelayHistory_ManualRecording() public {
        bytes32 opId = keccak256("test_operation");
        bytes memory result = abi.encode(true);
        uint256 createdAt = block.timestamp - 1000;
        uint256 completedAt = block.timestamp;

        vm.prank(owner);
        relay.addRelayHistory(
            opId,
            alice,
            MarketRelay.RelayStatus.Completed,
            createdAt,
            completedAt,
            createdAt + 1 hours,
            2,
            result
        );

        MarketRelay.RelayHistory memory history = relay.getRelayHistory(opId);
        assertEq(history.operationId, opId);
        assertEq(history.initiator, alice);
        assertEq(uint256(history.status), uint256(MarketRelay.RelayStatus.Completed));
        assertEq(history.attempts, 2);
    }

    function test_GetAllRelayHistory_ReturnsAllOperationIds() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId1 = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(relayer);
        relay.updateRelayExecuting(opId1);

        vm.prank(relayer);
        relay.completeRelay(opId1, "");

        // Add manual history entry
        bytes32 opId2 = keccak256("manual_op");
        vm.prank(owner);
        relay.addRelayHistory(
            opId2,
            alice,
            MarketRelay.RelayStatus.Timeout,
            block.timestamp,
            block.timestamp,
            block.timestamp,
            1,
            ""
        );

        bytes32[] memory history = relay.getAllRelayHistory();
        assertGe(history.length, 1); // At least the completed operation
    }

    // ---------------------------------------------------------------
    // Access Control Tests
    // ---------------------------------------------------------------

    function test_RevertWhen_NonOwnerConfiguresChain() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
    }

    function test_RevertWhen_NonRelayerUpdatesStatus() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        router.setChainSupported(CHAIN_BASE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 opId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketRelay.MarketRelay__NotRelayer.selector,
                alice
            )
        );
        relay.updateRelayExecuting(opId);
    }

    // ---------------------------------------------------------------
    // Multi-chain Tests
    // ---------------------------------------------------------------

    function test_MultipleChains_RelaysTrackedIndependently() public {
        vm.prank(owner);
        relay.configureChain(CHAIN_BASE, 1 hours, 3, 5 minutes, 0.01 ether, 50);
        relay.configureChain(CHAIN_AVALANCHE, 1 hours, 3, 5 minutes, 0.02 ether, 100);
        router.setChainSupported(CHAIN_BASE, true);
        router.setChainSupported(CHAIN_AVALANCHE, true);

        bytes memory opData = abi.encode(address(0x123), 100 ether);

        vm.prank(alice);
        bytes32 baseOpId = relay.initiateRelay{value: 0.05 ether}(CHAIN_BASE, opData, 50 ether);

        vm.prank(alice);
        bytes32 avaxOpId = relay.initiateRelay{value: 0.1 ether}(CHAIN_AVALANCHE, opData, 50 ether);

        MarketRelay.RelayOperation memory baseOp = relay.getRelayOperation(baseOpId);
        MarketRelay.RelayOperation memory avaxOp = relay.getRelayOperation(avaxOpId);

        assertEq(baseOp.destChain, CHAIN_BASE);
        assertEq(avaxOp.destChain, CHAIN_AVALANCHE);
        assertNotEq(baseOp.operationId, avaxOp.operationId);
    }
}
