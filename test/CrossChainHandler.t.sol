// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CrossChainHandler} from "../contracts/CrossChainHandler.sol";

contract CrossChainHandlerTest is Test {
    CrossChainHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal sender = makeAddr("sender");
    address internal routeHandler = makeAddr("routeHandler");

    bytes32 internal constant ROUTE_KEY = keccak256("market:update");
    bytes internal constant SAMPLE_PAYLOAD = abi.encodePacked("market", uint256(42));

    function setUp() public {
        vm.prank(owner);
        handler = new CrossChainHandler();

        vm.prank(owner);
        handler.registerRoute(ROUTE_KEY, routeHandler);
    }

    function test_HandleAndRouteMessage_TracksLifecycle() public {
        bytes32 messageId = handler.handleMessage(
            101,
            102,
            sender,
            ROUTE_KEY,
            SAMPLE_PAYLOAD
        );

        CrossChainHandler.CrossChainMessage memory message = handler.getMessage(messageId);
        assertEq(message.status, uint8(CrossChainHandler.MessageStatus.Validated));
        assertEq(message.srcChainId, uint16(101));
        assertEq(message.dstChainId, uint16(102));
        assertEq(message.sender, sender);
        assertEq(message.routeKey, ROUTE_KEY);
        assertEq(message.payload, SAMPLE_PAYLOAD);

        assertEq(
            uint8(handler.getMessageStatus(messageId)),
            uint8(CrossChainHandler.MessageStatus.Validated)
        );
    }

    function test_HandleMessage_RevertsForUnknownRoute() public {
        vm.expectRevert(
            abi.encodeWithSelector(CrossChainHandler.CrossChainHandler__RouteNotFound.selector, keccak256("missing"))
        );
        handler.handleMessage(101, 102, sender, keccak256("missing"), SAMPLE_PAYLOAD);
    }

    function test_HandleMessage_RevertsForEmptyPayload() public {
        vm.expectRevert(CrossChainHandler.CrossChainHandler__InvalidPayload.selector);
        handler.handleMessage(101, 102, sender, ROUTE_KEY, "");
    }

    function test_QueryHelpers_ReturnTrackedValues() public {
        bytes32 messageId = handler.handleMessage(101, 102, sender, ROUTE_KEY, SAMPLE_PAYLOAD);

        bytes32[] memory ids = handler.getMessagesForSender(sender);
        assertEq(ids.length, 1);
        assertEq(ids[0], messageId);

        assertEq(handler.totalMessages(), 1);
        assertEq(handler.totalValidated(), 1);
    }
}
