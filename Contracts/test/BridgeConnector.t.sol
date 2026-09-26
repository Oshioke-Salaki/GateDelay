// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BridgeConnector, ILayerZeroEndpoint} from "../src/BridgeConnector.sol";

contract MockBridgeEndpoint is ILayerZeroEndpoint {
    uint256 public sendCount;

    function send(uint16, bytes calldata, bytes calldata, address payable, address, bytes calldata) external payable {
        sendCount++;
    }

    function estimateFees(uint16, address, bytes calldata, bool, bytes calldata)
        external
        pure
        returns (uint256 nativeFee, uint256 zroFee)
    {
        return (0, 0);
    }

    function getOutboundNonce(uint16, address) external pure returns (uint64) {
        return 0;
    }
}

contract BridgeConnectorTest is Test {
    uint16 internal constant DESTINATION_CHAIN = 101;

    MockBridgeEndpoint internal endpoint;
    BridgeConnector internal connector;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function setUp() public {
        endpoint = new MockBridgeEndpoint();
        connector = new BridgeConnector(address(endpoint), owner);

        vm.prank(owner);
        connector.registerProtocol(DESTINATION_CHAIN, hex"1234");
    }

    function test_PauseBlocksOutboundMessages() public {
        vm.prank(owner);
        connector.pause();

        vm.prank(alice);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.sendMessage(DESTINATION_CHAIN, bytes("payload"), bytes(""));

        assertEq(connector.outboundMessageCount(), 0);
        assertEq(endpoint.sendCount(), 0);
    }

    function test_PauseBlocksRetryUntilOwnerResumesConnector() public {
        vm.prank(alice);
        uint256 messageId = connector.sendMessage(DESTINATION_CHAIN, bytes("payload"), bytes(""));

        vm.prank(owner);
        connector.markFailed(messageId);

        vm.prank(owner);
        connector.pause();

        vm.prank(owner);
        vm.expectRevert(BridgeConnector.BridgeConnector__ConnectorPaused.selector);
        connector.retryMessage(messageId, bytes(""));

        assertEq(uint256(connector.getOutboundMessageStatus(messageId)), uint256(BridgeConnector.MessageStatus.Failed));

        vm.prank(owner);
        connector.resume();

        vm.prank(owner);
        connector.retryMessage(messageId, bytes(""));

        assertEq(uint256(connector.getOutboundMessageStatus(messageId)), uint256(BridgeConnector.MessageStatus.Retried));
        assertEq(endpoint.sendCount(), 2);
    }

    function test_InboundRecoveryRemainsAvailableWhilePaused() public {
        vm.prank(owner);
        connector.pause();

        vm.prank(owner);
        connector.confirmInbound(DESTINATION_CHAIN, hex"abcd", 7, bytes("recovery"));

        vm.prank(owner);
        connector.acknowledgeInbound(1);

        BridgeConnector.InboundMessage memory inbound = connector.getInboundMessage(1);
        assertEq(uint256(inbound.status), uint256(BridgeConnector.MessageStatus.Delivered));
        assertEq(connector.totalMessagesReceived(), 1);
    }

    function test_NonOwnerCannotResumePausedConnector() public {
        vm.prank(owner);
        connector.pause();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        connector.resume();

        assertEq(uint256(connector.connectorStatus()), uint256(BridgeConnector.ConnectorStatus.Paused));
    }
}
