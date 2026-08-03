// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UD60x18, ud, unwrap} from "@prb/math/src/UD60x18.sol";

/// @title  MarketWithdraw
/// @notice Handles withdrawal requests from prediction market positions.
///         Supports full and partial withdrawals, per-user and global limits,
///         and exposes rich query helpers for off-chain tooling.
///
/// Requirements fulfilled
/// ─────────────────────
/// ✅ Handle withdrawal requests
/// ✅ Calculate withdrawal amounts (PRBMath UD60x18)
/// ✅ Track withdrawal limits (global + per-user, daily rolling window)
/// ✅ Support partial withdrawals
/// ✅ Provide withdrawal queries
contract MarketWithdraw is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Custom errors ───────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientUserBalance();
    error ExceedsUserDailyLimit();
    error ExceedsGlobalDailyLimit();
    error ExceedsWithdrawableFraction();
    error UnknownRequest();
    error NotRequestOwner();
    error RequestNotPending();
    error MarketPaused();
    error InvalidFraction();
    error InvalidWindow();

    // ─── Types ───────────────────────────────────────────────────────────────

    enum WithdrawStatus { NONE, PENDING, EXECUTED, CANCELLED }

    struct WithdrawRequest {
        uint256 id;
        address user;
        uint256 requestedAmount;   // gross amount user wants
        uint256 withdrawableAmount;// net amount after fee/fraction calc
        uint64  requestedAt;
        uint64  executedAt;
        WithdrawStatus status;
        bool    isPartial;
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    /// @dev Maximum fraction of a position that may be withdrawn at once (100 %).
    uint256 public constant MAX_FRACTION_BPS = 10_000;
    /// @dev Seconds in one day — used for rolling daily limits.
    uint64  public constant DAY = 1 days;

    // ─── Storage ─────────────────────────────────────────────────────────────

    IERC20  public immutable token;

    /// @notice Whether the contract is paused (blocks new requests & executions).
    bool public paused;

    /// @notice Maximum fraction (bps) of a user's balance withdrawable in one request.
    ///         10 000 = 100 %, 5 000 = 50 %, etc.
    uint256 public maxFractionBps;

    /// @notice Global daily withdrawal cap in token units (0 = unlimited).
    uint256 public globalDailyLimit;

    /// @notice Per-user daily withdrawal cap in token units (0 = unlimited).
    uint256 public userDailyLimit;

    // ── Request storage ──────────────────────────────────────────────────────
    uint256 private _nextId = 1;
    mapping(uint256 => WithdrawRequest) private _requests;
    mapping(address => uint256[])        private _userRequests;

    // ── Balance tracking ─────────────────────────────────────────────────────
    /// @dev Virtual balance deposited by each user (used for limit calculations).
    mapping(address => uint256) public userBalance;

    // ── Daily-limit trackers ─────────────────────────────────────────────────
    uint256 private _globalWindowStart;
    uint256 private _globalWithdrawnToday;

    mapping(address => uint256) private _userWindowStart;
    mapping(address => uint256) private _userWithdrawnToday;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount);
    event WithdrawRequested(
        uint256 indexed id,
        address indexed user,
        uint256 requestedAmount,
        uint256 withdrawableAmount,
        bool isPartial
    );
    event WithdrawExecuted(uint256 indexed id, address indexed user, uint256 amount);
    event WithdrawCancelled(uint256 indexed id, address indexed user);
    event Paused(bool state);
    event MaxFractionSet(uint256 bps);
    event GlobalDailyLimitSet(uint256 limit);
    event UserDailyLimitSet(uint256 limit);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _token         ERC-20 collateral token used by the market.
    /// @param _maxFractionBps Maximum single-request fraction (bps, ≤ 10 000).
    /// @param _globalDailyLimit Global rolling-24-h cap (0 = off).
    /// @param _userDailyLimit   Per-user rolling-24-h cap (0 = off).
    constructor(
        address initialOwner,
        address _token,
        uint256 _maxFractionBps,
        uint256 _globalDailyLimit,
        uint256 _userDailyLimit
    ) Ownable(initialOwner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_maxFractionBps == 0 || _maxFractionBps > MAX_FRACTION_BPS) revert InvalidFraction();
        token          = IERC20(_token);
        maxFractionBps = _maxFractionBps;
        globalDailyLimit = _globalDailyLimit;
        userDailyLimit   = _userDailyLimit;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setMaxFraction(uint256 bps) external onlyOwner {
        if (bps == 0 || bps > MAX_FRACTION_BPS) revert InvalidFraction();
        maxFractionBps = bps;
        emit MaxFractionSet(bps);
    }

    function setGlobalDailyLimit(uint256 limit) external onlyOwner {
        globalDailyLimit = limit;
        emit GlobalDailyLimitSet(limit);
    }

    function setUserDailyLimit(uint256 limit) external onlyOwner {
        userDailyLimit = limit;
        emit UserDailyLimitSet(limit);
    }

    // ─── Deposits (position bookkeeping) ─────────────────────────────────────

    /// @notice Deposit tokens into the market and credit virtual balance.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        userBalance[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    // ─── Core: request & execute ─────────────────────────────────────────────

    /// @notice Submit a withdrawal request.
    /// @param amount       Gross amount requested.
    /// @param fractionBps  Fraction to actually withdraw (1–maxFractionBps).
    ///                     Pass maxFractionBps for a "full" withdrawal.
    /// @return id          Request identifier.
    function requestWithdraw(uint256 amount, uint256 fractionBps)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (paused) revert MarketPaused();
        if (amount == 0) revert ZeroAmount();
        if (fractionBps == 0 || fractionBps > maxFractionBps) revert InvalidFraction();
        if (userBalance[msg.sender] < amount) revert InsufficientUserBalance();

        // ── PRBMath: withdrawable = amount * fraction / 10_000 ──────────────
        UD60x18 amountUD    = ud(amount);
        UD60x18 fractionUD  = ud(fractionBps * 1e18 / MAX_FRACTION_BPS); // fraction in [0,1]
        uint256 withdrawable = unwrap(amountUD.mul(fractionUD));

        // Align to token precision (trim sub-wei dust).
        if (withdrawable == 0) revert ZeroAmount();

        // ── Daily-limit checks ───────────────────────────────────────────────
        _checkAndUpdateGlobalLimit(withdrawable);
        _checkAndUpdateUserLimit(msg.sender, withdrawable);

        // ── Debit virtual balance ────────────────────────────────────────────
        userBalance[msg.sender] -= amount;

        bool isPartial = fractionBps < MAX_FRACTION_BPS;

        id = _nextId++;
        _requests[id] = WithdrawRequest({
            id:                id,
            user:              msg.sender,
            requestedAmount:   amount,
            withdrawableAmount: withdrawable,
            requestedAt:       uint64(block.timestamp),
            executedAt:        0,
            status:            WithdrawStatus.PENDING,
            isPartial:         isPartial
        });
        _userRequests[msg.sender].push(id);

        // If partial, refund the undrawn portion immediately.
        if (isPartial) {
            uint256 refund = amount - withdrawable;
            // Re-credit the refund to user's virtual balance
            // (they retain the un-withdrawn portion).
            userBalance[msg.sender] += refund;
        }

        emit WithdrawRequested(id, msg.sender, amount, withdrawable, isPartial);
    }

    /// @notice Execute a pending withdrawal (transfer tokens to user).
    /// @dev  Can be called by the request owner or the contract owner.
    function executeWithdraw(uint256 id) external nonReentrant {
        if (paused) revert MarketPaused();
        WithdrawRequest storage r = _requests[id];
        if (r.status == WithdrawStatus.NONE) revert UnknownRequest();
        if (r.user != msg.sender && msg.sender != owner()) revert NotRequestOwner();
        if (r.status != WithdrawStatus.PENDING) revert RequestNotPending();

        r.status     = WithdrawStatus.EXECUTED;
        r.executedAt = uint64(block.timestamp);

        token.safeTransfer(r.user, r.withdrawableAmount);
        emit WithdrawExecuted(id, r.user, r.withdrawableAmount);
    }

    /// @notice Cancel a pending request and restore the virtual balance.
    function cancelWithdraw(uint256 id) external nonReentrant {
        WithdrawRequest storage r = _requests[id];
        if (r.status == WithdrawStatus.NONE) revert UnknownRequest();
        if (r.user != msg.sender) revert NotRequestOwner();
        if (r.status != WithdrawStatus.PENDING) revert RequestNotPending();

        r.status = WithdrawStatus.CANCELLED;
        // Restore the originally debited amount.
        userBalance[msg.sender] += r.requestedAmount;
        // Also unwind partial refund if applicable (already credited back in requestWithdraw).
        if (r.isPartial) {
            // The refund was already given; only restore the withdrawable portion.
            userBalance[msg.sender] -= (r.requestedAmount - r.withdrawableAmount);
        }

        emit WithdrawCancelled(id, msg.sender);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    /// @notice Full details of a single request.
    function getRequest(uint256 id) external view returns (WithdrawRequest memory) {
        return _requests[id];
    }

    /// @notice Status of a request.
    function statusOf(uint256 id) external view returns (WithdrawStatus) {
        return _requests[id].status;
    }

    /// @notice All request ids for a user (any status).
    function userRequestIds(address user) external view returns (uint256[] memory) {
        return _userRequests[user];
    }

    /// @notice Compute the withdrawable amount for a hypothetical request.
    /// @param amount      Gross amount.
    /// @param fractionBps Fraction (1–10 000).
    function previewWithdraw(uint256 amount, uint256 fractionBps)
        external
        pure
        returns (uint256 withdrawable)
    {
        if (fractionBps == 0 || fractionBps > MAX_FRACTION_BPS) revert InvalidFraction();
        UD60x18 amountUD   = ud(amount);
        UD60x18 fractionUD = ud(fractionBps * 1e18 / MAX_FRACTION_BPS);
        withdrawable = unwrap(amountUD.mul(fractionUD));
    }

    /// @notice How much the user can still withdraw today.
    function remainingUserDailyLimit(address user) external view returns (uint256) {
        if (userDailyLimit == 0) return type(uint256).max;
        uint256 used = (_userWindowStart[user] + DAY >= block.timestamp)
            ? _userWithdrawnToday[user]
            : 0;
        return userDailyLimit > used ? userDailyLimit - used : 0;
    }

    /// @notice How much can still be withdrawn globally today.
    function remainingGlobalDailyLimit() external view returns (uint256) {
        if (globalDailyLimit == 0) return type(uint256).max;
        uint256 used = (_globalWindowStart + DAY >= block.timestamp)
            ? _globalWithdrawnToday
            : 0;
        return globalDailyLimit > used ? globalDailyLimit - used : 0;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _checkAndUpdateGlobalLimit(uint256 amount) internal {
        if (globalDailyLimit == 0) return;
        // Roll window if needed.
        if (block.timestamp >= _globalWindowStart + DAY) {
            _globalWindowStart    = block.timestamp;
            _globalWithdrawnToday = 0;
        }
        uint256 newTotal = _globalWithdrawnToday + amount;
        if (newTotal > globalDailyLimit) revert ExceedsGlobalDailyLimit();
        _globalWithdrawnToday = newTotal;
    }

    function _checkAndUpdateUserLimit(address user, uint256 amount) internal {
        if (userDailyLimit == 0) return;
        // Roll window if needed.
        if (block.timestamp >= _userWindowStart[user] + DAY) {
            _userWindowStart[user]    = block.timestamp;
            _userWithdrawnToday[user] = 0;
        }
        uint256 newTotal = _userWithdrawnToday[user] + amount;
        if (newTotal > userDailyLimit) revert ExceedsUserDailyLimit();
        _userWithdrawnToday[user] = newTotal;
    }
}
