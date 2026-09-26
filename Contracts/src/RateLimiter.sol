// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RateLimiter is AccessControl {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct RateLimitConfig {
        uint256 maxOperations;
        uint256 timeWindow;
        bool enabled;
    }

    struct OperationTracker {
        uint256 operationCount;
        uint256 windowStartTime;
        uint256 lastOperationTime;
    }

    mapping(bytes32 => RateLimitConfig) public rateLimitConfigs;
    mapping(bytes32 => mapping(address => OperationTracker)) public operationTrackers;
    mapping(address => mapping(bytes32 => bool)) public userLimitOverrides;

    event RateLimitConfigured(
        bytes32 indexed limitId,
        uint256 maxOperations,
        uint256 timeWindow,
        bool enabled
    );
    event RateLimitConfigurationUpdated(
        bytes32 indexed limitId,
        uint256 oldMaxOperations,
        uint256 newMaxOperations,
        uint256 oldTimeWindow,
        uint256 newTimeWindow,
        bool oldEnabled,
        bool newEnabled
    );
    event OperationAllowed(bytes32 indexed limitId, address indexed user, uint256 operationCount);
    event OperationBlocked(bytes32 indexed limitId, address indexed user, string reason);
    event RateLimitReset(bytes32 indexed limitId, address indexed user);
    event LimitOverrideSet(bytes32 indexed limitId, address indexed user, bool overridden);
    event WindowRolled(bytes32 indexed limitId, address indexed user, uint256 newWindowStart);

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "RateLimiter: caller is not admin");
        _;
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "RateLimiter: caller is not operator");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // Configuration Management
    /// @notice Executes configureRateLimit.
    /// @param limitId Identifier of the relevant limit.
    /// @param maxOperations Maximum operations allowed.
    /// @param timeWindow time window as a Unix timestamp.
    /// @param enabled Whether the configuration is enabled.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "RateLimiter: invalid limitId" if `limitId != bytes32(0)` is false.
    ///     "RateLimiter: maxOperations must be positive" if `maxOperations > 0` is false.
    ///     "RateLimiter: timeWindow must be positive" if `timeWindow > 0` is false.
    function configureRateLimit(
        bytes32 limitId,
        uint256 maxOperations,
        uint256 timeWindow,
        bool enabled
    ) external onlyAdmin {
        require(limitId != bytes32(0), "RateLimiter: invalid limitId");
        require(maxOperations > 0, "RateLimiter: maxOperations must be positive");
        require(timeWindow > 0, "RateLimiter: timeWindow must be positive");

        RateLimitConfig memory oldConfig = rateLimitConfigs[limitId];
        rateLimitConfigs[limitId] = RateLimitConfig(maxOperations, timeWindow, enabled);
        emit RateLimitConfigured(limitId, maxOperations, timeWindow, enabled);
        emit RateLimitConfigurationUpdated(
            limitId,
            oldConfig.maxOperations,
            maxOperations,
            oldConfig.timeWindow,
            timeWindow,
            oldConfig.enabled,
            enabled
        );
    }

    /// @notice Executes enableRateLimit.
    /// @param limitId Identifier of the relevant limit.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "RateLimiter: limit not configured" if `rateLimitConfigs[limitId].timeWindow >
    ///     0` is false.
    function enableRateLimit(bytes32 limitId) external onlyAdmin {
        require(rateLimitConfigs[limitId].timeWindow > 0, "RateLimiter: limit not configured");
        bool oldEnabled = rateLimitConfigs[limitId].enabled;
        rateLimitConfigs[limitId].enabled = true;
        emit RateLimitConfigured(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            true
        );
        emit RateLimitConfigurationUpdated(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            rateLimitConfigs[limitId].timeWindow,
            oldEnabled,
            true
        );
    }

    /// @notice Executes disableRateLimit.
    /// @param limitId Identifier of the relevant limit.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "RateLimiter: limit not configured" if `rateLimitConfigs[limitId].timeWindow >
    ///     0` is false.
    function disableRateLimit(bytes32 limitId) external onlyAdmin {
        require(rateLimitConfigs[limitId].timeWindow > 0, "RateLimiter: limit not configured");
        bool oldEnabled = rateLimitConfigs[limitId].enabled;
        rateLimitConfigs[limitId].enabled = false;
        emit RateLimitConfigured(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            false
        );
        emit RateLimitConfigurationUpdated(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            rateLimitConfigs[limitId].timeWindow,
            oldEnabled,
            false
        );
    }

    // Rate Limiting Operations
    /// @notice Reports whether rate limit is satisfied.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return allowed allowed produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function checkRateLimit(bytes32 limitId, address user) external returns (bool allowed) {
        return _checkAndUpdate(limitId, user);
    }

    /// @notice Executes recordOperation.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @dev Access: Caller must have the operator role.
    /// @dev Reverts: "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    ///     "RateLimiter: rate limit exceeded" if `!_checkAndUpdate(limitId, user)` is false.
    function recordOperation(bytes32 limitId, address user) external onlyOperator {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        require(!_checkAndUpdate(limitId, user), "RateLimiter: rate limit exceeded");
    }

    /// @notice Executes recordOperationIfAllowed.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller must have the operator role.
    /// @dev Reverts: "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function recordOperationIfAllowed(bytes32 limitId, address user) external onlyOperator returns (bool) {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        return _checkAndUpdate(limitId, user);
    }

    // Permission Overrides
    /// @notice Executes setLimitOverride.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @param overridden Whether overridden is enabled or selected.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "RateLimiter: invalid user address" if `user != address(0)` is false.
    ///     "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function setLimitOverride(bytes32 limitId, address user, bool overridden) external onlyAdmin {
        require(user != address(0), "RateLimiter: invalid user address");
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        userLimitOverrides[user][limitId] = overridden;
        emit LimitOverrideSet(limitId, user, overridden);
    }

    /// @notice Reports whether user exempt is satisfied.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isUserExempt(bytes32 limitId, address user) external view returns (bool) {
        return userLimitOverrides[user][limitId];
    }

    // Status and Metrics Queries
    /// @notice Returns rate limit config.
    /// @param limitId Identifier of the relevant limit.
    /// @return maxOperations max operations produced by the operation.
    /// @return timeWindow time window produced by the operation.
    /// @return enabled True if enabled.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRateLimitConfig(bytes32 limitId) 
        external 
        view 
        returns (uint256 maxOperations, uint256 timeWindow, bool enabled) 
    {
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        return (config.maxOperations, config.timeWindow, config.enabled);
    }

    /// @notice Returns operation count.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return count Number of items tracked by the contract.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getOperationCount(bytes32 limitId, address user) 
        external 
        view 
        returns (uint256 count) 
    {
        OperationTracker memory tracker = operationTrackers[limitId][user];
        
        // Check if window has expired
        if (_isWindowExpired(limitId, user)) {
            return 0;
        }
        
        return tracker.operationCount;
    }

    /// @notice Returns operation status.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return currentCount Number of items tracked by the contract.
    /// @return maxAllowed max allowed produced by the operation.
    /// @return remainingOperations remaining operations produced by the operation.
    /// @return timeUntilReset time until reset produced by the operation.
    /// @return isLimited is limited produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function getOperationStatus(bytes32 limitId, address user) 
        external 
        view 
        returns (
            uint256 currentCount,
            uint256 maxAllowed,
            uint256 remainingOperations,
            uint256 timeUntilReset,
            bool isLimited
        ) 
    {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        OperationTracker memory tracker = operationTrackers[limitId][user];
        
        // Check if window has expired
        if (_isWindowExpired(limitId, user)) {
            return (0, config.maxOperations, config.maxOperations, 0, false);
        }
        
        currentCount = tracker.operationCount;
        maxAllowed = config.maxOperations;
        remainingOperations = currentCount >= maxAllowed ? 0 : maxAllowed - currentCount;
        
        uint256 windowEnd = tracker.windowStartTime + config.timeWindow;
        timeUntilReset = windowEnd > block.timestamp ? windowEnd - block.timestamp : 0;
        isLimited = config.enabled && currentCount >= maxAllowed;
    }

    /// @notice Returns time to next window.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return secondsUntilReset seconds until reset produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function getTimeToNextWindow(bytes32 limitId, address user) 
        external 
        view 
        returns (uint256 secondsUntilReset) 
    {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        OperationTracker memory tracker = operationTrackers[limitId][user];
        
        if (_isWindowExpired(limitId, user)) {
            return 0;
        }
        
        uint256 windowEnd = tracker.windowStartTime + config.timeWindow;
        return windowEnd > block.timestamp ? windowEnd - block.timestamp : 0;
    }

    /// @notice Reports whether rate limited is satisfied.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function isRateLimited(bytes32 limitId, address user) external view returns (bool) {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        
        if (!config.enabled) {
            return false;
        }
        
        if (userLimitOverrides[user][limitId]) {
            return false;
        }
        
        OperationTracker memory tracker = operationTrackers[limitId][user];
        
        if (_isWindowExpired(limitId, user)) {
            return false;
        }
        
        return tracker.operationCount >= config.maxOperations;
    }

    /// @notice Executes limitsExist.
    /// @param limitId Identifier of the relevant limit.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function limitsExist(bytes32 limitId) public view returns (bool) {
        return rateLimitConfigs[limitId].timeWindow > 0;
    }

    // Management Functions
    /// @notice Executes resetUserLimits.
    /// @param limitId Identifier of the relevant limit.
    /// @param user User address affected by this operation.
    /// @dev Access: Caller must be an administrator.
    /// @dev Reverts: "RateLimiter: invalid user address" if `user != address(0)` is false.
    ///     "RateLimiter: limit not configured" if `limitsExist(limitId)` is false.
    function resetUserLimits(bytes32 limitId, address user) external onlyAdmin {
        require(user != address(0), "RateLimiter: invalid user address");
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        delete operationTrackers[limitId][user];
        emit RateLimitReset(limitId, user);
    }

    // Internal Functions
    function _checkAndUpdate(bytes32 limitId, address user) internal returns (bool allowed) {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        
        // If limit is disabled, always allow
        if (!config.enabled) {
            _updateTracker(limitId, user, config);
            emit OperationAllowed(limitId, user, operationTrackers[limitId][user].operationCount);
            return true;
        }
        
        // If user is exempt, always allow
        if (userLimitOverrides[user][limitId]) {
            _updateTracker(limitId, user, config);
            emit OperationAllowed(limitId, user, operationTrackers[limitId][user].operationCount);
            return true;
        }
        
        // Check if window has expired - if so, reset
        if (_isWindowExpired(limitId, user)) {
            delete operationTrackers[limitId][user];
            emit WindowRolled(limitId, user, block.timestamp);
        }
        
        OperationTracker storage tracker = operationTrackers[limitId][user];
        
        // Initialize if first operation
        if (tracker.windowStartTime == 0) {
            tracker.windowStartTime = block.timestamp;
        }
        
        // Check if limit is exceeded
        if (tracker.operationCount >= config.maxOperations) {
            emit OperationBlocked(limitId, user, "Rate limit exceeded");
            return false;
        }
        
        // Increment counter and update timestamp
        tracker.operationCount++;
        tracker.lastOperationTime = block.timestamp;
        
        emit OperationAllowed(limitId, user, tracker.operationCount);
        return true;
    }

    function _updateTracker(bytes32 limitId, address user, RateLimitConfig memory config) internal {
        OperationTracker storage tracker = operationTrackers[limitId][user];
        
        // Initialize if first operation
        if (tracker.windowStartTime == 0) {
            tracker.windowStartTime = block.timestamp;
        }
        
        tracker.lastOperationTime = block.timestamp;
    }

    function _isWindowExpired(bytes32 limitId, address user) internal view returns (bool) {
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        OperationTracker memory tracker = operationTrackers[limitId][user];
        
        if (tracker.windowStartTime == 0) {
            return true; // No operations yet, window is "expired"
        }
        
        return block.timestamp >= tracker.windowStartTime + config.timeWindow;
    }
}
