// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MarketWrap {
    using SafeERC20 for IERC20;

    struct MarketWrapConfig {
        address token;          // underlying ERC20 accepted for this market
        uint256 wrapLimit;      // max total wrapped amount allowed for the market (0 = unset/inactive)
        uint256 userWrapLimit;  // max amount a single participant may have wrapped at once (0 = no per-user cap)
        uint256 totalWrapped;   // current total wrapped balance held for this market
        bool active;            // whether the market is configured and accepting wraps
    }

    struct WrapPosition {
        uint256 wrappedBalance;   // current wrapped balance for this participant
        uint256 totalWrapped;     // lifetime amount wrapped
        uint256 totalUnwrapped;   // lifetime amount unwrapped
        uint256 wrapCount;        // number of wrap operations
        uint256 unwrapCount;      // number of unwrap operations
    }

    struct WrapRecord {
        uint256 marketId;
        address participant;
        bool isWrap;       // true = wrap, false = unwrap
        uint256 amount;
        uint256 timestamp;
    }

    address public immutable controller;

    mapping(uint256 => MarketWrapConfig) private _configs;
    mapping(uint256 => mapping(address => WrapPosition)) private _positions;
    mapping(uint256 => WrapRecord[]) private _wrapHistory;

    event MarketConfigured(uint256 indexed marketId, address indexed token, uint256 wrapLimit, uint256 userWrapLimit);
    event WrapLimitUpdated(uint256 indexed marketId, uint256 newWrapLimit, uint256 newUserWrapLimit);
    event Wrapped(uint256 indexed marketId, address indexed participant, uint256 amount, uint256 newWrappedBalance);
    event Unwrapped(uint256 indexed marketId, address indexed participant, uint256 amount, uint256 newWrappedBalance);

    error MarketWrap__NotController(address caller);
    error MarketWrap__MarketNotActive(uint256 marketId);
    error MarketWrap__MarketAlreadyConfigured(uint256 marketId);
    error MarketWrap__InvalidToken();
    error MarketWrap__ZeroAmount();
    error MarketWrap__MarketLimitExceeded(uint256 requested, uint256 available);
    error MarketWrap__UserLimitExceeded(uint256 requested, uint256 available);
    error MarketWrap__InsufficientWrappedBalance(uint256 requested, uint256 available);

    constructor(address _controller) {
        controller = _controller;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert MarketWrap__NotController(msg.sender);
        _;
    }

    modifier onlyActiveMarket(uint256 marketId) {
        if (!_configs[marketId].active) revert MarketWrap__MarketNotActive(marketId);
        _;
    }

    // ---------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------

    /// @notice Configure a market to accept wraps of a given token, with optional limits.
    /// @param wrapLimit Maximum total amount that may be wrapped for this market. 0 means unlimited.
    /// @param userWrapLimit Maximum amount a single participant may have wrapped at once. 0 means unlimited.
    function configureMarket(uint256 marketId, address token, uint256 wrapLimit, uint256 userWrapLimit)
        external
        onlyController
    {
        if (_configs[marketId].active) revert MarketWrap__MarketAlreadyConfigured(marketId);
        if (token == address(0)) revert MarketWrap__InvalidToken();

        _configs[marketId] = MarketWrapConfig({
            token: token,
            wrapLimit: wrapLimit,
            userWrapLimit: userWrapLimit,
            totalWrapped: 0,
            active: true
        });

        emit MarketConfigured(marketId, token, wrapLimit, userWrapLimit);
    }

    /// @notice Update the wrap limits for an already-configured market.
    function updateWrapLimits(uint256 marketId, uint256 newWrapLimit, uint256 newUserWrapLimit)
        external
        onlyController
        onlyActiveMarket(marketId)
    {
        MarketWrapConfig storage cfg = _configs[marketId];
        cfg.wrapLimit = newWrapLimit;
        cfg.userWrapLimit = newUserWrapLimit;

        emit WrapLimitUpdated(marketId, newWrapLimit, newUserWrapLimit);
    }

    // ---------------------------------------------------------------
    // Wrap / Unwrap
    // ---------------------------------------------------------------

    /// @notice Wrap `amount` of the market's configured token into a tracked wrapped balance.
    /// @dev Caller must have approved this contract to spend `amount` of the underlying token.
    function wrap(uint256 marketId, uint256 amount) external onlyActiveMarket(marketId) {
        if (amount == 0) revert MarketWrap__ZeroAmount();

        MarketWrapConfig storage cfg = _configs[marketId];
        WrapPosition storage pos = _positions[marketId][msg.sender];

        if (cfg.wrapLimit != 0 && cfg.totalWrapped + amount > cfg.wrapLimit) {
            revert MarketWrap__MarketLimitExceeded(amount, cfg.wrapLimit - cfg.totalWrapped);
        }

        if (cfg.userWrapLimit != 0 && pos.wrappedBalance + amount > cfg.userWrapLimit) {
            revert MarketWrap__UserLimitExceeded(amount, cfg.userWrapLimit - pos.wrappedBalance);
        }

        IERC20(cfg.token).safeTransferFrom(msg.sender, address(this), amount);

        cfg.totalWrapped += amount;
        pos.wrappedBalance += amount;
        pos.totalWrapped += amount;
        pos.wrapCount += 1;

        _wrapHistory[marketId].push(
            WrapRecord({
                marketId: marketId,
                participant: msg.sender,
                isWrap: true,
                amount: amount,
                timestamp: block.timestamp
            })
        );

        emit Wrapped(marketId, msg.sender, amount, pos.wrappedBalance);
    }

    /// @notice Unwrap `amount` from the caller's wrapped balance, returning the underlying token.
    function unwrap(uint256 marketId, uint256 amount) external onlyActiveMarket(marketId) {
        if (amount == 0) revert MarketWrap__ZeroAmount();

        MarketWrapConfig storage cfg = _configs[marketId];
        WrapPosition storage pos = _positions[marketId][msg.sender];

        if (pos.wrappedBalance < amount) {
            revert MarketWrap__InsufficientWrappedBalance(amount, pos.wrappedBalance);
        }

        cfg.totalWrapped -= amount;
        pos.wrappedBalance -= amount;
        pos.totalUnwrapped += amount;
        pos.unwrapCount += 1;

        _wrapHistory[marketId].push(
            WrapRecord({
                marketId: marketId,
                participant: msg.sender,
                isWrap: false,
                amount: amount,
                timestamp: block.timestamp
            })
        );

        IERC20(cfg.token).safeTransfer(msg.sender, amount);

        emit Unwrapped(marketId, msg.sender, amount, pos.wrappedBalance);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function getMarketConfig(uint256 marketId) external view returns (MarketWrapConfig memory) {
        return _configs[marketId];
    }

    function wrappedBalanceOf(uint256 marketId, address participant) external view returns (uint256) {
        return _positions[marketId][participant].wrappedBalance;
    }

    function getPosition(uint256 marketId, address participant) external view returns (WrapPosition memory) {
        return _positions[marketId][participant];
    }

    function totalWrapped(uint256 marketId) external view returns (uint256) {
        return _configs[marketId].totalWrapped;
    }

    function remainingMarketCapacity(uint256 marketId) external view returns (uint256) {
        MarketWrapConfig storage cfg = _configs[marketId];
        if (cfg.wrapLimit == 0) return type(uint256).max;
        if (cfg.totalWrapped >= cfg.wrapLimit) return 0;
        return cfg.wrapLimit - cfg.totalWrapped;
    }

    function remainingUserCapacity(uint256 marketId, address participant) external view returns (uint256) {
        MarketWrapConfig storage cfg = _configs[marketId];
        if (cfg.userWrapLimit == 0) return type(uint256).max;
        uint256 balance = _positions[marketId][participant].wrappedBalance;
        if (balance >= cfg.userWrapLimit) return 0;
        return cfg.userWrapLimit - balance;
    }

    function getWrapHistory(uint256 marketId) external view returns (WrapRecord[] memory) {
        return _wrapHistory[marketId];
    }

    function getWrapOperationCount(uint256 marketId) external view returns (uint256) {
        return _wrapHistory[marketId].length;
    }

    function isMarketActive(uint256 marketId) external view returns (bool) {
        return _configs[marketId].active;
    }
}
