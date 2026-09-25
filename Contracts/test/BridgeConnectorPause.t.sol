// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "../src/BridgeConnector.sol";

/// @dev Minimal LayerZero endpoint that records sends and can deliver inbound messages.
contract PauseTestLZEndpoint is ILayerZeroEndpoint {
    uint256 public sendCallCount;

    function send(uint16, bytes calldata, bytes calldata, address payable, address, bytes calldata)
        external
        payable
        override
    {
        sendCallCount++;
    }

    function estimateFees(uint16, address, bytes calldata, bool, bytes calldata)
        external
        pure
        override
        returns (uint256, uint256)
    {
        return (0, 0);
    }

    function getOutboundNonce(uint16, address) external pure override returns (uint64) {
        return 1;
    }

    function deliverTo(
        address connector,
        uint16 srcChainId,
        bytes calldata srcAddress,
        uint64 nonce,
        bytes calldata payload
    ) external {
        ILayerZeroReceiver(connector).lzReceive(srcChainId, srcAddress, nonce, payload);
    }
}

/// @notice Pause and resume coverage for the bridge path: what a pause blocks,
///         what keeps working during it, and what resumes afterwards.
contract BridgeConnectorPauseTest is Test {
    BridgeConnector internal connector;
    PauseTestLZEndpoint internal endpoint;

    address internal owner = makeAddr("owner");
    address internal user = makeAddr("user");

    uint16 internal constant DST = 101;
    bytes internal constant REMOTE = abi.encodePacked(address(0xBEEF));
    bytes internal constant PAYLOAD = "settle:market-1";

    function setUp() public {
        endpoint = new PauseTestLZEndpoint();
        connector = new BridgeConnector(address(endpoint), owner);
        vm.prank(owner);
        connector.registerProtocol(DST, REMOTE);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _send() internal returns (uint256 id) {
        vm.prank(user);
        id = connector.sendMessage(DST, PAYLOAD, "");
    }

    function _pause() internal {
        vm.prank(owner);
        connector.pause();
    }

    function _resume() internal {
        vm.prank(owner);
        connector.resume();
    }

    function _status(uint256 id) internal view returns (BridgeConnector.MessageStatus) {
        return connector.getOutboundMessageStatus(id);
    }

    // ── blocked while paused ────────────────────────────────────────────────

    function test_Paused_SendRevertsAndRecordsNothing() public {
        _pause();

        vm.prank(user);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.sendMessage(DST, PAYLOAD, "");

        assertEq(connector.outboundMessageCount(), 0);
        assertEq(connector.totalMessagesSent(), 0);
        assertEq(endpoint.sendCallCount(), 0);
        assertEq(connector.getOutboundMessagesBySender(user).length, 0);
    }

    function test_Paused_RetryRevertsAndKeepsMessageFailed() public {
        uint256 id = _send();
        vm.prank(owner);
        connector.markFailed(id);
        _pause();

        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.retryMessage(id, "");

        assertEq(uint256(_status(id)), uint256(BridgeConnector.MessageStatus.Failed));
        assertEq(endpoint.sendCallCount(), 1);
    }

    function test_Paused_OnlyOwnerCanPauseAndResume() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        connector.pause();

        _pause();

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        connector.resume();

        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Paused));
    }

    // ── keeps working while paused ──────────────────────────────────────────

    function test_Paused_InboundFromEndpointIsStillRecorded() public {
        _pause();

        endpoint.deliverTo(address(connector), DST, REMOTE, 7, PAYLOAD);

        assertEq(connector.inboundMessageCount(), 1);
        BridgeConnector.InboundMessage memory m = connector.getInboundMessage(1);
        assertEq(uint256(m.status), uint256(BridgeConnector.MessageStatus.Pending));
        assertEq(m.nonce, 7);
        assertEq(m.payloadHash, keccak256(PAYLOAD));
    }

    function test_Paused_OwnerCanResolveInFlightOutboundMessages() public {
        uint256 delivered = _send();
        uint256 failed = _send();
        _pause();

        vm.startPrank(owner);
        connector.markDelivered(delivered);
        connector.markFailed(failed);
        vm.stopPrank();

        assertEq(uint256(_status(delivered)), uint256(BridgeConnector.MessageStatus.Delivered));
        assertEq(uint256(_status(failed)), uint256(BridgeConnector.MessageStatus.Failed));
        assertEq(connector.totalMessagesFailed(), 1);
    }

    function test_Paused_OwnerCanResolveInboundMessages() public {
        endpoint.deliverTo(address(connector), DST, REMOTE, 1, PAYLOAD);
        endpoint.deliverTo(address(connector), DST, REMOTE, 2, PAYLOAD);
        _pause();

        vm.startPrank(owner);
        connector.acknowledgeInbound(1);
        connector.failInbound(2);
        vm.stopPrank();

        assertEq(uint256(connector.getInboundMessage(1).status), uint256(BridgeConnector.MessageStatus.Delivered));
        assertEq(uint256(connector.getInboundMessage(2).status), uint256(BridgeConnector.MessageStatus.Failed));
    }

    function test_Paused_OwnerCanReconfigureProtocolsAndEndpoint() public {
        _pause();
        bytes memory newRemote = abi.encodePacked(address(0xCAFE));
        PauseTestLZEndpoint newEndpoint = new PauseTestLZEndpoint();

        vm.startPrank(owner);
        connector.updateProtocol(DST, newRemote);
        connector.registerProtocol(202, REMOTE);
        connector.removeProtocol(202);
        connector.setEndpoint(address(newEndpoint));
        vm.stopPrank();

        assertEq(connector.getProtocol(DST).remoteAddress, newRemote);
        assertFalse(connector.isProtocolActive(202));
        assertEq(address(connector.lzEndpoint()), address(newEndpoint));
    }

    function test_Paused_OwnerCanProposeCancelAndExecuteUpgrades() public {
        _pause();

        vm.startPrank(owner);
        uint256 cancelled = connector.proposeUpgrade(address(0x1234), "fix found during pause");
        connector.cancelUpgrade(cancelled);
        uint256 executed = connector.proposeUpgrade(address(0x5678), "patched connector");
        vm.warp(block.timestamp + connector.UPGRADE_TIMELOCK());
        connector.executeUpgrade(executed);
        vm.stopPrank();

        assertEq(
            uint256(connector.getUpgradeProposal(cancelled).status), uint256(BridgeConnector.UpgradeStatus.Cancelled)
        );
        assertEq(
            uint256(connector.getUpgradeProposal(executed).status), uint256(BridgeConnector.UpgradeStatus.Executed)
        );
    }

    // ── after resume ────────────────────────────────────────────────────────

    function test_Resume_MessageFailedDuringPauseCanBeRetried() public {
        uint256 id = _send();
        _pause();
        vm.prank(owner);
        connector.markFailed(id);
        _resume();

        vm.prank(owner);
        connector.retryMessage(id, "");

        assertEq(uint256(_status(id)), uint256(BridgeConnector.MessageStatus.Retried));
        assertEq(endpoint.sendCallCount(), 2);
    }

    function test_Resume_SendsWorkAndEarlierRecordsAreUntouched() public {
        uint256 before = _send();
        BridgeConnector.BridgeMessage memory snapshot = connector.getOutboundMessage(before);

        _pause();
        vm.warp(block.timestamp + 1 days);
        _resume();

        uint256 afterResume = _send();

        assertEq(afterResume, before + 1);
        assertEq(connector.totalMessagesSent(), 2);
        BridgeConnector.BridgeMessage memory m = connector.getOutboundMessage(before);
        assertEq(uint256(m.status), uint256(snapshot.status));
        assertEq(m.sentAt, snapshot.sentAt);
        assertEq(m.payloadHash, snapshot.payloadHash);
    }

    function test_Resume_PauseCanBeRepeated() public {
        for (uint256 i = 0; i < 3; i++) {
            _pause();
            vm.prank(user);
            vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
            connector.sendMessage(DST, PAYLOAD, "");
            _resume();
            _send();
        }
        assertEq(connector.totalMessagesSent(), 3);
    }

    // ── deprecation is not a pause ──────────────────────────────────────────

    function test_DeprecateWhilePaused_CannotResumeAndSendsStayBlocked() public {
        _pause();
        vm.prank(owner);
        connector.deprecate();

        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.resume();

        vm.prank(user);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorDeprecated.selector);
        connector.sendMessage(DST, PAYLOAD, "");
    }
}
