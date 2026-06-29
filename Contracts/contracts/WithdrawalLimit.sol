// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title WithdrawalLimit
/// @notice Per-user, per-token rolling-window withdrawal limit enforcement.
/// @dev Tracks usage in fixed-length windows (default 24h) plus a single-tx cap.
contract WithdrawalLimit is Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error ZeroWindow();
    error LimitExceeded(uint256 attempted, uint256 remaining);
    error PerTxCapExceeded(uint256 attempted, uint256 cap);
    error NotEnforcer();
    error AlreadyEnforcer();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct Limit {
        uint256 windowAmount;   // total amount allowed per window (0 = no window cap)
        uint256 perTxCap;       // max for a single record (0 = no per-tx cap)
        uint64  windowSeconds;  // window length, e.g. 86_400
        bool    set;            // explicitly configured
    }

    struct Usage {
        uint256 amount;
        uint64  windowStart;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev token => default limit applied when no per-user override exists
    mapping(address => Limit) private _defaultLimits;

    /// @dev user => token => override limit
    mapping(address => mapping(address => Limit)) private _userLimits;

    /// @dev user => token => current rolling-window usage
    mapping(address => mapping(address => Usage)) private _usage;

    /// @dev addresses authorised to call `record`
    mapping(address => bool) private _enforcers;
    address[] private _enforcerList;

    /// @dev default window length applied when a limit is configured without one
    uint64 public constant DEFAULT_WINDOW = 1 days;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event EnforcerAdded(address indexed enforcer);
    event EnforcerRemoved(address indexed enforcer);
    event DefaultLimitSet(address indexed token, uint256 windowAmount, uint256 perTxCap, uint64 windowSeconds);
    event UserLimitSet(
        address indexed user,
        address indexed token,
        uint256 windowAmount,
        uint256 perTxCap,
        uint64 windowSeconds
    );
    event UserLimitCleared(address indexed user, address indexed token);
    event WithdrawalRecorded(address indexed user, address indexed token, uint256 amount, uint256 windowUsed);
    event UsageReset(address indexed user, address indexed token);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyEnforcer() {
        if (!_enforcers[msg.sender] && msg.sender != owner()) revert NotEnforcer();
        _;
    }

    // -------------------------------------------------------------------------
    // Enforcer registry
    // -------------------------------------------------------------------------
    function addEnforcer(address enforcer) external onlyOwner {
        if (enforcer == address(0)) revert ZeroAddress();
        if (_enforcers[enforcer]) revert AlreadyEnforcer();
        _enforcers[enforcer] = true;
        _enforcerList.push(enforcer);
        emit EnforcerAdded(enforcer);
    }

    function removeEnforcer(address enforcer) external onlyOwner {
        if (!_enforcers[enforcer]) revert NotEnforcer();
        _enforcers[enforcer] = false;

        uint256 len = _enforcerList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_enforcerList[i] == enforcer) {
                _enforcerList[i] = _enforcerList[len - 1];
                _enforcerList.pop();
                break;
            }
        }
        emit EnforcerRemoved(enforcer);
    }

    function isEnforcer(address account) external view returns (bool) {
        return _enforcers[account];
    }

    // -------------------------------------------------------------------------
    // Limit configuration
    // -------------------------------------------------------------------------

    /// @notice Configure the default limit applied to a token.
    function setDefaultLimit(
        address token,
        uint256 windowAmount,
        uint256 perTxCap,
        uint64 windowSeconds
    ) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        _defaultLimits[token] = Limit({
            windowAmount: windowAmount,
            perTxCap: perTxCap,
            windowSeconds: windowSeconds == 0 ? DEFAULT_WINDOW : windowSeconds,
            set: true
        });
        emit DefaultLimitSet(token, windowAmount, perTxCap, windowSeconds);
    }

    /// @notice Override the limit for a specific user and token.
    function setUserLimit(
        address user,
        address token,
        uint256 windowAmount,
        uint256 perTxCap,
        uint64 windowSeconds
    ) external onlyOwner {
        if (user == address(0) || token == address(0)) revert ZeroAddress();
        _userLimits[user][token] = Limit({
            windowAmount: windowAmount,
            perTxCap: perTxCap,
            windowSeconds: windowSeconds == 0 ? DEFAULT_WINDOW : windowSeconds,
            set: true
        });
        emit UserLimitSet(user, token, windowAmount, perTxCap, windowSeconds);
    }

    /// @notice Remove a per-user override; falls back to default.
    function clearUserLimit(address user, address token) external onlyOwner {
        delete _userLimits[user][token];
        emit UserLimitCleared(user, token);
    }

    /// @notice Reset a user's usage counter for a token (e.g. after support review).
    function resetUsage(address user, address token) external onlyOwner {
        delete _usage[user][token];
        emit UsageReset(user, token);
    }

    // -------------------------------------------------------------------------
    // Enforcement
    // -------------------------------------------------------------------------

    /// @notice Reverts iff `amount` is over the configured limits for `user`/`token`.
    /// @dev Pure preview helper that does not mutate usage.
    function check(address user, address token, uint256 amount) public view {
        Limit memory lim = effectiveLimit(user, token);

        if (lim.perTxCap != 0 && amount > lim.perTxCap) {
            revert PerTxCapExceeded(amount, lim.perTxCap);
        }

        if (lim.windowAmount == 0) return;

        (uint256 used, ) = _projectUsage(user, token, lim.windowSeconds);
        uint256 remaining = lim.windowAmount > used ? lim.windowAmount - used : 0;
        if (amount > remaining) revert LimitExceeded(amount, remaining);
    }

    /// @notice Validate then commit a withdrawal against the rolling window.
    /// @dev Callable only by enforcers (e.g. the vault contract).
    function record(address user, address token, uint256 amount) external onlyEnforcer {
        Limit memory lim = effectiveLimit(user, token);

        if (lim.perTxCap != 0 && amount > lim.perTxCap) {
            revert PerTxCapExceeded(amount, lim.perTxCap);
        }

        Usage storage u = _usage[user][token];
        uint64 windowSec = lim.windowSeconds == 0 ? DEFAULT_WINDOW : lim.windowSeconds;

        if (u.windowStart == 0 || block.timestamp >= uint256(u.windowStart) + windowSec) {
            u.windowStart = uint64(block.timestamp);
            u.amount = 0;
        }

        if (lim.windowAmount != 0) {
            uint256 remaining = lim.windowAmount > u.amount ? lim.windowAmount - u.amount : 0;
            if (amount > remaining) revert LimitExceeded(amount, remaining);
        }

        u.amount += amount;
        emit WithdrawalRecorded(user, token, amount, u.amount);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice The limit applied to a (user, token) pair: per-user override else default.
    function effectiveLimit(address user, address token) public view returns (Limit memory) {
        Limit memory lim = _userLimits[user][token];
        if (lim.set) return lim;
        return _defaultLimits[token];
    }

    function getDefaultLimit(address token) external view returns (Limit memory) {
        return _defaultLimits[token];
    }

    function getUserLimit(address user, address token) external view returns (Limit memory) {
        return _userLimits[user][token];
    }

    /// @notice Current rolling-window usage and remaining budget.
    function getUsage(address user, address token)
        external
        view
        returns (uint256 used, uint256 remaining, uint64 windowStart, uint64 windowEnd)
    {
        Limit memory lim = effectiveLimit(user, token);
        uint64 windowSec = lim.windowSeconds == 0 ? DEFAULT_WINDOW : lim.windowSeconds;
        (uint256 currentUsed, uint64 start) = _projectUsage(user, token, windowSec);
        used = currentUsed;
        if (lim.windowAmount == 0) {
            remaining = type(uint256).max;
        } else {
            remaining = lim.windowAmount > used ? lim.windowAmount - used : 0;
        }
        windowStart = start;
        windowEnd = start == 0 ? 0 : start + windowSec;
    }

    /// @notice Convenience: amount the user may still withdraw right now.
    function remaining(address user, address token) external view returns (uint256) {
        Limit memory lim = effectiveLimit(user, token);
        if (lim.windowAmount == 0) return type(uint256).max;
        uint64 windowSec = lim.windowSeconds == 0 ? DEFAULT_WINDOW : lim.windowSeconds;
        (uint256 used, ) = _projectUsage(user, token, windowSec);
        return lim.windowAmount > used ? lim.windowAmount - used : 0;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /// @dev Read usage as of `block.timestamp`, treating expired windows as reset.
    function _projectUsage(address user, address token, uint64 windowSec)
        internal
        view
        returns (uint256 used, uint64 windowStart)
    {
        Usage storage u = _usage[user][token];
        if (u.windowStart == 0) return (0, 0);
        if (block.timestamp >= uint256(u.windowStart) + windowSec) {
            return (0, 0);
        }
        return (u.amount, u.windowStart);
    }
}
