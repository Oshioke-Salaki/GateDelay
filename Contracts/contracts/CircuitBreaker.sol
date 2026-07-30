// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CircuitBreaker
 * @notice Reusable registry contract implementing the Circuit Breaker pattern.
 * Supports monitoring health, automatic and manual tripping, grace recovery periods,
 * and role-based guardian overrides.
 */
contract CircuitBreaker is Ownable {
    // ──── Types ──────────────────────────────────────────────────────────────────

    enum State { Closed, Open, HalfOpen }

    struct OperationConfig {
        uint256 failureThreshold;     // Consecutive failures needed to automatically trip
        uint256 recoveryDelay;        // Cooldown period in seconds before entering HalfOpen
        uint256 successThreshold;     // Consecutive successes needed in HalfOpen to reset
    }

    struct OperationStatus {
        State state;
        uint256 consecutiveFailures;
        uint256 consecutiveSuccesses;
        uint256 lastFailureTimestamp;
    }

    // ──── State Variables ────────────────────────────────────────────────────────

    // list of accounts authorized to manually trip or reset circuits
    mapping(address => bool) public isGuardian;

    // operationId => configuration
    mapping(bytes32 => OperationConfig) private _configs;

    // operationId => current status
    mapping(bytes32 => OperationStatus) private _statuses;

    // ──── Events ─────────────────────────────────────────────────────────────────

    event GuardianSet(address indexed account, bool indexed isGuardian);
    event OperationRegistered(
        bytes32 indexed operationId,
        uint256 failureThreshold,
        uint256 recoveryDelay,
        uint256 successThreshold
    );
    event CircuitTripped(bytes32 indexed operationId, address indexed triggerer, string reason);
    event CircuitHalfOpened(bytes32 indexed operationId);
    event CircuitReset(bytes32 indexed operationId, address indexed recoverer);
    event ExecutionRecorded(bytes32 indexed operationId, bool success);

    // ──── Errors ─────────────────────────────────────────────────────────────────

    error NotGuardian();
    error CircuitOpen(bytes32 operationId);
    error InvalidConfiguration();
    error OperationAlreadyRegistered();
    error OperationNotRegistered();
    error ZeroAddress();

    // ──── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyGuardian() {
        if (!isGuardian[msg.sender] && msg.sender != owner()) {
            revert NotGuardian();
        }
        _;
    }

    // ──── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable() {}

    // ──── Admin ──────────────────────────────────────────────────────────────────

    /**
     * @notice Set guardian status for an account.
     * @param account Address of the guardian.
     * @param status True to authorize, false to revoke.
     */
    function setGuardian(address account, bool status) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isGuardian[account] = status;
        emit GuardianSet(account, status);
    }

    /**
     * @notice Register a new operation under the circuit breaker registry.
     * @param operationId Unique key identifying the operation.
     * @param failureThreshold Failures required to trip.
     * @param recoveryDelay Cooldown before HalfOpen.
     * @param successThreshold Successes required in HalfOpen to close.
     */
    function registerOperation(
        bytes32 operationId,
        uint256 failureThreshold,
        uint256 recoveryDelay,
        uint256 successThreshold
    ) external onlyOwner {
        if (operationId == bytes32(0)) revert InvalidConfiguration();
        if (failureThreshold == 0 || recoveryDelay == 0 || successThreshold == 0) {
            revert InvalidConfiguration();
        }
        if (_configs[operationId].failureThreshold > 0) {
            revert OperationAlreadyRegistered();
        }

        _configs[operationId] = OperationConfig({
            failureThreshold: failureThreshold,
            recoveryDelay: recoveryDelay,
            successThreshold: successThreshold
        });

        emit OperationRegistered(operationId, failureThreshold, recoveryDelay, successThreshold);
    }

    /**
     * @notice Update an existing operation configuration.
     * @param operationId Unique key identifying the operation.
     * @param failureThreshold Failures required to trip.
     * @param recoveryDelay Cooldown before HalfOpen.
     * @param successThreshold Successes required in HalfOpen to close.
     */
    function updateOperationConfig(
        bytes32 operationId,
        uint256 failureThreshold,
        uint256 recoveryDelay,
        uint256 successThreshold
    ) external onlyOwner {
        if (_configs[operationId].failureThreshold == 0) {
            revert OperationNotRegistered();
        }
        if (failureThreshold == 0 || recoveryDelay == 0 || successThreshold == 0) {
            revert InvalidConfiguration();
        }

        _configs[operationId] = OperationConfig({
            failureThreshold: failureThreshold,
            recoveryDelay: recoveryDelay,
            successThreshold: successThreshold
        });

        emit OperationRegistered(operationId, failureThreshold, recoveryDelay, successThreshold);
    }

    // ──── Operations ─────────────────────────────────────────────────────────────

    /**
     * @notice Records the execution health status of a monitored operation.
     * Triggers automatic state transitions.
     * @param operationId Unique key identifying the operation.
     * @param success True if the operation succeeded, false if failed.
     * @return State The new evaluated state of the operation.
     */
    function recordExecution(bytes32 operationId, bool success) external returns (State) {
        OperationConfig storage config = _configs[operationId];
        if (config.failureThreshold == 0) {
            revert OperationNotRegistered();
        }

        OperationStatus storage status = _statuses[operationId];
        State currentState = getCircuitState(operationId);

        if (currentState == State.Open) {
            revert CircuitOpen(operationId);
        }

        if (currentState == State.HalfOpen) {
            // Transition the internal state model from Open to HalfOpen if it was computed
            if (status.state == State.Open) {
                status.state = State.HalfOpen;
                status.consecutiveSuccesses = 0;
                emit CircuitHalfOpened(operationId);
            }

            if (success) {
                status.consecutiveSuccesses += 1;
                if (status.consecutiveSuccesses >= config.successThreshold) {
                    status.state = State.Closed;
                    status.consecutiveFailures = 0;
                    status.consecutiveSuccesses = 0;
                    emit CircuitReset(operationId, msg.sender);
                }
            } else {
                status.state = State.Open;
                status.consecutiveSuccesses = 0;
                status.lastFailureTimestamp = block.timestamp;
                emit CircuitTripped(operationId, msg.sender, "Execution failure in HalfOpen state");
            }
        } else {
            // currentState == State.Closed
            if (success) {
                status.consecutiveFailures = 0;
            } else {
                status.consecutiveFailures += 1;
                status.lastFailureTimestamp = block.timestamp;
                if (status.consecutiveFailures >= config.failureThreshold) {
                    status.state = State.Open;
                    status.consecutiveFailures = 0; // reset counter after trip
                    emit CircuitTripped(operationId, address(this), "Consecutive failures exceeded threshold");
                }
            }
        }

        emit ExecutionRecorded(operationId, success);
        return getCircuitState(operationId);
    }

    /**
     * @notice Manually trip an operation's circuit, locking executions.
     * @param operationId Unique key identifying the operation.
     * @param reason Description explaining the cause of manual trip.
     */
    function trip(bytes32 operationId, string calldata reason) external onlyGuardian {
        if (_configs[operationId].failureThreshold == 0) {
            revert OperationNotRegistered();
        }

        OperationStatus storage status = _statuses[operationId];
        status.state = State.Open;
        status.lastFailureTimestamp = block.timestamp;
        status.consecutiveFailures = 0;
        status.consecutiveSuccesses = 0;

        emit CircuitTripped(operationId, msg.sender, reason);
    }

    /**
     * @notice Manually reset an operation's circuit back to Closed state.
     * @param operationId Unique key identifying the operation.
     */
    function reset(bytes32 operationId) external onlyGuardian {
        if (_configs[operationId].failureThreshold == 0) {
            revert OperationNotRegistered();
        }

        OperationStatus storage status = _statuses[operationId];
        status.state = State.Closed;
        status.consecutiveFailures = 0;
        status.consecutiveSuccesses = 0;

        emit CircuitReset(operationId, msg.sender);
    }

    // ──── Queries ────────────────────────────────────────────────────────────────

    /**
     * @notice Evaluate and return the current state of an operation, incorporating
     * cooldown delays for auto-progression.
     * @param operationId Unique key identifying the operation.
     * @return State Current calculated state (Closed, Open, or HalfOpen).
     */
    function getCircuitState(bytes32 operationId) public view returns (State) {
        OperationConfig storage config = _configs[operationId];
        if (config.failureThreshold == 0) {
            revert OperationNotRegistered();
        }

        OperationStatus storage status = _statuses[operationId];
        if (status.state == State.Open) {
            if (block.timestamp >= status.lastFailureTimestamp + config.recoveryDelay) {
                return State.HalfOpen;
            }
        }
        return status.state;
    }

    /**
     * @notice Get all details regarding an operation.
     * @param operationId Unique key identifying the operation.
     * @return config OperationConfig struct.
     * @return status OperationStatus struct.
     * @return currentState Evaluated current state.
     */
    function getOperation(bytes32 operationId)
        external
        view
        returns (
            OperationConfig memory config,
            OperationStatus memory status,
            State currentState
        )
    {
        config = _configs[operationId];
        if (config.failureThreshold == 0) {
            revert OperationNotRegistered();
        }
        status = _statuses[operationId];
        currentState = getCircuitState(operationId);
    }
}
