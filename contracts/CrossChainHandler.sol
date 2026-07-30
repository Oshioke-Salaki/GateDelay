// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CrossChainHandler
/// @notice Minimal cross-chain message handler that validates inbound and outbound messages,
/// routes them to registered handlers, and tracks lifecycle status for query access.
contract CrossChainHandler is Ownable {
    enum MessageStatus {
        None,
        Received,
        Validated,
        Failed,
        Completed
    }

    struct CrossChainMessage {
        bytes32 messageId;
        uint16 srcChainId;
        uint16 dstChainId;
        address sender;
        bytes32 routeKey;
        bytes payload;
        MessageStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        address routedTo;
    }

    mapping(bytes32 => CrossChainMessage) private _messages;
    mapping(bytes32 => address) private _routes;
    mapping(address => bytes32[]) private _messagesBySender;

    uint256 private _nextMessageId;

    uint256 public totalMessages;
    uint256 public totalValidated;
    uint256 public totalRouted;

    event RouteRegistered(bytes32 indexed routeKey, address indexed handler);
    event MessageHandled(bytes32 indexed messageId, bytes32 indexed routeKey, address indexed sender);
    event MessageValidated(bytes32 indexed messageId, bytes32 indexed routeKey);
    event MessageRouted(bytes32 indexed messageId, address indexed routedTo);

    error CrossChainHandler__ZeroAddress();
    error CrossChainHandler__InvalidPayload();
    error CrossChainHandler__RouteNotFound(bytes32 routeKey);
    error CrossChainHandler__RouteAlreadyRegistered(bytes32 routeKey);
    error CrossChainHandler__MessageNotFound(bytes32 messageId);

    constructor() Ownable() {}

    function registerRoute(bytes32 routeKey, address handler) external onlyOwner {
        if (handler == address(0)) revert CrossChainHandler__ZeroAddress();
        if (_routes[routeKey] != address(0)) revert CrossChainHandler__RouteAlreadyRegistered(routeKey);

        _routes[routeKey] = handler;
        emit RouteRegistered(routeKey, handler);
    }

    function handleMessage(uint16 srcChainId, uint16 dstChainId, address sender, bytes32 routeKey, bytes calldata payload)
        external
        returns (bytes32 messageId)
    {
        if (sender == address(0)) revert CrossChainHandler__ZeroAddress();
        if (payload.length == 0) revert CrossChainHandler__InvalidPayload();

        address routedTo = _routes[routeKey];
        if (routedTo == address(0)) revert CrossChainHandler__RouteNotFound(routeKey);

        messageId = bytes32(uint256(++_nextMessageId));
        uint256 now_ = block.timestamp;

        _messages[messageId] = CrossChainMessage({
            messageId: messageId,
            srcChainId: srcChainId,
            dstChainId: dstChainId,
            sender: sender,
            routeKey: routeKey,
            payload: payload,
            status: MessageStatus.Received,
            createdAt: now_,
            updatedAt: now_,
            routedTo: routedTo
        });

        _messagesBySender[sender].push(messageId);
        totalMessages++;

        _messages[messageId].status = MessageStatus.Validated;
        _messages[messageId].updatedAt = block.timestamp;
        totalValidated++;
        emit MessageValidated(messageId, routeKey);

        totalRouted++;
        emit MessageRouted(messageId, routedTo);
        emit MessageHandled(messageId, routeKey, sender);
    }

    function getMessage(bytes32 messageId) external view returns (CrossChainMessage memory) {
        CrossChainMessage memory message = _messages[messageId];
        if (message.messageId == 0) revert CrossChainHandler__MessageNotFound(messageId);
        return message;
    }

    function getMessageStatus(bytes32 messageId) external view returns (MessageStatus) {
        CrossChainMessage memory message = _messages[messageId];
        if (message.messageId == 0) revert CrossChainHandler__MessageNotFound(messageId);
        return message.status;
    }

    function getMessagesForSender(address sender) external view returns (bytes32[] memory) {
        return _messagesBySender[sender];
    }

    function getRoute(bytes32 routeKey) external view returns (address) {
        return _routes[routeKey];
    }

    function setMessageStatus(bytes32 messageId, MessageStatus status) external {
        CrossChainMessage storage message = _messages[messageId];
        if (message.messageId == 0) revert CrossChainHandler__MessageNotFound(messageId);
        message.status = status;
        message.updatedAt = block.timestamp;
    }

    function markCompleted(bytes32 messageId) external {
        setMessageStatus(messageId, MessageStatus.Completed);
    }

    function markFailed(bytes32 messageId) external {
        setMessageStatus(messageId, MessageStatus.Failed);
    }
}
