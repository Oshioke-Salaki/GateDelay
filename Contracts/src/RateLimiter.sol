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
    function configureRateLimit(
        bytes32 limitId,
        uint256 maxOperations,
        uint256 timeWindow,
        bool enabled
    ) external onlyAdmin {
        require(limitId != bytes32(0), "RateLimiter: invalid limitId");
        require(maxOperations > 0, "RateLimiter: maxOperations must be positive");
        require(timeWindow > 0, "RateLimiter: timeWindow must be positive");

        rateLimitConfigs[limitId] = RateLimitConfig(maxOperations, timeWindow, enabled);
        emit RateLimitConfigured(limitId, maxOperations, timeWindow, enabled);
    }

    function enableRateLimit(bytes32 limitId) external onlyAdmin {
        require(rateLimitConfigs[limitId].timeWindow > 0, "RateLimiter: limit not configured");
        rateLimitConfigs[limitId].enabled = true;
        emit RateLimitConfigured(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            true
        );
    }

    function disableRateLimit(bytes32 limitId) external onlyAdmin {
        require(rateLimitConfigs[limitId].timeWindow > 0, "RateLimiter: limit not configured");
        rateLimitConfigs[limitId].enabled = false;
        emit RateLimitConfigured(
            limitId,
            rateLimitConfigs[limitId].maxOperations,
            rateLimitConfigs[limitId].timeWindow,
            false
        );
    }

    // Rate Limiting Operations
    function checkRateLimit(bytes32 limitId, address user) external returns (bool allowed) {
        return _checkAndUpdate(limitId, user);
    }

    function recordOperation(bytes32 limitId, address user) external onlyOperator {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        require(!_checkAndUpdate(limitId, user), "RateLimiter: rate limit exceeded");
    }

    function recordOperationIfAllowed(bytes32 limitId, address user) external onlyOperator returns (bool) {
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        return _checkAndUpdate(limitId, user);
    }

    // Permission Overrides
    function setLimitOverride(bytes32 limitId, address user, bool overridden) external onlyAdmin {
        require(user != address(0), "RateLimiter: invalid user address");
        require(limitsExist(limitId), "RateLimiter: limit not configured");
        
        userLimitOverrides[user][limitId] = overridden;
        emit LimitOverrideSet(limitId, user, overridden);
    }

    function isUserExempt(bytes32 limitId, address user) external view returns (bool) {
        return userLimitOverrides[user][limitId];
    }

    // Status and Metrics Queries
    function getRateLimitConfig(bytes32 limitId) 
        external 
        view 
        returns (uint256 maxOperations, uint256 timeWindow, bool enabled) 
    {
        RateLimitConfig memory config = rateLimitConfigs[limitId];
        return (config.maxOperations, config.timeWindow, config.enabled);
    }

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

    function limitsExist(bytes32 limitId) public view returns (bool) {
        return rateLimitConfigs[limitId].timeWindow > 0;
    }

    // Management Functions
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
