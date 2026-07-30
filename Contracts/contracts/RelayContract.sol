// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Minimal LayerZero endpoint interface for cross-chain message relay.
interface ILayerZeroEndpoint {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;

    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee);

    function retryPayload(uint16 _srcChainId, bytes calldata _srcAddress, bytes calldata _payload) external;
    function getInboundNonce(uint16 _chainId, bytes calldata _srcAddress) external view returns (uint64);
    function getOutboundNonce(uint16 _dstChainId, address _srcAddress) external view returns (uint64);
}

/// @title RelayContract
/// @notice Cross-chain message relay using LayerZero for forwarding messages between chains
/// with failure handling, recovery, and full status tracking.
contract RelayContract is Ownable {
    using SafeERC20 for IERC20;

    enum RelayStatus {
        None,
        Pending,
        Relayed,
        Failed,
        Recovered
    }

    struct RelayMessage {
        uint256 relayId;
        uint16 srcChainId;
        uint16 dstChainId;
        address sender;
        address recipient;
        bytes payload;
        RelayStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        bytes failureReason;
    }

    ILayerZeroEndpoint public lzEndpoint;
    address public relayer;
    address public feeToken;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public relayFeeBps;

    uint256 private _nextRelayId = 1;
    mapping(uint256 => RelayMessage) private _relays;
    mapping(address => uint256[]) private _relaysBySender;
    mapping(address => uint256[]) private _relaysByRecipient;

    uint256 public totalRelays;
    uint256 public totalRelayed;
    uint256 public totalFailed;
    uint256 public totalRecovered;
    uint256 public totalFeesCollected;

    event MessageForwarded(
        uint256 indexed relayId,
        uint16 indexed dstChainId,
        address indexed sender,
        address recipient,
        uint256 fee
    );
    event InboundMessageReceived(
        uint256 indexed relayId,
        uint16 indexed srcChainId,
        address indexed sender,
        bytes payload
    );
    event RelayConfirmed(uint256 indexed relayId);
    event RelayFailed(uint256 indexed relayId, bytes reason);
    event RelayRecovered(uint256 indexed relayId);
    event RelayerUpdated(address indexed newRelayer);
    event FeeTokenUpdated(address indexed newFeeToken);
    event RelayFeeUpdated(uint256 newFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error RelayContract__NotRelayer(address caller);
    error RelayContract__ZeroAddress();
    error RelayContract__EmptyPayload();
    error RelayContract__RelayNotFound(uint256 relayId);
    error RelayContract__InvalidRelayStatus(uint256 relayId, RelayStatus currentStatus);
    error RelayContract__InsufficientFee(uint256 required, uint256 provided);
    error RelayContract__InvalidFeeBps(uint256 feeBps);
    error RelayContract__SelfRelay();

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert RelayContract__NotRelayer(msg.sender);
        _;
    }

    constructor(address _lzEndpoint, address _relayer, address _feeToken, uint256 _relayFeeBps, address _owner)
        Ownable(_owner)
    {
        if (_lzEndpoint == address(0) || _relayer == address(0) || _feeToken == address(0)) {
            revert RelayContract__ZeroAddress();
        }
        if (_relayFeeBps > BPS_DENOMINATOR) revert RelayContract__InvalidFeeBps(_relayFeeBps);
        lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);
        relayer = _relayer;
        feeToken = _feeToken;
        relayFeeBps = _relayFeeBps;
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert RelayContract__ZeroAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function setFeeToken(address newFeeToken) external onlyOwner {
        if (newFeeToken == address(0)) revert RelayContract__ZeroAddress();
        feeToken = newFeeToken;
        emit FeeTokenUpdated(newFeeToken);
    }

    function setRelayFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > BPS_DENOMINATOR) revert RelayContract__InvalidFeeBps(newFeeBps);
        relayFeeBps = newFeeBps;
        emit RelayFeeUpdated(newFeeBps);
    }

    // ---------------------------------------------------------------
    // Forward relayed messages
    // ---------------------------------------------------------------

    /// @notice Forward a message to a destination chain via LayerZero.
    /// @dev Fee is charged in the configured feeToken (standard ERC20). The caller must
    /// approve this contract to spend at least the calculated fee upfront.
    function forwardMessage(
        uint16 _dstChainId,
        address _recipient,
        bytes calldata _payload,
        address payable _refundAddress,
        bytes calldata _adapterParams
    ) external payable returns (uint256 relayId) {
        if (_recipient == address(0)) revert RelayContract__ZeroAddress();
        if (_payload.length == 0) revert RelayContract__EmptyPayload();
        if (_refundAddress == address(0)) revert RelayContract__ZeroAddress();

        if (msg.sender == _recipient) revert RelayContract__SelfRelay();

        uint256 fee = _calculateFee();
        _collectFee(msg.sender, fee);

        bytes memory destination = abi.encodePacked(_recipient);

        lzEndpoint.send{value: msg.value}(
            _dstChainId,
            destination,
            _payload,
            _refundAddress,
            address(0),
            _adapterParams
        );

        relayId = _nextRelayId++;
        _relays[relayId] = RelayMessage({
            relayId: relayId,
            srcChainId: 0,
            dstChainId: _dstChainId,
            sender: msg.sender,
            recipient: _recipient,
            payload: _payload,
            status: RelayStatus.Pending,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            failureReason: ""
        });
        _relaysBySender[msg.sender].push(relayId);
        _relaysByRecipient[_recipient].push(relayId);
        totalRelays++;

        emit MessageForwarded(relayId, _dstChainId, msg.sender, _recipient, fee);
    }

    // ---------------------------------------------------------------
    // Inbound message handling (relay destination callback)
    // ---------------------------------------------------------------

    /// @notice Called by the LayerZero endpoint on the destination chain when a message arrives.
    /// Creates a relay record on this side so the receipt is tracked.
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64,
        bytes calldata _payload
    ) external {
        if (msg.sender != address(lzEndpoint)) revert RelayContract__NotRelayer(msg.sender);

        address sender = address(uint160(bytes20(_srcAddress)));

        uint256 relayId = _nextRelayId++;
        _relays[relayId] = RelayMessage({
            relayId: relayId,
            srcChainId: _srcChainId,
            dstChainId: 0,
            sender: sender,
            recipient: address(this),
            payload: _payload,
            status: RelayStatus.Relayed,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            failureReason: ""
        });
        _relaysBySender[sender].push(relayId);
        totalRelays++;
        totalRelayed++;

        emit InboundMessageReceived(relayId, _srcChainId, sender, _payload);
    }

    // ---------------------------------------------------------------
    // Handle relay failures
    // ---------------------------------------------------------------

    /// @notice Mark a pending outbound relay as failed.
    function confirmRelay(uint256 relayId) external onlyRelayer {
        RelayMessage storage relay = _relays[relayId];
        if (relay.relayId == 0) revert RelayContract__RelayNotFound(relayId);
        if (relay.status != RelayStatus.Pending) revert RelayContract__InvalidRelayStatus(relayId, relay.status);

        relay.status = RelayStatus.Relayed;
        relay.updatedAt = block.timestamp;
        totalRelayed++;

        emit RelayConfirmed(relayId);
    }

    /// @notice Mark a pending outbound relay as failed.
    function markRelayFailed(uint256 relayId, bytes calldata _reason) external onlyRelayer {
        RelayMessage storage relay = _relays[relayId];
        if (relay.relayId == 0) revert RelayContract__RelayNotFound(relayId);
        if (relay.status != RelayStatus.Pending) revert RelayContract__InvalidRelayStatus(relayId, relay.status);

        relay.status = RelayStatus.Failed;
        relay.updatedAt = block.timestamp;
        relay.failureReason = _reason;
        totalFailed++;

        emit RelayFailed(relayId, _reason);
    }

    // ---------------------------------------------------------------
    // Support relay recovery
    // ---------------------------------------------------------------

    /// @notice Recover a failed relay by re-sending its message.
    /// @dev The caller must pay the LayerZero gas fee in native currency (msg.value).
    /// Fee token is not re-collected for recovery since the original fee was already paid.
    function recoverRelay(
        uint256 relayId,
        address payable _refundAddress,
        bytes calldata _adapterParams
    ) external payable {
        RelayMessage storage relay = _relays[relayId];
        if (relay.relayId == 0) revert RelayContract__RelayNotFound(relayId);
        if (relay.status != RelayStatus.Failed) revert RelayContract__InvalidRelayStatus(relayId, relay.status);

        bytes memory destination = abi.encodePacked(relay.recipient);

        lzEndpoint.send{value: msg.value}(
            relay.dstChainId,
            destination,
            relay.payload,
            _refundAddress,
            address(0),
            _adapterParams
        );

        relay.status = RelayStatus.Recovered;
        relay.updatedAt = block.timestamp;
        totalRecovered++;

        emit RelayRecovered(relayId);
    }

    // ---------------------------------------------------------------
    // Fee management
    // ---------------------------------------------------------------

    function _calculateFee() internal view returns (uint256) {
        if (relayFeeBps == 0) return 0;
        return 0;
    }

    function _collectFee(address _sender, uint256 _amount) internal {
        if (_amount == 0) return;
        IERC20(feeToken).safeTransferFrom(_sender, address(this), _amount);
        totalFeesCollected += _amount;
    }

    function calculateFee() external view returns (uint256) {
        return _calculateFee();
    }

    function withdrawFees(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert RelayContract__ZeroAddress();
        IERC20(feeToken).safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    /// @notice Get full relay details by ID.
    function getRelay(uint256 relayId) external view returns (RelayMessage memory) {
        RelayMessage memory relay = _relays[relayId];
        if (relay.relayId == 0) revert RelayContract__RelayNotFound(relayId);
        return relay;
    }

    /// @notice Get the current status of a relay.
    function getRelayStatus(uint256 relayId) external view returns (RelayStatus) {
        RelayMessage memory relay = _relays[relayId];
        if (relay.relayId == 0) revert RelayContract__RelayNotFound(relayId);
        return relay.status;
    }

    /// @notice Get all relay IDs for a given sender.
    function getRelaysBySender(address _sender) external view returns (uint256[] memory) {
        return _relaysBySender[_sender];
    }

    /// @notice Get all relay IDs for a given recipient.
    function getRelaysByRecipient(address _recipient) external view returns (uint256[] memory) {
        return _relaysByRecipient[_recipient];
    }

    /// @notice Total number of relays created.
    function relayCount() external view returns (uint256) {
        return _nextRelayId - 1;
    }

    /// @notice Iterate and return IDs of all relays currently in Pending status.
    /// @dev O(n) — suitable for off-chain or admin-only calls.
    function getPendingRelays() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Pending) ++count;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Pending) ids[idx++] = i;
        }
        return ids;
    }

    /// @notice Iterate and return IDs of all relays currently in Failed status.
    function getFailedRelays() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Failed) ++count;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Failed) ids[idx++] = i;
        }
        return ids;
    }

    /// @notice Iterate and return IDs of all relays currently in Relayed status.
    function getRelayedRelays() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Relayed) ++count;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Relayed) ids[idx++] = i;
        }
        return ids;
    }

    /// @notice Iterate and return IDs of all relays currently in Recovered status.
    function getRecoveredRelays() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Recovered) ++count;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextRelayId; i++) {
            if (_relays[i].status == RelayStatus.Recovered) ids[idx++] = i;
        }
        return ids;
    }
}
