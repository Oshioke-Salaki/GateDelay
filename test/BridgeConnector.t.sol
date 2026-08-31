// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "../Contracts/contracts/BridgeConnector.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Mock LayerZero endpoint
// ─────────────────────────────────────────────────────────────────────────────

contract MockLZEndpoint is ILayerZeroEndpoint {
    uint256 public nativeFee = 0.01 ether;
    uint256 public sendCallCount;
    uint16  public lastDstChainId;
    bytes   public lastPayload;

    function setNativeFee(uint256 fee) external { nativeFee = fee; }

    function send(
        uint16 _dstChainId,
        bytes calldata,
        bytes calldata _payload,
        address payable,
        address,
        bytes calldata
    ) external payable override {
        require(msg.value >= nativeFee, "MockLZEndpoint: insufficient fee");
        sendCallCount++;
        lastDstChainId = _dstChainId;
        lastPayload = _payload;
    }

    function estimateFees(
        uint16,
        address,
        bytes calldata,
        bool,
        bytes calldata
    ) external view override returns (uint256, uint256) {
        return (nativeFee, 0);
    }

    function getOutboundNonce(uint16, address) external pure override returns (uint64) {
        return 1;
    }

    /// @dev Helper: simulate the endpoint calling lzReceive on a connector.
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

// ─────────────────────────────────────────────────────────────────────────────
// BridgeConnector test suite
// ─────────────────────────────────────────────────────────────────────────────

contract BridgeConnectorTest is Test {
    BridgeConnector internal connector;
    MockLZEndpoint  internal endpoint;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");

    uint16  internal constant CHAIN_A = 101;
    uint16  internal constant CHAIN_B = 102;
    bytes   internal constant REMOTE_A = abi.encodePacked(address(0xAAAA));
    bytes   internal constant REMOTE_B = abi.encodePacked(address(0xBBBB));
    bytes   internal constant PAYLOAD  = abi.encode("hello bridge");

    function setUp() public {
        endpoint  = new MockLZEndpoint();
        connector = new BridgeConnector(address(endpoint), owner);

        vm.deal(alice, 10 ether);
        vm.deal(owner, 10 ether);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _registerChainA() internal {
        vm.prank(owner);
        connector.registerProtocol(CHAIN_A, REMOTE_A);
    }

    function _registerChainB() internal {
        vm.prank(owner);
        connector.registerProtocol(CHAIN_B, REMOTE_B);
    }

    function _sendFromAlice() internal returns (uint256 messageId) {
        _registerChainA();
        vm.prank(alice);
        messageId = connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor / initial state
    // ─────────────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(connector.lzEndpoint()), address(endpoint));
        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Active));
        assertEq(connector.totalMessagesSent(), 0);
        assertEq(connector.totalMessagesReceived(), 0);
        assertEq(connector.totalMessagesFailed(), 0);
        assertEq(connector.outboundMessageCount(), 0);
        assertEq(connector.inboundMessageCount(), 0);
    }

    function test_RevertWhen_ZeroEndpointAddress() public {
        vm.expectRevert(BridgeConnector.BridgeConnector__ZeroAddress.selector);
        new BridgeConnector(address(0), owner);
    }

    function test_RevertWhen_ZeroOwnerAddress() public {
        vm.expectRevert(BridgeConnector.BridgeConnector__ZeroAddress.selector);
        new BridgeConnector(address(endpoint), address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Protocol connections
    // ─────────────────────────────────────────────────────────────────────────

    function test_RegisterProtocol_SetsConfigAndEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit BridgeConnector.ProtocolRegistered(CHAIN_A, REMOTE_A);

        _registerChainA();

        assertTrue(connector.isProtocolActive(CHAIN_A));
        BridgeConnector.ProtocolConfig memory cfg = connector.getProtocol(CHAIN_A);
        assertEq(cfg.chainId, CHAIN_A);
        assertEq(cfg.remoteAddress, REMOTE_A);
        assertTrue(cfg.active);
    }

    function test_RegisterProtocol_AppearsInChainList() public {
        _registerChainA();
        _registerChainB();

        uint16[] memory chains = connector.getRegisteredChainIds();
        assertEq(chains.length, 2);
        assertEq(chains[0], CHAIN_A);
        assertEq(chains[1], CHAIN_B);
    }

    function test_RevertWhen_RegisterProtocolCalledByNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        connector.registerProtocol(CHAIN_A, REMOTE_A);
    }

    function test_RevertWhen_RegisterAlreadyActiveProtocol() public {
        _registerChainA();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__ProtocolAlreadyRegistered.selector, CHAIN_A)
        );
        connector.registerProtocol(CHAIN_A, REMOTE_A);
    }

    function test_RevertWhen_RegisterProtocolWithEmptyAddress() public {
        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__EmptyPayload.selector);
        connector.registerProtocol(CHAIN_A, "");
    }

    function test_RemoveProtocol_DisablesChain() public {
        _registerChainA();

        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.ProtocolRemoved(CHAIN_A);

        vm.prank(owner);
        connector.removeProtocol(CHAIN_A);

        assertFalse(connector.isProtocolActive(CHAIN_A));
    }

    function test_RevertWhen_RemoveInactiveProtocol() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__ProtocolNotRegistered.selector, CHAIN_A)
        );
        connector.removeProtocol(CHAIN_A);
    }

    function test_UpdateProtocol_ChangesRemoteAddress() public {
        _registerChainA();
        bytes memory newAddr = abi.encodePacked(address(0xCCCC));

        vm.expectEmit(true, false, false, true);
        emit BridgeConnector.ProtocolUpdated(CHAIN_A, newAddr);

        vm.prank(owner);
        connector.updateProtocol(CHAIN_A, newAddr);

        BridgeConnector.ProtocolConfig memory cfg = connector.getProtocol(CHAIN_A);
        assertEq(cfg.remoteAddress, newAddr);
    }

    function test_RevertWhen_UpdateInactiveProtocol() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__ProtocolNotRegistered.selector, CHAIN_A)
        );
        connector.updateProtocol(CHAIN_A, REMOTE_A);
    }

    function test_RevertWhen_UpdateProtocolWithEmptyAddress() public {
        _registerChainA();
        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__EmptyPayload.selector);
        connector.updateProtocol(CHAIN_A, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Outbound message handling
    // ─────────────────────────────────────────────────────────────────────────

    function test_SendMessage_CreatesPendingRecord() public {
        uint256 id = _sendFromAlice();

        BridgeConnector.BridgeMessage memory m = connector.getOutboundMessage(id);
        assertEq(m.messageId, id);
        assertEq(m.dstChainId, CHAIN_A);
        assertEq(m.sender, alice);
        assertEq(m.payload, PAYLOAD);
        assertEq(uint256(m.status), uint256(BridgeConnector.MessageStatus.Pending));
        assertTrue(m.sentAt > 0);
        assertEq(m.payloadHash, keccak256(PAYLOAD));
    }

    function test_SendMessage_EmitsEvent() public {
        _registerChainA();

        vm.expectEmit(true, true, true, false);
        emit BridgeConnector.MessageSent(1, CHAIN_A, alice, keccak256(PAYLOAD));

        vm.prank(alice);
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    function test_SendMessage_ForwardsToEndpoint() public {
        _sendFromAlice();
        assertEq(endpoint.sendCallCount(), 1);
        assertEq(endpoint.lastDstChainId(), CHAIN_A);
        assertEq(endpoint.lastPayload(), PAYLOAD);
    }

    function test_SendMessage_IncrementsTotalSent() public {
        _sendFromAlice();
        assertEq(connector.totalMessagesSent(), 1);
        assertEq(connector.outboundMessageCount(), 1);
    }

    function test_SendMessage_TracksIdsBySender() public {
        _registerChainA();
        vm.startPrank(alice);
        uint256 id1 = connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
        uint256 id2 = connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
        vm.stopPrank();

        uint256[] memory ids = connector.getOutboundMessagesBySender(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    function test_RevertWhen_SendToUnregisteredChain() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__ProtocolNotRegistered.selector, CHAIN_A)
        );
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    function test_RevertWhen_SendEmptyPayload() public {
        _registerChainA();
        vm.prank(alice);
        vm.expectRevert(BridgeConnector.BridgeConnector__EmptyPayload.selector);
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, "", "");
    }

    function test_RevertWhen_SendInsufficientFee() public {
        _registerChainA();
        vm.prank(alice);
        vm.expectRevert("MockLZEndpoint: insufficient fee");
        connector.sendMessage{value: 0}(CHAIN_A, PAYLOAD, "");
    }

    function test_RevertWhen_SendToRemovedChain() public {
        _registerChainA();
        vm.prank(owner);
        connector.removeProtocol(CHAIN_A);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__ProtocolNotRegistered.selector, CHAIN_A)
        );
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    function test_MarkDelivered_UpdatesStatus() public {
        uint256 id = _sendFromAlice();

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.MessageDelivered(id, CHAIN_A);

        vm.prank(owner);
        connector.markDelivered(id);

        assertEq(
            uint256(connector.getOutboundMessageStatus(id)),
            uint256(BridgeConnector.MessageStatus.Delivered)
        );
    }

    function test_RevertWhen_MarkDeliveredNonPending() public {
        uint256 id = _sendFromAlice();
        vm.prank(owner);
        connector.markDelivered(id);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BridgeConnector.BridgeConnector__MessageNotPending.selector,
                id,
                BridgeConnector.MessageStatus.Delivered
            )
        );
        connector.markDelivered(id);
    }

    function test_MarkFailed_UpdatesStatusAndCounter() public {
        uint256 id = _sendFromAlice();

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.MessageFailed(id, CHAIN_A);

        vm.prank(owner);
        connector.markFailed(id);

        assertEq(
            uint256(connector.getOutboundMessageStatus(id)),
            uint256(BridgeConnector.MessageStatus.Failed)
        );
        assertEq(connector.totalMessagesFailed(), 1);
    }

    function test_RetryMessage_SendsAgain() public {
        uint256 id = _sendFromAlice();
        vm.prank(owner);
        connector.markFailed(id);

        uint256 countBefore = endpoint.sendCallCount();

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.MessageRetried(id, CHAIN_A);

        vm.prank(owner);
        connector.retryMessage{value: 0.01 ether}(id, "");

        assertEq(endpoint.sendCallCount(), countBefore + 1);
        assertEq(
            uint256(connector.getOutboundMessageStatus(id)),
            uint256(BridgeConnector.MessageStatus.Retried)
        );
    }

    function test_RevertWhen_RetryNonFailedMessage() public {
        uint256 id = _sendFromAlice();
        // still Pending, not Failed
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BridgeConnector.BridgeConnector__MessageNotFailed.selector,
                id,
                BridgeConnector.MessageStatus.Pending
            )
        );
        connector.retryMessage{value: 0.01 ether}(id, "");
    }

    function test_RevertWhen_QueryNonexistentOutboundMessage() public {
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__MessageNotFound.selector, 99)
        );
        connector.getOutboundMessage(99);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inbound message handling
    // ─────────────────────────────────────────────────────────────────────────

    function test_LzReceive_RecordsInboundMessage() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.InboundMessageReceived(1, CHAIN_A, 1, keccak256(PAYLOAD));

        // Delivered by the endpoint mock
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);

        assertEq(connector.inboundMessageCount(), 1);
        assertEq(connector.totalMessagesReceived(), 1);

        BridgeConnector.InboundMessage memory m = connector.getInboundMessage(1);
        assertEq(m.srcChainId, CHAIN_A);
        assertEq(m.nonce, 1);
        assertEq(m.payload, PAYLOAD);
        assertEq(uint256(m.status), uint256(BridgeConnector.MessageStatus.Pending));
        assertEq(m.payloadHash, keccak256(PAYLOAD));
    }

    function test_RevertWhen_LzReceiveCalledByNonEndpoint() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__NotEndpoint.selector, alice)
        );
        connector.lzReceive(CHAIN_A, srcAddr, 1, PAYLOAD);
    }

    function test_ConfirmInbound_OwnerCanSimulateDelivery() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        vm.prank(owner);
        connector.confirmInbound(CHAIN_A, srcAddr, 1, PAYLOAD);

        assertEq(connector.inboundMessageCount(), 1);
        BridgeConnector.InboundMessage memory m = connector.getInboundMessage(1);
        assertEq(uint256(m.status), uint256(BridgeConnector.MessageStatus.Pending));
    }

    function test_RevertWhen_ConfirmInboundCalledByNonOwner() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        connector.confirmInbound(CHAIN_A, srcAddr, 1, PAYLOAD);
    }

    function test_AcknowledgeInbound_MarksDelivered() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.InboundMessageConfirmed(1, CHAIN_A);

        vm.prank(owner);
        connector.acknowledgeInbound(1);

        assertEq(
            uint256(connector.getInboundMessage(1).status),
            uint256(BridgeConnector.MessageStatus.Delivered)
        );
    }

    function test_FailInbound_MarksFailedAndIncrementsCounter() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.InboundMessageFailed(1, CHAIN_A);

        vm.prank(owner);
        connector.failInbound(1);

        assertEq(
            uint256(connector.getInboundMessage(1).status),
            uint256(BridgeConnector.MessageStatus.Failed)
        );
        assertEq(connector.totalMessagesFailed(), 1);
    }

    function test_RevertWhen_AcknowledgeNonPendingInbound() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);
        vm.prank(owner);
        connector.acknowledgeInbound(1);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BridgeConnector.BridgeConnector__InboundNotPending.selector,
                1,
                BridgeConnector.MessageStatus.Delivered
            )
        );
        connector.acknowledgeInbound(1);
    }

    function test_RevertWhen_QueryNonexistentInboundMessage() public {
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__InboundNotFound.selector, 42)
        );
        connector.getInboundMessage(42);
    }

    function test_GetInboundMessagesByChain_FiltersCorrectly() public {
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);
        endpoint.deliverTo(address(connector), CHAIN_B, srcAddr, 2, PAYLOAD);
        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 3, PAYLOAD);

        uint256[] memory chainAIds = connector.getInboundMessagesByChain(CHAIN_A);
        uint256[] memory chainBIds = connector.getInboundMessagesByChain(CHAIN_B);

        assertEq(chainAIds.length, 2);
        assertEq(chainBIds.length, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connector upgrades
    // ─────────────────────────────────────────────────────────────────────────

    function test_ProposeUpgrade_CreatesProposalAndEmitsEvent() public {
        address impl = makeAddr("impl");

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.UpgradeProposed(1, impl, block.timestamp + connector.UPGRADE_TIMELOCK(), "v2");

        vm.prank(owner);
        uint256 proposalId = connector.proposeUpgrade(impl, "v2");

        assertEq(proposalId, 1);
        assertEq(connector.pendingImplementation(), impl);

        BridgeConnector.UpgradeProposal memory p = connector.getUpgradeProposal(proposalId);
        assertEq(p.proposedImplementation, impl);
        assertEq(uint256(p.status), uint256(BridgeConnector.UpgradeStatus.Proposed));
        assertEq(p.effectiveAfter, block.timestamp + connector.UPGRADE_TIMELOCK());
    }

    function test_RevertWhen_ProposeUpgradeWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ZeroAddress.selector);
        connector.proposeUpgrade(address(0), "bad");
    }

    function test_RevertWhen_ProposeUpgradeByNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        connector.proposeUpgrade(makeAddr("impl"), "v2");
    }

    function test_ExecuteUpgrade_AfterTimelockSucceeds() public {
        address impl = makeAddr("impl");
        vm.prank(owner);
        uint256 proposalId = connector.proposeUpgrade(impl, "v2");

        vm.warp(block.timestamp + connector.UPGRADE_TIMELOCK() + 1);

        vm.expectEmit(true, true, false, false);
        emit BridgeConnector.UpgradeExecuted(proposalId, impl);

        vm.prank(owner);
        connector.executeUpgrade(proposalId);

        BridgeConnector.UpgradeProposal memory p = connector.getUpgradeProposal(proposalId);
        assertEq(uint256(p.status), uint256(BridgeConnector.UpgradeStatus.Executed));
        assertEq(connector.pendingImplementation(), address(0));
    }

    function test_RevertWhen_ExecuteUpgradeBeforeTimelock() public {
        address impl = makeAddr("impl");
        vm.prank(owner);
        uint256 proposalId = connector.proposeUpgrade(impl, "v2");

        uint256 effective = block.timestamp + connector.UPGRADE_TIMELOCK();

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BridgeConnector.BridgeConnector__UpgradeTimelockActive.selector,
                effective,
                block.timestamp
            )
        );
        connector.executeUpgrade(proposalId);
    }

    function test_CancelUpgrade_ChangesStatusAndClearsPending() public {
        address impl = makeAddr("impl");
        vm.prank(owner);
        uint256 proposalId = connector.proposeUpgrade(impl, "v2");

        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.UpgradeCancelled(proposalId);

        vm.prank(owner);
        connector.cancelUpgrade(proposalId);

        BridgeConnector.UpgradeProposal memory p = connector.getUpgradeProposal(proposalId);
        assertEq(uint256(p.status), uint256(BridgeConnector.UpgradeStatus.Cancelled));
        assertEq(connector.pendingImplementation(), address(0));
    }

    function test_GetUpgradeProposalIds_ListsAll() public {
        vm.startPrank(owner);
        connector.proposeUpgrade(makeAddr("impl1"), "v2");
        connector.proposeUpgrade(makeAddr("impl2"), "v3");
        vm.stopPrank();

        uint256[] memory ids = connector.getUpgradeProposalIds();
        assertEq(ids.length, 2);
    }

    function test_RevertWhen_QueryNonexistentUpgrade() public {
        vm.expectRevert(
            abi.encodeWithSelector(BridgeConnector.BridgeConnector__UpgradeNotFound.selector, 99)
        );
        connector.getUpgradeProposal(99);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connector status (pause / resume / deprecate)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Pause_BlocksOutboundSend() public {
        _registerChainA();
        vm.prank(owner);
        connector.pause();

        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Paused));

        vm.prank(alice);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    function test_Pause_EmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.ConnectorPaused(owner);

        vm.prank(owner);
        connector.pause();
    }

    function test_Resume_ReenablesOutboundSend() public {
        _registerChainA();
        vm.prank(owner);
        connector.pause();

        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.ConnectorResumed(owner);

        vm.prank(owner);
        connector.resume();

        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Active));

        vm.prank(alice);
        uint256 id = connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
        assertEq(id, 1);
    }

    function test_RevertWhen_ResumeWhileNotPaused() public {
        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.resume();
    }

    function test_Deprecate_PermanentlyBlocksSends() public {
        _registerChainA();
        vm.prank(owner);
        connector.deprecate();

        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Deprecated));

        vm.prank(alice);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorDeprecated.selector);
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
    }

    function test_Deprecate_EmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.ConnectorDeprecated(owner);

        vm.prank(owner);
        connector.deprecate();
    }

    function test_RevertWhen_PauseAfterDeprecation() public {
        vm.prank(owner);
        connector.deprecate();

        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorDeprecated.selector);
        connector.pause();
    }

    function test_SetEndpoint_UpdatesAddress() public {
        address newEp = makeAddr("newEndpoint");

        vm.expectEmit(true, false, false, false);
        emit BridgeConnector.EndpointUpdated(newEp);

        vm.prank(owner);
        connector.setEndpoint(newEp);

        assertEq(address(connector.lzEndpoint()), newEp);
    }

    function test_RevertWhen_SetEndpointZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ZeroAddress.selector);
        connector.setEndpoint(address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Aggregate stats / queries
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetStats_ReflectsCurrentState() public {
        _registerChainA();
        bytes memory srcAddr = abi.encodePacked(address(0xDDDD));

        vm.prank(alice);
        connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");

        endpoint.deliverTo(address(connector), CHAIN_A, srcAddr, 1, PAYLOAD);

        (uint256 sent, uint256 received, uint256 failed, BridgeConnector.ConnectorStatus status) =
            connector.getStats();

        assertEq(sent, 1);
        assertEq(received, 1);
        assertEq(failed, 0);
        assertEq(uint256(status), uint256(BridgeConnector.ConnectorStatus.Active));
    }

    function test_EstimateFee_ReturnsMockEndpointFee() public view {
        (uint256 native, uint256 zro) = connector.estimateFee(CHAIN_A, PAYLOAD, "");
        assertEq(native, 0.01 ether);
        assertEq(zro, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_SendMessage_MessageIdAlwaysIncreases(uint8 count) public {
        vm.assume(count > 0 && count <= 20);
        _registerChainA();

        for (uint256 i = 0; i < count; i++) {
            vm.prank(alice);
            uint256 id = connector.sendMessage{value: 0.01 ether}(CHAIN_A, PAYLOAD, "");
            assertEq(id, i + 1);
        }
        assertEq(connector.outboundMessageCount(), count);
    }

    function testFuzz_PayloadHashIsCorrect(bytes calldata payload) public {
        vm.assume(payload.length > 0);
        _registerChainA();

        vm.prank(alice);
        uint256 id = connector.sendMessage{value: 0.01 ether}(CHAIN_A, payload, "");

        BridgeConnector.BridgeMessage memory m = connector.getOutboundMessage(id);
        assertEq(m.payloadHash, keccak256(payload));
    }
}
