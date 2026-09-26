// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CircuitBreaker is AccessControl {
    enum State {
        Closed,
        Open,
        HalfOpen
    }

    bytes32 public constant BREAKER_ROLE = keccak256("BREAKER_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    State public currentState = State.Closed;
    
    uint256 public failureCount;
    uint256 public successCount;
    uint256 public lastFailureTime;
    uint256 public lastSuccessTime;
    uint256 public breakTriggeredTime;

    // Configuration parameters
    uint256 public failureThreshold = 5;
    uint256 public failureRateThreshold = 50; // percentage
    uint256 public recoveryTimeout = 1 hours;
    uint256 public healthCheckWindow = 24 hours;

    event StateChanged(State indexed oldState, State indexed newState, string reason);
    event FailureRecorded(uint256 indexed failureCount, string reason);
    event SuccessRecorded(uint256 indexed successCount);
    event CircuitBreakerTriggered(State indexed previousState, uint256 timestamp);
    event RecoveryAttempt(uint256 timestamp);
    event RecoveryClosed(uint256 timestamp);
    event ConfigurationUpdated(string parameter, uint256 value);
    event BreakPermitted(address indexed operator, uint256 timestamp);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "CircuitBreaker: caller is not admin");
        _;
    }

    modifier onlyBreaker() {
        require(hasRole(BREAKER_ROLE, msg.sender), "CircuitBreaker: caller cannot trigger breaks");
        _;
    }

    modifier onlyMonitor() {
        require(hasRole(MONITOR_ROLE, msg.sender), "CircuitBreaker: caller cannot record health");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BREAKER_ROLE, msg.sender);
        _grantRole(MONITOR_ROLE, msg.sender);
    }

    // Health Monitoring
    /// @notice Executes recordSuccess.
    /// @dev Access: Caller must satisfy `onlyMonitor` access checks.
    function recordSuccess() external onlyMonitor {
        if (currentState == State.Open) {
            return;
        }

        successCount++;
        lastSuccessTime = block.timestamp;

        if (currentState == State.HalfOpen) {
            transitionToState(State.Closed, "Successful recovery");
        }

        emit SuccessRecorded(successCount);
    }

    /// @notice Executes recordFailure.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must satisfy `onlyMonitor` access checks.
    function recordFailure(string calldata reason) external onlyMonitor {
        if (currentState == State.Open) {
            return;
        }

        failureCount++;
        lastFailureTime = block.timestamp;

        emit FailureRecorded(failureCount, reason);

        // Check if threshold exceeded
        if (shouldBreak()) {
            _openCircuit("Failure threshold exceeded");
        }
    }

    // Trigger Break
    /// @notice Executes triggerBreak.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must satisfy `onlyBreaker` access checks.
    function triggerBreak(string calldata reason) public onlyBreaker {
        _openCircuit(reason);
    }

    function _openCircuit(string memory reason) internal {
        require(currentState != State.Open, "CircuitBreaker: already open");

        State previousState = currentState;
        transitionToState(State.Open, reason);
        breakTriggeredTime = block.timestamp;

        emit CircuitBreakerTriggered(previousState, block.timestamp);
    }

    // Recovery Handling
    /// @notice Executes attemptRecovery.
    /// @dev Access: Caller must satisfy `onlyBreaker` access checks.
    /// @dev Reverts: "CircuitBreaker: circuit is not open" if `currentState == State.Open` is false.
    ///     "CircuitBreaker: recovery timeout not reached" if `block.timestamp >= breakTriggeredTime
    ///     + recoveryTimeout` is false.
    function attemptRecovery() external onlyBreaker {
        require(currentState == State.Open, "CircuitBreaker: circuit is not open");
        require(
            block.timestamp >= breakTriggeredTime + recoveryTimeout,
            "CircuitBreaker: recovery timeout not reached"
        );

        transitionToState(State.HalfOpen, "Recovery attempt initiated");
        emit RecoveryAttempt(block.timestamp);
    }

    /// @notice Executes resetMetrics.
    /// @dev Access: Caller must be an administrator.
    function resetMetrics() external onlyAdmin {
        failureCount = 0;
        successCount = 0;
        lastFailureTime = 0;
        lastSuccessTime = 0;
        
        if (currentState != State.Closed) {
            transitionToState(State.Closed, "Manual reset");
        }
    }

    // Permission Control
    /// @notice Executes grantBreakerRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: invalid account" if `account != address(0)` is false.
    function grantBreakerRole(address account) external onlyAdmin {
        require(account != address(0), "CircuitBreaker: invalid account");
        _grantRole(BREAKER_ROLE, account);
        emit BreakPermitted(account, block.timestamp);
    }

    /// @notice Executes revokeBreakerRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: invalid account" if `account != address(0)` is false.
    function revokeBreakerRole(address account) external onlyAdmin {
        require(account != address(0), "CircuitBreaker: invalid account");
        _revokeRole(BREAKER_ROLE, account);
    }

    /// @notice Executes grantMonitorRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: invalid account" if `account != address(0)` is false.
    function grantMonitorRole(address account) external onlyAdmin {
        require(account != address(0), "CircuitBreaker: invalid account");
        _grantRole(MONITOR_ROLE, account);
    }

    /// @notice Executes revokeMonitorRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: invalid account" if `account != address(0)` is false.
    function revokeMonitorRole(address account) external onlyAdmin {
        require(account != address(0), "CircuitBreaker: invalid account");
        _revokeRole(MONITOR_ROLE, account);
    }

    // Configuration
    /// @notice Executes setFailureThreshold.
    /// @param threshold Numeric threshold used by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: threshold must be positive" if `threshold > 0` is false.
    function setFailureThreshold(uint256 threshold) external onlyAdmin {
        require(threshold > 0, "CircuitBreaker: threshold must be positive");
        failureThreshold = threshold;
        emit ConfigurationUpdated("failureThreshold", threshold);
    }

    /// @notice Executes setFailureRateThreshold.
    /// @param rate Numeric rate used by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: rate must be between 0 and 100" if `rate > 0 && rate <= 100`
    ///     is false.
    function setFailureRateThreshold(uint256 rate) external onlyAdmin {
        require(rate > 0 && rate <= 100, "CircuitBreaker: rate must be between 0 and 100");
        failureRateThreshold = rate;
        emit ConfigurationUpdated("failureRateThreshold", rate);
    }

    /// @notice Executes setRecoveryTimeout.
    /// @param timeout timeout as a Unix timestamp.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: timeout must be positive" if `timeout > 0` is false.
    function setRecoveryTimeout(uint256 timeout) external onlyAdmin {
        require(timeout > 0, "CircuitBreaker: timeout must be positive");
        recoveryTimeout = timeout;
        emit ConfigurationUpdated("recoveryTimeout", timeout);
    }

    /// @notice Executes setHealthCheckWindow.
    /// @param window Numeric window used by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "CircuitBreaker: window must be positive" if `window > 0` is false.
    function setHealthCheckWindow(uint256 window) external onlyAdmin {
        require(window > 0, "CircuitBreaker: window must be positive");
        healthCheckWindow = window;
        emit ConfigurationUpdated("healthCheckWindow", window);
    }

    // Status Reporting
    /// @notice Returns status.
    /// @return state Current state of the item.
    /// @return failures failures produced by the operation.
    /// @return successes successes produced by the operation.
    /// @return totalOperations total operations produced by the operation.
    /// @return healthPercentage health percentage produced by the operation.
    /// @return isHealthy is healthy produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getStatus() external view returns (
        State state,
        uint256 failures,
        uint256 successes,
        uint256 totalOperations,
        uint256 healthPercentage,
        bool isHealthy
    ) {
        state = currentState;
        failures = failureCount;
        successes = successCount;
        totalOperations = failureCount + successCount;
        
        if (totalOperations == 0) {
            healthPercentage = 100;
        } else {
            healthPercentage = (successCount * 100) / totalOperations;
        }
        
        isHealthy = currentState == State.Closed;
    }

    /// @notice Returns recovery info.
    /// @return state Current state of the item.
    /// @return timeSinceBreak time since break produced by the operation.
    /// @return timeUntilRecoveryAttempt time until recovery attempt produced by the operation.
    /// @return recoveryReady recovery ready produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRecoveryInfo() external view returns (
        State state,
        uint256 timeSinceBreak,
        uint256 timeUntilRecoveryAttempt,
        bool recoveryReady
    ) {
        state = currentState;
        
        if (currentState == State.Open) {
            timeSinceBreak = block.timestamp - breakTriggeredTime;
            uint256 recoveryTime = breakTriggeredTime + recoveryTimeout;
            
            if (block.timestamp >= recoveryTime) {
                timeUntilRecoveryAttempt = 0;
                recoveryReady = true;
            } else {
                timeUntilRecoveryAttempt = recoveryTime - block.timestamp;
                recoveryReady = false;
            }
        } else {
            timeSinceBreak = 0;
            timeUntilRecoveryAttempt = 0;
            recoveryReady = false;
        }
    }

    /// @notice Returns failure metrics.
    /// @return totalFailures total failures produced by the operation.
    /// @return failureRate failure rate produced by the operation.
    /// @return lastFailure last failure produced by the operation.
    /// @return lastSuccess last success produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getFailureMetrics() external view returns (
        uint256 totalFailures,
        uint256 failureRate,
        uint256 lastFailure,
        uint256 lastSuccess
    ) {
        totalFailures = failureCount;
        uint256 totalOps = failureCount + successCount;
        
        if (totalOps == 0) {
            failureRate = 0;
        } else {
            failureRate = (failureCount * 100) / totalOps;
        }
        
        lastFailure = lastFailureTime;
        lastSuccess = lastSuccessTime;
    }

    /// @notice Reports whether circuit open is satisfied.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isCircuitOpen() external view returns (bool) {
        return currentState == State.Open;
    }

    /// @notice Reports whether circuit half open is satisfied.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isCircuitHalfOpen() external view returns (bool) {
        return currentState == State.HalfOpen;
    }

    /// @notice Reports whether circuit closed is satisfied.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isCircuitClosed() external view returns (bool) {
        return currentState == State.Closed;
    }

    // Internal functions
    function shouldBreak() internal view returns (bool) {
        // Break if absolute failure threshold exceeded
        if (failureCount >= failureThreshold) {
            return true;
        }

        // Break if failure rate exceeds threshold
        uint256 totalOps = failureCount + successCount;
        if (totalOps > 0) {
            uint256 failureRate = (failureCount * 100) / totalOps;
            if (failureRate >= failureRateThreshold) {
                return true;
            }
        }

        return false;
    }

    function transitionToState(State newState, string memory reason) internal {
        State oldState = currentState;
        currentState = newState;
        emit StateChanged(oldState, newState, reason);
    }
}
