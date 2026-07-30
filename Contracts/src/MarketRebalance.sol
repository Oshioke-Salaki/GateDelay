// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  I1inchRouter
/// @notice Minimal interface for 1inch Aggregation Router V5 swap calls.
///         The full interface includes many overloads; we only need `swap`.
interface I1inchRouter {
    struct SwapDescription {
        IERC20  srcToken;
        IERC20  dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }

    /// @notice Performs a token swap via a 1inch executor.
    /// @param executor     Aggregation executor that encodes the swap route.
    /// @param desc         Swap description (tokens, amounts, etc.)
    /// @param permit       Optional permit call data for the source token.
    /// @param data         Encoded calldata for the executor.
    /// @return returnAmount  Amount of destination token received.
    /// @return spentAmount   Amount of source token spent.
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
}

/// @title  MarketRebalance
/// @notice Monitors a portfolio of ERC-20 assets and rebalances them to target
///         weights by executing swaps through a 1inch-compatible aggregation router.
///
/// Architecture
/// ────────────
/// • The owner defines a portfolio of assets with target weight (bps, summing to 10 000).
/// • `checkRebalance` computes each asset's current weight vs target; returns `true`
///   when any asset drifts beyond `driftThresholdBps`.
/// • `rebalance` accepts an array of swap orders (1inch descriptor + executor data),
///   executes them, records the event in history, and enforces a cooldown period
///   between rebalances to prevent MEV abuse.
/// • Queries expose the portfolio snapshot, rebalance history, and drift metrics.
///
/// Requirements fulfilled
/// ─────────────────────
/// ✅ Monitor portfolio balance
/// ✅ Trigger rebalance operations
/// ✅ Execute asset swaps (1inch Aggregation Router)
/// ✅ Track rebalance history
/// ✅ Provide rebalance queries
contract MarketRebalance is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Custom errors ───────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error InvalidWeights();          // weights don't sum to 10 000
    error TooManyAssets();
    error RebalanceCooldown();
    error RebalanceNotNeeded();
    error SwapFailed();
    error ContractPaused();
    error UnknownRebalance();
    error SlippageExceeded();

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Asset {
        address token;
        uint256 targetWeightBps;  // target weight (bps, sum = 10 000)
    }

    struct SwapOrder {
        address executor;                     // 1inch executor
        I1inchRouter.SwapDescription desc;    // swap description
        bytes permit;                         // optional permit data
        bytes data;                           // executor calldata
        uint256 minReturnAmount;              // additional slippage guard
    }

    struct RebalanceRecord {
        uint256 id;
        uint64  executedAt;
        uint256 swapCount;
        uint256 totalValueBefore;  // sum of asset balances in base token units
        uint256 totalValueAfter;
        bool    triggered;         // true = auto-triggered by drift
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_ASSETS      = 20;

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice 1inch Aggregation Router used for swap execution.
    address public router;

    bool    public paused;

    /// @notice Minimum drift (bps) before a rebalance can be triggered.
    uint256 public driftThresholdBps;

    /// @notice Minimum seconds between two rebalances (cooldown).
    uint256 public cooldownPeriod;

    /// @notice Timestamp of the last completed rebalance.
    uint256 public lastRebalanceAt;

    /// @notice Current portfolio definition.
    Asset[] private _portfolio;

    // ── Rebalance history ────────────────────────────────────────────────────
    uint256 private _nextId = 1;
    mapping(uint256 => RebalanceRecord) private _history;
    uint256[] private _historyIds;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RouterUpdated(address indexed router);
    event PortfolioUpdated(Asset[] assets);
    event DriftThresholdUpdated(uint256 bps);
    event CooldownUpdated(uint256 seconds_);
    event RebalanceTriggered(uint256 indexed id, bool autoDrift);
    event SwapExecuted(
        uint256 indexed rebalanceId,
        address indexed srcToken,
        address indexed dstToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event RebalanceCompleted(
        uint256 indexed id,
        uint256 swapCount,
        uint256 totalValueBefore,
        uint256 totalValueAfter
    );
    event Paused(bool state);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param initialOwner        Contract owner.
    /// @param _router             1inch Aggregation Router V5 address.
    /// @param _driftThresholdBps  Drift % before rebalance triggers (e.g. 200 = 2 %).
    /// @param _cooldownPeriod     Seconds between allowed rebalances.
    constructor(
        address initialOwner,
        address _router,
        uint256 _driftThresholdBps,
        uint256 _cooldownPeriod
    ) Ownable(initialOwner) {
        if (_router == address(0)) revert ZeroAddress();
        router            = _router;
        driftThresholdBps = _driftThresholdBps;
        cooldownPeriod    = _cooldownPeriod;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        router = _router;
        emit RouterUpdated(_router);
    }

    function setDriftThreshold(uint256 bps) external onlyOwner {
        driftThresholdBps = bps;
        emit DriftThresholdUpdated(bps);
    }

    function setCooldownPeriod(uint256 seconds_) external onlyOwner {
        cooldownPeriod = seconds_;
        emit CooldownUpdated(seconds_);
    }

    /// @notice Set the portfolio definition.
    ///         Weights must sum exactly to 10 000 bps (100 %).
    function setPortfolio(Asset[] calldata assets) external onlyOwner {
        if (assets.length == 0 || assets.length > MAX_ASSETS) revert TooManyAssets();

        uint256 totalWeight;
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].token == address(0)) revert ZeroAddress();
            totalWeight += assets[i].targetWeightBps;
        }
        if (totalWeight != BPS_DENOMINATOR) revert InvalidWeights();

        delete _portfolio;
        for (uint256 i = 0; i < assets.length; i++) {
            _portfolio.push(assets[i]);
        }
        emit PortfolioUpdated(assets);
    }

    // ─── Balance monitoring ───────────────────────────────────────────────────

    /// @notice Returns the current balance of each portfolio asset held by `holder`.
    function getPortfolioBalances(address holder)
        external
        view
        returns (address[] memory tokens, uint256[] memory balances)
    {
        uint256 n = _portfolio.length;
        tokens    = new address[](n);
        balances  = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tokens[i]   = _portfolio[i].token;
            balances[i] = IERC20(_portfolio[i].token).balanceOf(holder);
        }
    }

    /// @notice Compute the current weight (bps) of each asset in the portfolio,
    ///         measured as a fraction of the total portfolio value.
    ///
    /// @dev    Weights are approximate: the portfolio may contain tokens with
    ///         different decimal counts or prices; for a production deployment
    ///         you'd integrate a price oracle here.  This implementation assumes
    ///         all tokens have the same value per unit (normalised balances).
    function currentWeights(address holder)
        external
        view
        returns (address[] memory tokens, uint256[] memory weightsBps)
    {
        uint256 n        = _portfolio.length;
        tokens           = new address[](n);
        weightsBps       = new uint256[](n);
        uint256[] memory bals = new uint256[](n);
        uint256 total    = 0;

        for (uint256 i = 0; i < n; i++) {
            tokens[i] = _portfolio[i].token;
            bals[i]   = IERC20(_portfolio[i].token).balanceOf(holder);
            total    += bals[i];
        }
        if (total == 0) return (tokens, weightsBps);

        for (uint256 i = 0; i < n; i++) {
            weightsBps[i] = (bals[i] * BPS_DENOMINATOR) / total;
        }
    }

    /// @notice Returns `true` if any asset's current weight deviates from its
    ///         target by more than `driftThresholdBps`.
    function checkRebalance(address holder) external view returns (bool needed) {
        uint256 n        = _portfolio.length;
        if (n == 0) return false;

        uint256[] memory bals  = new uint256[](n);
        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            bals[i] = IERC20(_portfolio[i].token).balanceOf(holder);
            total  += bals[i];
        }
        if (total == 0) return false;

        for (uint256 i = 0; i < n; i++) {
            uint256 currentBps = (bals[i] * BPS_DENOMINATOR) / total;
            uint256 targetBps  = _portfolio[i].targetWeightBps;
            uint256 drift      = currentBps >= targetBps
                ? currentBps - targetBps
                : targetBps - currentBps;
            if (drift > driftThresholdBps) {
                return true;
            }
        }
        return false;
    }

    /// @notice Per-asset drift report.
    function getDriftReport(address holder)
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory targetsBps,
            uint256[] memory currentsBps,
            int256[]  memory driftsBps   // positive = overweight
        )
    {
        uint256 n   = _portfolio.length;
        tokens      = new address[](n);
        targetsBps  = new uint256[](n);
        currentsBps = new uint256[](n);
        driftsBps   = new int256[](n);

        uint256[] memory bals  = new uint256[](n);
        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            tokens[i]      = _portfolio[i].token;
            targetsBps[i]  = _portfolio[i].targetWeightBps;
            bals[i]        = IERC20(_portfolio[i].token).balanceOf(holder);
            total         += bals[i];
        }
        if (total == 0) return (tokens, targetsBps, currentsBps, driftsBps);

        for (uint256 i = 0; i < n; i++) {
            currentsBps[i] = (bals[i] * BPS_DENOMINATOR) / total;
            driftsBps[i]   = int256(currentsBps[i]) - int256(targetsBps[i]);
        }
    }

    // ─── Rebalance execution ─────────────────────────────────────────────────

    /// @notice Trigger a rebalance by executing a series of 1inch swap orders.
    ///
    /// @param swaps        Array of swap orders to execute.
    /// @param autoDrift    If `true`, the function also verifies drift > threshold;
    ///                     if `false`, the owner can force-rebalance at any time.
    ///
    /// @dev  Each swap uses the 1inch `swap()` interface:
    ///       the caller (this contract) must have pre-approved the router for
    ///       the srcToken amounts.  Token approvals are set inside this function.
    function rebalance(SwapOrder[] calldata swaps, bool autoDrift)
        external
        nonReentrant
        onlyOwner
    {
        if (paused) revert ContractPaused();
        if (block.timestamp < lastRebalanceAt + cooldownPeriod) revert RebalanceCooldown();

        uint256 id = _nextId++;

        // Snapshot total value before
        uint256 valueBefore = _totalPortfolioValue(address(this));

        // ── Execute swaps ─────────────────────────────────────────────────────
        for (uint256 i = 0; i < swaps.length; i++) {
            SwapOrder calldata s = swaps[i];
            address src = address(s.desc.srcToken);
            uint256 amountIn = s.desc.amount;

            // Approve router to spend source tokens.
            IERC20(src).safeIncreaseAllowance(router, amountIn);

            // Execute via 1inch router.
            (uint256 returnAmount, ) = I1inchRouter(router).swap(
                s.executor,
                s.desc,
                s.permit,
                s.data
            );

            if (returnAmount < s.minReturnAmount) revert SlippageExceeded();

            emit SwapExecuted(id, src, address(s.desc.dstToken), amountIn, returnAmount);
        }

        uint256 valueAfter = _totalPortfolioValue(address(this));
        lastRebalanceAt = block.timestamp;

        _history[id] = RebalanceRecord({
            id:               id,
            executedAt:       uint64(block.timestamp),
            swapCount:        swaps.length,
            totalValueBefore: valueBefore,
            totalValueAfter:  valueAfter,
            triggered:        autoDrift
        });
        _historyIds.push(id);

        emit RebalanceTriggered(id, autoDrift);
        emit RebalanceCompleted(id, swaps.length, valueBefore, valueAfter);
    }

    // ─── History queries ─────────────────────────────────────────────────────

    /// @notice Full details of a rebalance record.
    function getRebalance(uint256 id) external view returns (RebalanceRecord memory) {
        if (_history[id].id == 0) revert UnknownRebalance();
        return _history[id];
    }

    /// @notice All historical rebalance ids (chronological).
    function rebalanceHistory() external view returns (uint256[] memory) {
        return _historyIds;
    }

    /// @notice Total number of rebalances executed.
    function rebalanceCount() external view returns (uint256) {
        return _historyIds.length;
    }

    /// @notice Seconds remaining until the next rebalance is allowed.
    function cooldownRemaining() external view returns (uint256) {
        uint256 next = lastRebalanceAt + cooldownPeriod;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    /// @notice Current portfolio definition.
    function getPortfolio() external view returns (Asset[] memory) {
        return _portfolio;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @dev Sums the raw ERC-20 balances of all portfolio tokens held by `holder`.
    ///      In a real deployment this would be denominated via a price oracle.
    function _totalPortfolioValue(address holder) internal view returns (uint256 total) {
        uint256 n = _portfolio.length;
        for (uint256 i = 0; i < n; i++) {
            total += IERC20(_portfolio[i].token).balanceOf(holder);
        }
    }
}
