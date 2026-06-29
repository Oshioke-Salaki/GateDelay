// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Timelock
/// @notice Manages delayed execution of operations with support for different delay periods.
contract Timelock {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error OperationNotQueued();
    error OperationAlreadyQueued();
    error DelayNotPassed();
    error OperationNotFound();
    error ExecutionFailed();
    error InvalidDelay();
    error InvalidOperation();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum OperationStatus { NONE, QUEUED, READY, EXECUTED, CANCELLED }

    struct Operation {
        address target;
        uint256 value;
        bytes data;
        uint256 queuedAt;
        uint256 executedAt;
        uint256 delay;
        OperationStatus status;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event OperationQueued(bytes32 indexed operationId, address indexed target, uint256 delay);
    event OperationExecuted(bytes32 indexed operationId, address indexed executor);
    event OperationCancelled(bytes32 indexed operationId);
    event DelayUpdated(uint256 newDelay);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(bytes32 => Operation) public operations;
    uint256 public minDelay;
    address public admin;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(uint256 _minDelay) {
        if (_minDelay == 0) revert InvalidDelay();
        minDelay = _minDelay;
        admin = msg.sender;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Queue an operation for delayed execution.
    /// @param target The target address to call.
    /// @param value The amount of ETH to send.
    /// @param data The encoded function call.
    /// @param delay The delay period for this operation (must be >= minDelay).
    /// @return operationId The ID of the queued operation.
    function queueOperation(address target, uint256 value, bytes calldata data, uint256 delay)
        external
        returns (bytes32 operationId)
    {
        if (target == address(0)) revert InvalidOperation();
        if (delay < minDelay) revert InvalidDelay();

        operationId = keccak256(abi.encodePacked(target, value, data, block.timestamp));

        if (operations[operationId].status != OperationStatus.NONE) {
            revert OperationAlreadyQueued();
        }

        operations[operationId] = Operation({
            target: target,
            value: value,
            data: data,
            queuedAt: block.timestamp,
            executedAt: 0,
            delay: delay,
            status: OperationStatus.QUEUED
        });

        emit OperationQueued(operationId, target, delay);
        return operationId;
    }

    /// @notice Execute a queued operation.
    /// @param operationId The ID of the operation to execute.
    function executeOperation(bytes32 operationId) external {
        Operation storage operation = operations[operationId];

        if (operation.status == OperationStatus.NONE) revert OperationNotFound();
        if (operation.status != OperationStatus.QUEUED) revert OperationNotQueued();

        uint256 readyTime = operation.queuedAt + operation.delay;
        if (block.timestamp < readyTime) revert DelayNotPassed();

        operation.status = OperationStatus.EXECUTED;
        operation.executedAt = block.timestamp;

        (bool success,) = operation.target.call{value: operation.value}(operation.data);
        if (!success) revert ExecutionFailed();

        emit OperationExecuted(operationId, msg.sender);
    }

    /// @notice Cancel a pending operation.
    /// @param operationId The ID of the operation to cancel.
    function cancelOperation(bytes32 operationId) external {
        if (msg.sender != admin) revert();

        Operation storage operation = operations[operationId];
        if (operation.status == OperationStatus.NONE) revert OperationNotFound();
        if (operation.status == OperationStatus.EXECUTED) revert OperationNotQueued();

        operation.status = OperationStatus.CANCELLED;
        emit OperationCancelled(operationId);
    }

    /// @notice Update the minimum delay for operations.
    /// @param _minDelay The new minimum delay.
    function updateMinDelay(uint256 _minDelay) external {
        if (msg.sender != admin) revert();
        if (_minDelay == 0) revert InvalidDelay();

        minDelay = _minDelay;
        emit DelayUpdated(_minDelay);
    }

    /// @notice Get operation details.
    /// @param operationId The ID of the operation.
    /// @return operation The operation struct.
    function getOperation(bytes32 operationId) external view returns (Operation memory operation) {
        if (operations[operationId].status == OperationStatus.NONE) revert OperationNotFound();
        return operations[operationId];
    }

    /// @notice Check if an operation is ready for execution.
    /// @param operationId The ID of the operation.
    /// @return ready True if the operation is ready to execute.
    function isOperationReady(bytes32 operationId) external view returns (bool ready) {
        Operation storage operation = operations[operationId];
        if (operation.status == OperationStatus.NONE) revert OperationNotFound();

        if (operation.status != OperationStatus.QUEUED) return false;

        uint256 readyTime = operation.queuedAt + operation.delay;
        return block.timestamp >= readyTime;
    }

    /// @notice Get the ready time for an operation.
    /// @param operationId The ID of the operation.
    /// @return readyTime The timestamp when the operation becomes ready.
    function getOperationReadyTime(bytes32 operationId) external view returns (uint256 readyTime) {
        Operation storage operation = operations[operationId];
        if (operation.status == OperationStatus.NONE) revert OperationNotFound();

        return operation.queuedAt + operation.delay;
    }
}
