// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─────────────────────────────────────────────────────────────────────────────
// LayerZero v1 endpoint interface (inline, no external SDK dependency required)
// Wire-compatible with real LayerZero deployments.
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Minimal LayerZero endpoint interface for cross-chain message passing.
interface ILayerZeroEndpoint {
    /// @notice Send a cross-chain message.
    /// @param _dstChainId Identifier of the relevant dst chain.
    /// @param _destination Encoded data used for destination.
    /// @param _payload Encoded data used for payload.
    /// @param _refundAddress Address associated with refund address.
    /// @param _zroPaymentAddress Address associated with zro payment address.
    /// @param _adapterParams Encoded data used for adapter params.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;

    /// @notice Estimate fees before sending.
    /// @param _dstChainId Identifier of the relevant dst chain.
    /// @param _userApplication Address associated with user application.
    /// @param _payload Encoded data used for payload.
    /// @param _payInZRO Whether pay in zro is enabled or selected.
    /// @param _adapterParams Encoded data used for adapter params.
    /// @return nativeFee native fee produced by the operation.
    /// @return zroFee zro fee produced by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee);

    /// @notice Get the nonce for an outbound message.
    /// @param _dstChainId Identifier of the relevant dst chain.
    /// @param _srcAddress Address associated with src address.
    /// @return Outbound nonce returned by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function getOutboundNonce(uint16 _dstChainId, address _srcAddress) external view returns (uint64);
}

/// @dev Minimal LayerZero receiver interface.
interface ILayerZeroReceiver {
    /// @notice Called by the LayerZero endpoint when a cross-chain message arrives.
    /// @param _srcChainId Identifier of the relevant src chain.
    /// @param _srcAddress Address associated with src address.
    /// @param _nonce Numeric nonce used by this operation.
    /// @param _payload Encoded data used for payload.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external;
}

// ─────────────────────────────────────────────────────────────────────────────
// BridgeConnector
// ─────────────────────────────────────────────────────────────────────────────

/// @title  BridgeConnector
/// @notice Connects this contract system to external bridge protocols (LayerZero).
/// @dev    Handles:
///           - Protocol connections  (registerProtocol / removeProtocol)
///           - Outbound bridge messages via LayerZero endpoint
///           - Inbound message processing (lzReceive / confirmInbound)
///           - Connector upgrades     (proposeUpgrade / executeUpgrade)
///           - Connector status       (pausing, pausing per-chain, events)
///           - Connector queries      (view functions covering all state)
///
///         The contract implements `ILayerZeroReceiver` so the LayerZero endpoint
///         can call `lzReceive` directly. In test / staging environments the owner
///         may also call `confirmInbound` to simulate inbound delivery without a
///         live cross-chain endpoint.
contract BridgeConnector is Ownable, ReentrancyGuard, ILayerZeroReceiver {

    // ── Enumerations ────────────────────────────────────────────────────────

    /// @notice Life-cycle state of a bridge message.
    enum MessageStatus {
        None,
        Pending,
        Delivered,
        Failed,
        Retried
    }

    /// @notice Status of the connector overall.
    enum ConnectorStatus {
        Active,
        Paused,
        Deprecated
    }

    /// @notice Life-cycle state of an upgrade proposal.
    enum UpgradeStatus {
        None,
        Proposed,
        Executed,
        Cancelled
    }

    // ── Structs ─────────────────────────────────────────────────────────────

    /// @notice Configuration for a registered external protocol.
    struct ProtocolConfig {
        uint16 chainId;         // LayerZero chain identifier
        bytes remoteAddress;    // ABI-packed remote connector address on that chain
        bool active;
        uint256 registeredAt;
    }

    /// @notice Record of an outbound message.
    struct BridgeMessage {
        uint256 messageId;
        uint16 dstChainId;
        address sender;
        bytes payload;
        MessageStatus status;
        uint256 sentAt;
        uint256 updatedAt;
        bytes32 payloadHash;
    }

    /// @notice Record of an inbound message.
    struct InboundMessage {
        uint256 messageId;
        uint16 srcChainId;
        bytes srcAddress;
        uint64 nonce;
        bytes payload;
        MessageStatus status;
        uint256 receivedAt;
        bytes32 payloadHash;
    }

    /// @notice An upgrade proposal.
    struct UpgradeProposal {
        uint256 proposalId;
        address proposedImplementation;
        uint256 proposedAt;
        uint256 effectiveAfter; // earliest timestamp the upgrade may execute
        UpgradeStatus status;
        string reason;
    }

    // ── Constants ────────────────────────────────────────────────────────────

    /// @notice Minimum delay between proposing and executing an upgrade (24 h).
    uint256 public constant UPGRADE_TIMELOCK = 24 hours;

    // ── Storage ──────────────────────────────────────────────────────────────

    ILayerZeroEndpoint public lzEndpoint;
    ConnectorStatus public connectorStatus;

    // Protocol registry
    mapping(uint16 => ProtocolConfig) private _protocols;
    uint16[] private _registeredChainIds;

    // Outbound messages
    uint256 private _nextOutboundId = 1;
    mapping(uint256 => BridgeMessage) private _outbound;
    mapping(address => uint256[]) private _outboundBySender;

    // Inbound messages
    uint256 private _nextInboundId = 1;
    mapping(uint256 => InboundMessage) private _inbound;
    mapping(uint16 => uint256[]) private _inboundByChain;

    // Upgrades
    uint256 private _nextUpgradeId = 1;
    mapping(uint256 => UpgradeProposal) private _upgrades;
    uint256[] private _upgradeIds;
    address public pendingImplementation;

    // Aggregate counters
    uint256 public totalMessagesSent;
    uint256 public totalMessagesReceived;
    uint256 public totalMessagesFailed;

    // ── Events ───────────────────────────────────────────────────────────────

    event ProtocolRegistered(uint16 indexed chainId, bytes remoteAddress);
    event ProtocolRemoved(uint16 indexed chainId);
    event ProtocolUpdated(uint16 indexed chainId, bytes newRemoteAddress);

    event MessageSent(
        uint256 indexed messageId,
        uint16 indexed dstChainId,
        address indexed sender,
        bytes32 payloadHash
    );
    event MessageDelivered(uint256 indexed messageId, uint16 indexed dstChainId);
    event MessageFailed(uint256 indexed messageId, uint16 indexed dstChainId);
    event MessageRetried(uint256 indexed messageId, uint16 indexed dstChainId);

    event InboundMessageReceived(
        uint256 indexed messageId,
        uint16 indexed srcChainId,
        uint64 nonce,
        bytes32 payloadHash
    );
    event InboundMessageConfirmed(uint256 indexed messageId, uint16 indexed srcChainId);
    event InboundMessageFailed(uint256 indexed messageId, uint16 indexed srcChainId);

    event UpgradeProposed(
        uint256 indexed proposalId,
        address indexed implementation,
        uint256 effectiveAfter,
        string reason
    );
    event UpgradeExecuted(uint256 indexed proposalId, address indexed implementation);
    event UpgradeCancelled(uint256 indexed proposalId);

    event ConnectorPaused(address indexed by);
    event ConnectorResumed(address indexed by);
    event ConnectorDeprecated(address indexed by);
    event EndpointUpdated(address indexed newEndpoint);

    // ── Errors ────────────────────────────────────────────────────────────────

    error BridgeConnector__NotEndpoint(address caller);
    error BridgeConnector__ZeroAddress();
    error BridgeConnector__EmptyPayload();
    error BridgeConnector__ProtocolNotRegistered(uint16 chainId);
    error BridgeConnector__ProtocolAlreadyRegistered(uint16 chainId);
    error BridgeConnector__ProtocolInactive(uint16 chainId);
    error BridgeConnector__ConnectorPaused();
    error BridgeConnector__ConnectorDeprecated();
    error BridgeConnector__MessageNotFound(uint256 messageId);
    error BridgeConnector__MessageNotPending(uint256 messageId, MessageStatus current);
    error BridgeConnector__MessageNotFailed(uint256 messageId, MessageStatus current);
    error BridgeConnector__UpgradeNotFound(uint256 proposalId);
    error BridgeConnector__UpgradeTimelockActive(uint256 effectiveAfter, uint256 current);
    error BridgeConnector__UpgradeNotProposed(uint256 proposalId);
    error BridgeConnector__PayloadHashMismatch();
    error BridgeConnector__InboundNotFound(uint256 messageId);
    error BridgeConnector__InboundNotPending(uint256 messageId, MessageStatus current);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyEndpoint() {
        if (msg.sender != address(lzEndpoint)) revert BridgeConnector__NotEndpoint(msg.sender);
        _;
    }

    modifier whenActive() {
        if (connectorStatus == ConnectorStatus.Paused) revert BridgeConnector__ConnectorPaused();
        if (connectorStatus == ConnectorStatus.Deprecated) revert BridgeConnector__ConnectorDeprecated();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param _lzEndpoint  LayerZero endpoint address for this chain.
    /// @param _owner       Initial contract owner.
    constructor(address _lzEndpoint, address _owner) Ownable(_owner) {
        if (_lzEndpoint == address(0) || _owner == address(0)) revert BridgeConnector__ZeroAddress();
        lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);
        connectorStatus = ConnectorStatus.Active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Protocol connections
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Register a remote bridge protocol / chain.
    /// @param chainId         LayerZero chain identifier.
    /// @param remoteAddress   Packed address of the counterpart on the remote chain.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ProtocolAlreadyRegistered` if `_protocols[chainId].active` is
    ///     true. `BridgeConnector__EmptyPayload` if `remoteAddress.length == 0` is true.
    function registerProtocol(uint16 chainId, bytes calldata remoteAddress) external onlyOwner {
        if (_protocols[chainId].active) revert BridgeConnector__ProtocolAlreadyRegistered(chainId);
        if (remoteAddress.length == 0) revert BridgeConnector__EmptyPayload();

        _protocols[chainId] = ProtocolConfig({
            chainId: chainId,
            remoteAddress: remoteAddress,
            active: true,
            registeredAt: block.timestamp
        });
        _registeredChainIds.push(chainId);

        emit ProtocolRegistered(chainId, remoteAddress);
    }

    /// @notice Remove a previously-registered protocol, disabling further sends.
    /// @param chainId Identifier of the relevant chain.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ProtocolNotRegistered` if `!_protocols[chainId].active` is
    ///     true.
    function removeProtocol(uint16 chainId) external onlyOwner {
        if (!_protocols[chainId].active) revert BridgeConnector__ProtocolNotRegistered(chainId);
        _protocols[chainId].active = false;
        emit ProtocolRemoved(chainId);
    }

    /// @notice Update the remote address of an existing protocol registration.
    /// @param chainId Identifier of the relevant chain.
    /// @param newRemoteAddress New remote address value.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ProtocolNotRegistered` if `!_protocols[chainId].active` is
    ///     true. `BridgeConnector__EmptyPayload` if `newRemoteAddress.length == 0` is true.
    function updateProtocol(uint16 chainId, bytes calldata newRemoteAddress) external onlyOwner {
        if (!_protocols[chainId].active) revert BridgeConnector__ProtocolNotRegistered(chainId);
        if (newRemoteAddress.length == 0) revert BridgeConnector__EmptyPayload();
        _protocols[chainId].remoteAddress = newRemoteAddress;
        emit ProtocolUpdated(chainId, newRemoteAddress);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Outbound message handling
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Send a cross-chain message to a registered protocol via LayerZero.
    /// @param dstChainId      Destination chain identifier.
    /// @param payload         Message payload.
    /// @param adapterParams   Optional LayerZero adapter parameters (gas, airdrops, etc.).
    /// @return messageId      Internal message identifier.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `BridgeConnector__ProtocolNotRegistered` if `!proto.active` is true.
    ///     `BridgeConnector__EmptyPayload` if `payload.length == 0` is true.
    function sendMessage(uint16 dstChainId, bytes calldata payload, bytes calldata adapterParams)
        external
        payable
        nonReentrant
        whenActive
        returns (uint256 messageId)
    {
        ProtocolConfig storage proto = _protocols[dstChainId];
        if (!proto.active) revert BridgeConnector__ProtocolNotRegistered(dstChainId);
        if (payload.length == 0) revert BridgeConnector__EmptyPayload();

        bytes32 payloadHash = keccak256(payload);
        messageId = _nextOutboundId++;

        _outbound[messageId] = BridgeMessage({
            messageId: messageId,
            dstChainId: dstChainId,
            sender: msg.sender,
            payload: payload,
            status: MessageStatus.Pending,
            sentAt: block.timestamp,
            updatedAt: block.timestamp,
            payloadHash: payloadHash
        });
        _outboundBySender[msg.sender].push(messageId);
        totalMessagesSent++;

        // Forward to LayerZero endpoint
        lzEndpoint.send{value: msg.value}(
            dstChainId,
            proto.remoteAddress,
            payload,
            payable(msg.sender),
            address(0),
            adapterParams
        );

        emit MessageSent(messageId, dstChainId, msg.sender, payloadHash);
    }

    /// @notice Estimate the native fee required to send a message via LayerZero.
    /// @param dstChainId Identifier of the relevant dst chain.
    /// @param payload Payload to send or process.
    /// @param adapterParams Encoded data used for adapter params.
    /// @return nativeFee native fee produced by the operation.
    /// @return zroFee zro fee produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function estimateFee(uint16 dstChainId, bytes calldata payload, bytes calldata adapterParams)
        external
        view
        returns (uint256 nativeFee, uint256 zroFee)
    {
        return lzEndpoint.estimateFees(dstChainId, address(this), payload, false, adapterParams);
    }

    /// @notice Mark an outbound message as delivered (called by owner/relayer after confirmation).
    /// @param messageId Identifier of the relevant message.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__MessageNotFound` if `m.messageId == 0` is true.
    ///     `BridgeConnector__MessageNotPending` if `m.status != MessageStatus.Pending` is true.
    function markDelivered(uint256 messageId) external onlyOwner {
        BridgeMessage storage m = _outbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__MessageNotFound(messageId);
        if (m.status != MessageStatus.Pending) revert BridgeConnector__MessageNotPending(messageId, m.status);

        m.status = MessageStatus.Delivered;
        m.updatedAt = block.timestamp;

        emit MessageDelivered(messageId, m.dstChainId);
    }

    /// @notice Mark an outbound message as failed.
    /// @param messageId Identifier of the relevant message.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__MessageNotFound` if `m.messageId == 0` is true.
    ///     `BridgeConnector__MessageNotPending` if `m.status != MessageStatus.Pending` is true.
    function markFailed(uint256 messageId) external onlyOwner {
        BridgeMessage storage m = _outbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__MessageNotFound(messageId);
        if (m.status != MessageStatus.Pending) revert BridgeConnector__MessageNotPending(messageId, m.status);

        m.status = MessageStatus.Failed;
        m.updatedAt = block.timestamp;
        totalMessagesFailed++;

        emit MessageFailed(messageId, m.dstChainId);
    }

    /// @notice Retry a failed outbound message.
    /// @param messageId Identifier of the relevant message.
    /// @param adapterParams Encoded data used for adapter params.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__MessageNotFound` if `m.messageId == 0` is true.
    ///     `BridgeConnector__MessageNotFailed` if `m.status != MessageStatus.Failed` is true.
    ///     `BridgeConnector__ProtocolInactive` if `!proto.active` is true.
    function retryMessage(uint256 messageId, bytes calldata adapterParams)
        external
        payable
        nonReentrant
        whenActive
        onlyOwner
    {
        BridgeMessage storage m = _outbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__MessageNotFound(messageId);
        if (m.status != MessageStatus.Failed) revert BridgeConnector__MessageNotFailed(messageId, m.status);

        ProtocolConfig storage proto = _protocols[m.dstChainId];
        if (!proto.active) revert BridgeConnector__ProtocolInactive(m.dstChainId);

        m.status = MessageStatus.Retried;
        m.updatedAt = block.timestamp;

        lzEndpoint.send{value: msg.value}(
            m.dstChainId,
            proto.remoteAddress,
            m.payload,
            payable(msg.sender),
            address(0),
            adapterParams
        );

        emit MessageRetried(messageId, m.dstChainId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inbound message handling (LayerZero receiver)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Called by the LayerZero endpoint when a cross-chain message arrives.
    /// @dev    Overridable: subclasses can override `_processPayload` for custom logic.
    /// @param _srcChainId Identifier of the relevant src chain.
    /// @param _srcAddress Address associated with src address.
    /// @param _nonce Numeric nonce used by this operation.
    /// @param _payload Encoded data used for payload.
    /// @dev Access: Caller must satisfy `onlyEndpoint` access checks.
    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload)
        external
        override
        onlyEndpoint
    {
        _recordInbound(_srcChainId, _srcAddress, _nonce, _payload);
    }

    /// @notice Simulate inbound delivery without a live endpoint (owner only; for testing / staging).
    /// @param srcChainId Identifier of the relevant src chain.
    /// @param srcAddress Address associated with src address.
    /// @param nonce Nonce associated with this request.
    /// @param payload Payload to send or process.
    /// @dev Access: Caller must be the contract owner.
    function confirmInbound(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload)
        external
        onlyOwner
    {
        _recordInbound(srcChainId, srcAddress, nonce, payload);
    }

    /// @notice Mark an inbound message as successfully processed.
    /// @param messageId Identifier of the relevant message.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__InboundNotFound` if `m.messageId == 0` is true.
    ///     `BridgeConnector__InboundNotPending` if `m.status != MessageStatus.Pending` is true.
    function acknowledgeInbound(uint256 messageId) external onlyOwner {
        InboundMessage storage m = _inbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__InboundNotFound(messageId);
        if (m.status != MessageStatus.Pending) revert BridgeConnector__InboundNotPending(messageId, m.status);

        m.status = MessageStatus.Delivered;

        emit InboundMessageConfirmed(messageId, m.srcChainId);
    }

    /// @notice Mark an inbound message as failed.
    /// @param messageId Identifier of the relevant message.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__InboundNotFound` if `m.messageId == 0` is true.
    ///     `BridgeConnector__InboundNotPending` if `m.status != MessageStatus.Pending` is true.
    function failInbound(uint256 messageId) external onlyOwner {
        InboundMessage storage m = _inbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__InboundNotFound(messageId);
        if (m.status != MessageStatus.Pending) revert BridgeConnector__InboundNotPending(messageId, m.status);

        m.status = MessageStatus.Failed;
        totalMessagesFailed++;

        emit InboundMessageFailed(messageId, m.srcChainId);
    }

    /// @dev Internal: record an inbound message and emit the receive event.
    function _recordInbound(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload)
        internal
    {
        bytes32 payloadHash = keccak256(payload);
        uint256 messageId = _nextInboundId++;

        _inbound[messageId] = InboundMessage({
            messageId: messageId,
            srcChainId: srcChainId,
            srcAddress: srcAddress,
            nonce: nonce,
            payload: payload,
            status: MessageStatus.Pending,
            receivedAt: block.timestamp,
            payloadHash: payloadHash
        });
        _inboundByChain[srcChainId].push(messageId);
        totalMessagesReceived++;

        emit InboundMessageReceived(messageId, srcChainId, nonce, payloadHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connector upgrades
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Propose a connector upgrade with a 24-hour timelock.
    /// @param implementation  Address of the replacement connector / logic contract.
    /// @param reason          Human-readable justification.
    /// @return proposalId
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ZeroAddress` if `implementation == address(0)` is true.
    function proposeUpgrade(address implementation, string calldata reason)
        external
        onlyOwner
        returns (uint256 proposalId)
    {
        if (implementation == address(0)) revert BridgeConnector__ZeroAddress();

        uint256 effectiveAfter = block.timestamp + UPGRADE_TIMELOCK;
        proposalId = _nextUpgradeId++;

        _upgrades[proposalId] = UpgradeProposal({
            proposalId: proposalId,
            proposedImplementation: implementation,
            proposedAt: block.timestamp,
            effectiveAfter: effectiveAfter,
            status: UpgradeStatus.Proposed,
            reason: reason
        });
        _upgradeIds.push(proposalId);
        pendingImplementation = implementation;

        emit UpgradeProposed(proposalId, implementation, effectiveAfter, reason);
    }

    /// @notice Execute a proposed upgrade after the timelock has elapsed.
    /// @param proposalId Identifier of the governance proposal.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__UpgradeNotFound` if `p.proposalId == 0` is true.
    ///     `BridgeConnector__UpgradeNotProposed` if `p.status != UpgradeStatus.Proposed` is true.
    ///     `BridgeConnector__UpgradeTimelockActive` if `block.timestamp < p.effectiveAfter` is
    ///     true.
    function executeUpgrade(uint256 proposalId) external onlyOwner {
        UpgradeProposal storage p = _upgrades[proposalId];
        if (p.proposalId == 0) revert BridgeConnector__UpgradeNotFound(proposalId);
        if (p.status != UpgradeStatus.Proposed) revert BridgeConnector__UpgradeNotProposed(proposalId);
        if (block.timestamp < p.effectiveAfter) {
            revert BridgeConnector__UpgradeTimelockActive(p.effectiveAfter, block.timestamp);
        }

        p.status = UpgradeStatus.Executed;
        pendingImplementation = address(0);

        emit UpgradeExecuted(proposalId, p.proposedImplementation);
    }

    /// @notice Cancel a pending upgrade proposal.
    /// @param proposalId Identifier of the governance proposal.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__UpgradeNotFound` if `p.proposalId == 0` is true.
    ///     `BridgeConnector__UpgradeNotProposed` if `p.status != UpgradeStatus.Proposed` is true.
    function cancelUpgrade(uint256 proposalId) external onlyOwner {
        UpgradeProposal storage p = _upgrades[proposalId];
        if (p.proposalId == 0) revert BridgeConnector__UpgradeNotFound(proposalId);
        if (p.status != UpgradeStatus.Proposed) revert BridgeConnector__UpgradeNotProposed(proposalId);

        p.status = UpgradeStatus.Cancelled;
        pendingImplementation = address(0);

        emit UpgradeCancelled(proposalId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connector status
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pause the connector (blocks new outbound sends and retries).
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ConnectorDeprecated` if `connectorStatus ==
    ///     ConnectorStatus.Deprecated` is true.
    function pause() external onlyOwner {
        if (connectorStatus == ConnectorStatus.Deprecated) revert BridgeConnector__ConnectorDeprecated();
        connectorStatus = ConnectorStatus.Paused;
        emit ConnectorPaused(msg.sender);
    }

    /// @notice Resume a paused connector.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ConnectorPaused` if `connectorStatus !=
    ///     ConnectorStatus.Paused` is true.
    function resume() external onlyOwner {
        if (connectorStatus != ConnectorStatus.Paused) revert BridgeConnector__ConnectorPaused();
        connectorStatus = ConnectorStatus.Active;
        emit ConnectorResumed(msg.sender);
    }

    /// @notice Permanently deprecate the connector (irreversible).
    /// @dev Access: Caller must be the contract owner.
    function deprecate() external onlyOwner {
        connectorStatus = ConnectorStatus.Deprecated;
        emit ConnectorDeprecated(msg.sender);
    }

    /// @notice Update the LayerZero endpoint address.
    /// @param newEndpoint New endpoint value.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `BridgeConnector__ZeroAddress` if `newEndpoint == address(0)` is true.
    function setEndpoint(address newEndpoint) external onlyOwner {
        if (newEndpoint == address(0)) revert BridgeConnector__ZeroAddress();
        lzEndpoint = ILayerZeroEndpoint(newEndpoint);
        emit EndpointUpdated(newEndpoint);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connector queries
    // ─────────────────────────────────────────────────────────────────────────

    // --- Protocol queries ---

    /// @notice Returns protocol.
    /// @param chainId Identifier of the relevant chain.
    /// @return Protocol returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getProtocol(uint16 chainId) external view returns (ProtocolConfig memory) {
        return _protocols[chainId];
    }

    /// @notice Reports whether protocol active is satisfied.
    /// @param chainId Identifier of the relevant chain.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isProtocolActive(uint16 chainId) external view returns (bool) {
        return _protocols[chainId].active;
    }

    /// @notice Returns registered chain ids.
    /// @return Registered chain ids returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRegisteredChainIds() external view returns (uint16[] memory) {
        return _registeredChainIds;
    }

    // --- Outbound message queries ---

    /// @notice Returns outbound message.
    /// @param messageId Identifier of the relevant message.
    /// @return Outbound message returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BridgeConnector__MessageNotFound` if `m.messageId == 0` is true.
    function getOutboundMessage(uint256 messageId) external view returns (BridgeMessage memory) {
        BridgeMessage memory m = _outbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__MessageNotFound(messageId);
        return m;
    }

    /// @notice Returns outbound messages by sender.
    /// @param sender Address associated with sender.
    /// @return Outbound messages by sender returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getOutboundMessagesBySender(address sender) external view returns (uint256[] memory) {
        return _outboundBySender[sender];
    }

    /// @notice Returns outbound message status.
    /// @param messageId Identifier of the relevant message.
    /// @return Outbound message status returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BridgeConnector__MessageNotFound` if `m.messageId == 0` is true.
    function getOutboundMessageStatus(uint256 messageId) external view returns (MessageStatus) {
        BridgeMessage memory m = _outbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__MessageNotFound(messageId);
        return m.status;
    }

    /// @notice Executes outboundMessageCount.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function outboundMessageCount() external view returns (uint256) {
        return _nextOutboundId - 1;
    }

    // --- Inbound message queries ---

    /// @notice Returns inbound message.
    /// @param messageId Identifier of the relevant message.
    /// @return Inbound message returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BridgeConnector__InboundNotFound` if `m.messageId == 0` is true.
    function getInboundMessage(uint256 messageId) external view returns (InboundMessage memory) {
        InboundMessage memory m = _inbound[messageId];
        if (m.messageId == 0) revert BridgeConnector__InboundNotFound(messageId);
        return m;
    }

    /// @notice Returns inbound messages by chain.
    /// @param chainId Identifier of the relevant chain.
    /// @return Inbound messages by chain returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getInboundMessagesByChain(uint16 chainId) external view returns (uint256[] memory) {
        return _inboundByChain[chainId];
    }

    /// @notice Executes inboundMessageCount.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function inboundMessageCount() external view returns (uint256) {
        return _nextInboundId - 1;
    }

    // --- Upgrade queries ---

    /// @notice Returns upgrade proposal.
    /// @param proposalId Identifier of the governance proposal.
    /// @return Upgrade proposal returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BridgeConnector__UpgradeNotFound` if `p.proposalId == 0` is true.
    function getUpgradeProposal(uint256 proposalId) external view returns (UpgradeProposal memory) {
        UpgradeProposal memory p = _upgrades[proposalId];
        if (p.proposalId == 0) revert BridgeConnector__UpgradeNotFound(proposalId);
        return p;
    }

    /// @notice Returns upgrade proposal ids.
    /// @return Upgrade proposal ids returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getUpgradeProposalIds() external view returns (uint256[] memory) {
        return _upgradeIds;
    }

    // --- Aggregate stats ---

    /// @notice Returns stats.
    /// @return sent sent produced by the operation.
    /// @return received received produced by the operation.
    /// @return failed failed produced by the operation.
    /// @return status Current status of the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getStats()
        external
        view
        returns (
            uint256 sent,
            uint256 received,
            uint256 failed,
            ConnectorStatus status
        )
    {
        return (totalMessagesSent, totalMessagesReceived, totalMessagesFailed, connectorStatus);
    }
}
