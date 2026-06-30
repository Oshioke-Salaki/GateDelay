// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UnwrapFunction
/// @notice Handles the unwrap side of a token-wrapping system: holders unwind a wrapped
/// balance back into the underlying ERC20 asset, subject to per-transaction and rolling
/// per-period unwrap limits. Wrapped balances themselves are credited by a controller
/// (e.g. the contract responsible for the wrap side), so this contract focuses solely on
/// unwrap logic, limits, partial unwraps, and tracking.
contract UnwrapFunction {
    using SafeERC20 for IERC20;

    struct MarketUnwrapConfig {
        address token;             // underlying ERC20 released on unwrap
        uint256 maxUnwrapPerTx;    // cap on a single unwrap call, 0 = no per-tx cap
        uint256 maxUnwrapPerPeriod;// cap on total unwrapped per participant within periodDuration, 0 = no cap
        uint256 periodDuration;    // length of the rolling window in seconds, 0 = no period tracking
        bool active;
    }

    struct UnwrapPosition {
        uint256 wrappedBalance;        // current balance available to unwrap
        uint256 totalUnwrapped;        // lifetime amount unwrapped
        uint256 unwrapCount;           // number of unwrap operations (including partials)
        uint256 periodUnwrapped;       // amount unwrapped within the current rolling period
        uint256 periodStart;           // timestamp the current rolling period began
    }

    struct UnwrapRecord {
        uint256 marketId;
        address participant;
        uint256 amount;
        uint256 remainingBalance;
        bool wasPartial;       // true if amount < wrappedBalance at the time of the call
        uint256 timestamp;
    }

    address public immutable controller;

    mapping(uint256 => MarketUnwrapConfig) private _configs;
    mapping(uint256 => mapping(address => UnwrapPosition)) private _positions;
    mapping(uint256 => UnwrapRecord[]) private _unwrapHistory;

    event MarketConfigured(
        uint256 indexed marketId,
        address indexed token,
        uint256 maxUnwrapPerTx,
        uint256 maxUnwrapPerPeriod,
        uint256 periodDuration
    );
    event UnwrapLimitsUpdated(uint256 indexed marketId, uint256 maxUnwrapPerTx, uint256 maxUnwrapPerPeriod, uint256 periodDuration);
    event WrappedBalanceCredited(uint256 indexed marketId, address indexed participant, uint256 amount, uint256 newBalance);
    event Unwrapped(uint256 indexed marketId, address indexed participant, uint256 amount, uint256 remainingBalance, bool wasPartial);

    error UnwrapFunction__NotController(address caller);
    error UnwrapFunction__MarketNotActive(uint256 marketId);
    error UnwrapFunction__MarketAlreadyConfigured(uint256 marketId);
    error UnwrapFunction__InvalidToken();
    error UnwrapFunction__ZeroAmount();
    error UnwrapFunction__InsufficientWrappedBalance(uint256 requested, uint256 available);
    error UnwrapFunction__ExceedsPerTxLimit(uint256 requested, uint256 limit);
    error UnwrapFunction__ExceedsPeriodLimit(uint256 requested, uint256 available);

    constructor(address _controller) {
        controller = _controller;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert UnwrapFunction__NotController(msg.sender);
        _;
    }

    modifier onlyActiveMarket(uint256 marketId) {
        if (!_configs[marketId].active) revert UnwrapFunction__MarketNotActive(marketId);
        _;
    }

    // ---------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------

    /// @param maxUnwrapPerTx Maximum amount allowed in a single unwrap call. 0 = unlimited.
    /// @param maxUnwrapPerPeriod Maximum amount a participant may unwrap within `periodDuration`. 0 = unlimited.
    /// @param periodDuration Length of the rolling unwrap window in seconds. Ignored if maxUnwrapPerPeriod is 0.
    function configureMarket(
        uint256 marketId,
        address token,
        uint256 maxUnwrapPerTx,
        uint256 maxUnwrapPerPeriod,
        uint256 periodDuration
    ) external onlyController {
        if (_configs[marketId].active) revert UnwrapFunction__MarketAlreadyConfigured(marketId);
        if (token == address(0)) revert UnwrapFunction__InvalidToken();

        _configs[marketId] = MarketUnwrapConfig({
            token: token,
            maxUnwrapPerTx: maxUnwrapPerTx,
            maxUnwrapPerPeriod: maxUnwrapPerPeriod,
            periodDuration: periodDuration,
            active: true
        });

        emit MarketConfigured(marketId, token, maxUnwrapPerTx, maxUnwrapPerPeriod, periodDuration);
    }

    function updateUnwrapLimits(
        uint256 marketId,
        uint256 maxUnwrapPerTx,
        uint256 maxUnwrapPerPeriod,
        uint256 periodDuration
    ) external onlyController onlyActiveMarket(marketId) {
        MarketUnwrapConfig storage cfg = _configs[marketId];
        cfg.maxUnwrapPerTx = maxUnwrapPerTx;
        cfg.maxUnwrapPerPeriod = maxUnwrapPerPeriod;
        cfg.periodDuration = periodDuration;

        emit UnwrapLimitsUpdated(marketId, maxUnwrapPerTx, maxUnwrapPerPeriod, periodDuration);
    }

    /// @notice Credit a participant's wrapped balance, making it available to unwrap.
    /// @dev Called by the controller (e.g. the wrap-side contract) once the underlying asset
    /// has actually been deposited into this contract on the participant's behalf.
    function creditWrappedBalance(uint256 marketId, address participant, uint256 amount)
        external
        onlyController
        onlyActiveMarket(marketId)
    {
        if (amount == 0) revert UnwrapFunction__ZeroAmount();

        UnwrapPosition storage pos = _positions[marketId][participant];
        pos.wrappedBalance += amount;

        emit WrappedBalanceCredited(marketId, participant, amount, pos.wrappedBalance);
    }

    // ---------------------------------------------------------------
    // Unwrap
    // ---------------------------------------------------------------

    /// @notice Unwrap `amount` of the caller's wrapped balance, releasing the underlying asset.
    /// Supports partial unwraps: `amount` may be less than the full wrapped balance.
    function unwrap(uint256 marketId, uint256 amount) external onlyActiveMarket(marketId) {
        if (amount == 0) revert UnwrapFunction__ZeroAmount();

        MarketUnwrapConfig storage cfg = _configs[marketId];
        UnwrapPosition storage pos = _positions[marketId][msg.sender];

        if (amount > pos.wrappedBalance) {
            revert UnwrapFunction__InsufficientWrappedBalance(amount, pos.wrappedBalance);
        }

        if (cfg.maxUnwrapPerTx != 0 && amount > cfg.maxUnwrapPerTx) {
            revert UnwrapFunction__ExceedsPerTxLimit(amount, cfg.maxUnwrapPerTx);
        }

        if (cfg.maxUnwrapPerPeriod != 0) {
            _rollPeriodIfElapsed(cfg, pos);

            uint256 periodAvailable = cfg.maxUnwrapPerPeriod - pos.periodUnwrapped;
            if (amount > periodAvailable) {
                revert UnwrapFunction__ExceedsPeriodLimit(amount, periodAvailable);
            }

            pos.periodUnwrapped += amount;
        }

        bool wasPartial = amount < pos.wrappedBalance;

        pos.wrappedBalance -= amount;
        pos.totalUnwrapped += amount;
        pos.unwrapCount += 1;

        _unwrapHistory[marketId].push(
            UnwrapRecord({
                marketId: marketId,
                participant: msg.sender,
                amount: amount,
                remainingBalance: pos.wrappedBalance,
                wasPartial: wasPartial,
                timestamp: block.timestamp
            })
        );

        emit Unwrapped(marketId, msg.sender, amount, pos.wrappedBalance, wasPartial);

        IERC20(cfg.token).safeTransfer(msg.sender, amount);
    }

    function _rollPeriodIfElapsed(MarketUnwrapConfig storage cfg, UnwrapPosition storage pos) private {
        if (pos.periodStart == 0 || block.timestamp >= pos.periodStart + cfg.periodDuration) {
            pos.periodStart = block.timestamp;
            pos.periodUnwrapped = 0;
        }
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function getMarketConfig(uint256 marketId) external view returns (MarketUnwrapConfig memory) {
        return _configs[marketId];
    }

    function getPosition(uint256 marketId, address participant) external view returns (UnwrapPosition memory) {
        return _positions[marketId][participant];
    }

    function wrappedBalanceOf(uint256 marketId, address participant) external view returns (uint256) {
        return _positions[marketId][participant].wrappedBalance;
    }

    /// @notice Amount the participant could still unwrap right now under the per-period limit,
    /// accounting for whether the current period has already elapsed. Does not account for
    /// the per-tx cap or the participant's wrapped balance — combine with those separately.
    function remainingPeriodCapacity(uint256 marketId, address participant) external view returns (uint256) {
        MarketUnwrapConfig storage cfg = _configs[marketId];
        if (cfg.maxUnwrapPerPeriod == 0) return type(uint256).max;

        UnwrapPosition storage pos = _positions[marketId][participant];

        if (pos.periodStart == 0 || block.timestamp >= pos.periodStart + cfg.periodDuration) {
            return cfg.maxUnwrapPerPeriod;
        }

        if (pos.periodUnwrapped >= cfg.maxUnwrapPerPeriod) return 0;
        return cfg.maxUnwrapPerPeriod - pos.periodUnwrapped;
    }

    function maxSingleUnwrap(uint256 marketId) external view returns (uint256) {
        uint256 cap = _configs[marketId].maxUnwrapPerTx;
        return cap == 0 ? type(uint256).max : cap;
    }

    function getUnwrapHistory(uint256 marketId) external view returns (UnwrapRecord[] memory) {
        return _unwrapHistory[marketId];
    }

    function getUnwrapOperationCount(uint256 marketId) external view returns (uint256) {
        return _unwrapHistory[marketId].length;
    }

    function isMarketActive(uint256 marketId) external view returns (bool) {
        return _configs[marketId].active;
    }
}
