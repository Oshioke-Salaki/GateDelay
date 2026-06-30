// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal reproduction of Chainlink CCIP's public message types for relay operations
library RelayClient {
    struct RelayMessage {
        uint64 sourceChain;
        uint64 destChain;
        bytes32 operationId;
        bytes data;
        uint256 value;
        address executor;
    }

    struct RelayResponse {
        bytes32 operationId;
        bool success;
        bytes result;
    }
}

/// @dev Chainlink CCIP router interface for relay operations
interface IRelayRouter {
    function relayMessage(
        uint64 destChainSelector,
        RelayClient.RelayMessage calldata message
    ) external payable returns (bytes32 messageId);

    function isChainSupported(uint64 chainSelector) external view returns (bool);
}

/// @title MarketRelay
/// @notice Cross-chain market relay system for GateDelay with Chainlink CCIP integration.
/// Handles relay operations with comprehensive status tracking, timeout management, and history.
contract MarketRelay is Ownable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Enums and Structs
    // ---------------------------------------------------------------

    enum RelayStatus {
        None,           // 0: Operation doesn't exist
        Pending,        // 1: Waiting for execution
        Executing,      // 2: Currently executing
        Completed,      // 3: Successfully completed
        Failed,         // 4: Execution failed
        Timeout,        // 5: Operation timed out
        Cancelled       // 6: Operation cancelled
    }

    struct RelayOperation {
        bytes32 operationId;
        address initiator;
        uint64 sourceChain;
        uint64 destChain;
        bytes operationData;
        uint256 value;
        RelayStatus status;
        uint256 createdAt;
        uint256 executedAt;
        uint256 completedAt;
        uint256 timeoutAt;
        uint256 attempts;
        bytes32 ccipMessageId;
        bytes result;
    }

    struct RelayHistory {
        bytes32 operationId;
        address initiator;
        RelayStatus status;
        uint256 createdAt;
        uint256 completedAt;
        uint256 timeoutAt;
        uint256 attempts;
        bytes result;
    }

    struct RelayConfig {
        uint64 chainSelector;
        bool supported;
        uint256 defaultTimeout;     // timeout in seconds
        uint256 maxRetries;
        uint256 retryDelay;         // delay between retries in seconds
        uint256 baseFee;
        uint256 feeBps;             // in basis points (1 bps = 0.01%)
    }

    // ---------------------------------------------------------------
    // State Variables
    // ---------------------------------------------------------------

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MAX_TIMEOUT = 30 days;
    uint256 private constant MIN_TIMEOUT = 1 minutes;
    uint256 private constant MAX_FEE_BPS = 1_000; // 10% hard ceiling

    IRelayRouter public relayRouter;
    address public relayer;
    address public feeRecipient;

    mapping(uint64 => RelayConfig) private _chainConfigs;
    uint64[] private _supportedChainList;

    mapping(bytes32 => RelayOperation) private _relayOperations;
    mapping(address => bytes32[]) private _operationsByInitiator;
    mapping(uint64 => bytes32[]) private _pendingOperationsByChain;

    // History tracking
    mapping(bytes32 => RelayHistory) private _relayHistory;
    bytes32[] private _allOperationHistory;

    // Fee tracking
    uint256 public totalFeesCollected;
    mapping(address => uint256) public userFeesAccrued;

    // Nonce for operation ID generation
    uint256 private _nextNonce = 1;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event ChainConfigured(
        uint64 indexed chainSelector,
        uint256 defaultTimeout,
        uint256 maxRetries,
        uint256 baseFee,
        uint256 feeBps
    );
    event ChainRemoved(uint64 indexed chainSelector);
    event ChainConfigUpdated(
        uint64 indexed chainSelector,
        uint256 newTimeout,
        uint256 newMaxRetries
    );
    event RelayerUpdated(address indexed newRelayer);
    event FeeRecipientUpdated(address indexed newFeeRecipient);
    event RouterUpdated(address indexed newRouter);

    event RelayInitiated(
        bytes32 indexed operationId,
        address indexed initiator,
        uint64 sourceChain,
        uint64 destChain,
        uint256 value,
        uint256 timeoutAt,
        bytes32 ccipMessageId
    );
    event RelayExecuting(bytes32 indexed operationId, uint256 executedAt);
    event RelayCompleted(bytes32 indexed operationId, bytes result, uint256 completedAt);
    event RelayFailed(bytes32 indexed operationId, string reason, uint256 failedAt);
    event RelayTimeout(bytes32 indexed operationId, uint256 timedOutAt);
    event RelayCancelled(bytes32 indexed operationId, uint256 cancelledAt);
    event RelayRetried(bytes32 indexed operationId, uint256 newAttempt, uint256 newTimeoutAt);

    event FeesWithdrawn(address indexed to, uint256 amount);
    event RelayOperationHistoryRecorded(bytes32 indexed operationId, RelayStatus status);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error MarketRelay__NotRelayer(address caller);
    error MarketRelay__NotInitiator(address caller);
    error MarketRelay__ChainNotSupported(uint64 chainSelector);
    error MarketRelay__ChainAlreadyConfigured(uint64 chainSelector);
    error MarketRelay__InvalidTimeout(uint256 timeout);
    error MarketRelay__InvalidFee(uint256 feeBps);
    error MarketRelay__ZeroAddress();
    error MarketRelay__ZeroValue();
    error MarketRelay__OperationNotFound(bytes32 operationId);
    error MarketRelay__InvalidOperationStatus(bytes32 operationId, RelayStatus currentStatus);
    error MarketRelay__OperationAlreadyCompleted(bytes32 operationId);
    error MarketRelay__MaxRetriesExceeded(bytes32 operationId);
    error MarketRelay__InsufficientFundsForFee(uint256 required, uint256 available);
    error MarketRelay__InsufficientRetryDelay(uint256 timeSinceLastAttempt, uint256 requiredDelay);
    error MarketRelay__OperationNotExpired(bytes32 operationId);

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert MarketRelay__NotRelayer(msg.sender);
        _;
    }

    modifier onlyInitiator(bytes32 operationId) {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        if (msg.sender != op.initiator) revert MarketRelay__NotInitiator(msg.sender);
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        address _relayRouter,
        address _relayer,
        address _feeRecipient,
        address _owner
    ) Ownable(_owner) {
        if (_relayRouter == address(0) || _relayer == address(0) || _feeRecipient == address(0)) {
            revert MarketRelay__ZeroAddress();
        }
        relayRouter = IRelayRouter(_relayRouter);
        relayer = _relayer;
        feeRecipient = _feeRecipient;
    }

    // ---------------------------------------------------------------
    // Admin: Chain Configuration
    // ---------------------------------------------------------------

    /// @notice Configure a chain for relay operations
    function configureChain(
        uint64 chainSelector,
        uint256 defaultTimeout,
        uint256 maxRetries,
        uint256 retryDelay,
        uint256 baseFee,
        uint256 feeBps
    ) external onlyOwner {
        if (_chainConfigs[chainSelector].supported) {
            revert MarketRelay__ChainAlreadyConfigured(chainSelector);
        }
        if (defaultTimeout < MIN_TIMEOUT || defaultTimeout > MAX_TIMEOUT) {
            revert MarketRelay__InvalidTimeout(defaultTimeout);
        }
        if (feeBps > MAX_FEE_BPS) revert MarketRelay__InvalidFee(feeBps);

        _chainConfigs[chainSelector] = RelayConfig({
            chainSelector: chainSelector,
            supported: true,
            defaultTimeout: defaultTimeout,
            maxRetries: maxRetries,
            retryDelay: retryDelay,
            baseFee: baseFee,
            feeBps: feeBps
        });
        _supportedChainList.push(chainSelector);

        emit ChainConfigured(chainSelector, defaultTimeout, maxRetries, baseFee, feeBps);
    }

    /// @notice Remove a chain from relay operations
    function removeChain(uint64 chainSelector) external onlyOwner {
        if (!_chainConfigs[chainSelector].supported) {
            revert MarketRelay__ChainNotSupported(chainSelector);
        }
        _chainConfigs[chainSelector].supported = false;
        emit ChainRemoved(chainSelector);
    }

    /// @notice Update chain configuration parameters
    function updateChainConfig(
        uint64 chainSelector,
        uint256 newTimeout,
        uint256 newMaxRetries
    ) external onlyOwner {
        if (!_chainConfigs[chainSelector].supported) {
            revert MarketRelay__ChainNotSupported(chainSelector);
        }
        if (newTimeout < MIN_TIMEOUT || newTimeout > MAX_TIMEOUT) {
            revert MarketRelay__InvalidTimeout(newTimeout);
        }

        _chainConfigs[chainSelector].defaultTimeout = newTimeout;
        _chainConfigs[chainSelector].maxRetries = newMaxRetries;

        emit ChainConfigUpdated(chainSelector, newTimeout, newMaxRetries);
    }

    /// @notice Set the relay operator address
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert MarketRelay__ZeroAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    /// @notice Set the fee recipient address
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert MarketRelay__ZeroAddress();
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }

    /// @notice Set the CCIP router address
    function setRelayRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert MarketRelay__ZeroAddress();
        relayRouter = IRelayRouter(newRouter);
        emit RouterUpdated(newRouter);
    }

    // ---------------------------------------------------------------
    // Fee Calculation
    // ---------------------------------------------------------------

    /// @notice Calculate total fee for a relay operation
    /// @param destChainSelector The destination chain
    /// @param operationValue The value being relayed
    /// @return fee The calculated fee
    function calculateRelayFee(uint64 destChainSelector, uint256 operationValue)
        public
        view
        returns (uint256 fee)
    {
        RelayConfig storage cfg = _chainConfigs[destChainSelector];
        if (!cfg.supported) revert MarketRelay__ChainNotSupported(destChainSelector);

        uint256 proportionalFee = (operationValue * cfg.feeBps) / BPS_DENOMINATOR;
        return cfg.baseFee + proportionalFee;
    }

    // ---------------------------------------------------------------
    // Core Relay Operations
    // ---------------------------------------------------------------

    /// @notice Initiate a relay operation
    /// @param destChainSelector The destination chain for the relay
    /// @param operationData The encoded operation data
    /// @param value The value to relay (optional, for state-changing operations)
    /// @return operationId The unique operation identifier
    function initiateRelay(
        uint64 destChainSelector,
        bytes calldata operationData,
        uint256 value
    ) external payable returns (bytes32 operationId) {
        RelayConfig storage cfg = _chainConfigs[destChainSelector];
        if (!cfg.supported) revert MarketRelay__ChainNotSupported(destChainSelector);
        if (operationData.length == 0) revert MarketRelay__ZeroValue();

        uint256 fee = calculateRelayFee(destChainSelector, value);
        if (msg.value < fee) {
            revert MarketRelay__InsufficientFundsForFee(fee, msg.value);
        }

        // Generate operation ID
        operationId = keccak256(
            abi.encode(_nextNonce++, msg.sender, destChainSelector, block.timestamp)
        );

        uint256 timeoutAt = block.timestamp + cfg.defaultTimeout;

        // Create relay message for CCIP
        RelayClient.RelayMessage memory message = RelayClient.RelayMessage({
            sourceChain: uint64(block.chainid),
            destChain: destChainSelector,
            operationId: operationId,
            data: operationData,
            value: value,
            executor: msg.sender
        });

        // Send via CCIP router
        bytes32 ccipMessageId = relayRouter.relayMessage{value: fee}(destChainSelector, message);

        // Store operation
        _relayOperations[operationId] = RelayOperation({
            operationId: operationId,
            initiator: msg.sender,
            sourceChain: uint64(block.chainid),
            destChain: destChainSelector,
            operationData: operationData,
            value: value,
            status: RelayStatus.Pending,
            createdAt: block.timestamp,
            executedAt: 0,
            completedAt: 0,
            timeoutAt: timeoutAt,
            attempts: 1,
            ccipMessageId: ccipMessageId,
            result: ""
        });

        _operationsByInitiator[msg.sender].push(operationId);
        _pendingOperationsByChain[destChainSelector].push(operationId);

        // Track fees
        totalFeesCollected += fee;
        userFeesAccrued[msg.sender] += fee;

        emit RelayInitiated(
            operationId,
            msg.sender,
            uint64(block.chainid),
            destChainSelector,
            value,
            timeoutAt,
            ccipMessageId
        );
    }

    /// @notice Update relay status to executing
    /// @param operationId The operation identifier
    function updateRelayExecuting(bytes32 operationId) external onlyRelayer {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        if (op.status != RelayStatus.Pending) {
            revert MarketRelay__InvalidOperationStatus(operationId, op.status);
        }

        op.status = RelayStatus.Executing;
        op.executedAt = block.timestamp;

        emit RelayExecuting(operationId, block.timestamp);
    }

    /// @notice Mark relay operation as completed
    /// @param operationId The operation identifier
    /// @param result The result data from the relay execution
    function completeRelay(bytes32 operationId, bytes calldata result) external onlyRelayer {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        if (op.status != RelayStatus.Executing && op.status != RelayStatus.Pending) {
            revert MarketRelay__InvalidOperationStatus(operationId, op.status);
        }

        op.status = RelayStatus.Completed;
        op.completedAt = block.timestamp;
        op.result = result;

        _recordHistory(operationId, RelayStatus.Completed);

        emit RelayCompleted(operationId, result, block.timestamp);
    }

    /// @notice Mark relay operation as failed
    /// @param operationId The operation identifier
    /// @param reason Reason for failure
    function failRelay(bytes32 operationId, string calldata reason) external onlyRelayer {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        if (op.status == RelayStatus.Completed || op.status == RelayStatus.Timeout) {
            revert MarketRelay__OperationAlreadyCompleted(operationId);
        }

        // Check if we can retry
        RelayConfig storage cfg = _chainConfigs[op.destChain];
        if (op.attempts < cfg.maxRetries && op.status != RelayStatus.Failed) {
            op.status = RelayStatus.Pending;
            op.attempts += 1;
            op.timeoutAt = block.timestamp + cfg.retryDelay + cfg.defaultTimeout;
            emit RelayRetried(operationId, op.attempts, op.timeoutAt);
        } else {
            op.status = RelayStatus.Failed;
            _recordHistory(operationId, RelayStatus.Failed);
            emit RelayFailed(operationId, reason, block.timestamp);
        }
    }

    /// @notice Check and enforce timeout for a relay operation
    /// @param operationId The operation identifier
    function checkTimeout(bytes32 operationId) external {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        if (op.status == RelayStatus.Completed || op.status == RelayStatus.Failed ||
            op.status == RelayStatus.Timeout) {
            revert MarketRelay__OperationAlreadyCompleted(operationId);
        }
        if (block.timestamp <= op.timeoutAt) {
            revert MarketRelay__OperationNotExpired(operationId);
        }

        op.status = RelayStatus.Timeout;
        _recordHistory(operationId, RelayStatus.Timeout);

        emit RelayTimeout(operationId, block.timestamp);
    }

    /// @notice Cancel a relay operation (by initiator)
    /// @param operationId The operation identifier
    function cancelRelay(bytes32 operationId) external onlyInitiator(operationId) {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.status != RelayStatus.Pending && op.status != RelayStatus.Executing) {
            revert MarketRelay__InvalidOperationStatus(operationId, op.status);
        }

        op.status = RelayStatus.Cancelled;
        _recordHistory(operationId, RelayStatus.Cancelled);

        emit RelayCancelled(operationId, block.timestamp);
    }

    // ---------------------------------------------------------------
    // History Management
    // ---------------------------------------------------------------

    /// @notice Record operation in history
    function _recordHistory(bytes32 operationId, RelayStatus finalStatus) internal {
        RelayOperation storage op = _relayOperations[operationId];

        _relayHistory[operationId] = RelayHistory({
            operationId: operationId,
            initiator: op.initiator,
            status: finalStatus,
            createdAt: op.createdAt,
            completedAt: block.timestamp,
            timeoutAt: op.timeoutAt,
            attempts: op.attempts,
            result: op.result
        });

        _allOperationHistory.push(operationId);

        emit RelayOperationHistoryRecorded(operationId, finalStatus);
    }

    /// @notice Add manual history record (for archive/recovery)
    function addRelayHistory(
        bytes32 operationId,
        address initiator,
        RelayStatus status,
        uint256 createdAt,
        uint256 completedAt,
        uint256 timeoutAt,
        uint256 attempts,
        bytes calldata result
    ) external onlyOwner {
        _relayHistory[operationId] = RelayHistory({
            operationId: operationId,
            initiator: initiator,
            status: status,
            createdAt: createdAt,
            completedAt: completedAt,
            timeoutAt: timeoutAt,
            attempts: attempts,
            result: result
        });

        if (_allOperationHistory.length == 0 || _allOperationHistory[_allOperationHistory.length - 1] != operationId) {
            _allOperationHistory.push(operationId);
        }

        emit RelayOperationHistoryRecorded(operationId, status);
    }

    // ---------------------------------------------------------------
    // Query Functions
    // ---------------------------------------------------------------

    /// @notice Get relay operation status
    function getRelayStatus(bytes32 operationId) external view returns (RelayStatus) {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        return op.status;
    }

    /// @notice Get complete relay operation details
    function getRelayOperation(bytes32 operationId)
        external
        view
        returns (RelayOperation memory)
    {
        RelayOperation storage op = _relayOperations[operationId];
        if (op.operationId == bytes32(0)) revert MarketRelay__OperationNotFound(operationId);
        return op;
    }

    /// @notice Get relay history entry
    function getRelayHistory(bytes32 operationId)
        external
        view
        returns (RelayHistory memory)
    {
        if (_relayHistory[operationId].operationId == bytes32(0)) {
            revert MarketRelay__OperationNotFound(operationId);
        }
        return _relayHistory[operationId];
    }

    /// @notice Get pending operations for a user
    function getPendingRelaysByInitiator(address initiator)
        external
        view
        returns (bytes32[] memory pending)
    {
        bytes32[] memory allOps = _operationsByInitiator[initiator];
        uint256 count = 0;

        for (uint256 i = 0; i < allOps.length; i++) {
            if (_relayOperations[allOps[i]].status == RelayStatus.Pending ||
                _relayOperations[allOps[i]].status == RelayStatus.Executing) {
                count++;
            }
        }

        pending = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allOps.length; i++) {
            if (_relayOperations[allOps[i]].status == RelayStatus.Pending ||
                _relayOperations[allOps[i]].status == RelayStatus.Executing) {
                pending[index++] = allOps[i];
            }
        }
    }

    /// @notice Get all operations by initiator
    function getRelaysByInitiator(address initiator)
        external
        view
        returns (bytes32[] memory)
    {
        return _operationsByInitiator[initiator];
    }

    /// @notice Get pending operations for a destination chain
    function getPendingRelaysByChain(uint64 destChain)
        external
        view
        returns (bytes32[] memory pending)
    {
        bytes32[] memory allOps = _pendingOperationsByChain[destChain];
        uint256 count = 0;

        for (uint256 i = 0; i < allOps.length; i++) {
            if (_relayOperations[allOps[i]].status == RelayStatus.Pending) {
                count++;
            }
        }

        pending = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allOps.length; i++) {
            if (_relayOperations[allOps[i]].status == RelayStatus.Pending) {
                pending[index++] = allOps[i];
            }
        }
    }

    /// @notice Get all operation history
    function getAllRelayHistory() external view returns (bytes32[] memory) {
        return _allOperationHistory;
    }

    /// @notice Get operations requiring timeout check
    function getExpiredRelays() external view returns (bytes32[] memory expired) {
        uint256 count = 0;
        uint256 historyLen = _allOperationHistory.length;

        // Count expired operations
        for (uint256 i = 0; i < historyLen; i++) {
            bytes32 opId = _allOperationHistory[i];
            RelayOperation storage op = _relayOperations[opId];
            if (op.status != RelayStatus.Completed && op.status != RelayStatus.Failed &&
                op.status != RelayStatus.Timeout && op.status != RelayStatus.Cancelled &&
                block.timestamp > op.timeoutAt) {
                count++;
            }
        }

        expired = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < historyLen; i++) {
            bytes32 opId = _allOperationHistory[i];
            RelayOperation storage op = _relayOperations[opId];
            if (op.status != RelayStatus.Completed && op.status != RelayStatus.Failed &&
                op.status != RelayStatus.Timeout && op.status != RelayStatus.Cancelled &&
                block.timestamp > op.timeoutAt) {
                expired[index++] = opId;
            }
        }
    }

    /// @notice Get chain configuration
    function getChainConfig(uint64 chainSelector)
        external
        view
        returns (RelayConfig memory)
    {
        if (!_chainConfigs[chainSelector].supported) {
            revert MarketRelay__ChainNotSupported(chainSelector);
        }
        return _chainConfigs[chainSelector];
    }

    /// @notice Check if chain is supported
    function isChainSupported(uint64 chainSelector) external view returns (bool) {
        return _chainConfigs[chainSelector].supported;
    }

    /// @notice Get all supported chains
    function getSupportedChains() external view returns (uint64[] memory) {
        return _supportedChainList;
    }

    /// @notice Get total operation count
    function getRelayCount() external view returns (uint256) {
        return _nextNonce - 1;
    }

    // ---------------------------------------------------------------
    // Fee Management
    // ---------------------------------------------------------------

    /// @notice Withdraw accumulated fees
    function withdrawFees(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert MarketRelay__ZeroAddress();
        (bool success, ) = to.call{value: amount}("");
        require(success, "Fee withdrawal failed");
        emit FeesWithdrawn(to, amount);
    }
}
