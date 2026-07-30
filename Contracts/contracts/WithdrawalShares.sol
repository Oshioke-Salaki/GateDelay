// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  WithdrawalShares
/// @notice ERC-20 shares representing a claim on an underlying liquidity pool.
///
///         Users deposit the underlying token and receive `WithdrawalShares`
///         (WS) proportional to the pool.  When they want to leave they request
///         a redemption, which queues the burn & transfer, supporting partial
///         redemptions.  Share transfers are fully supported (standard ERC-20).
///
/// Requirements fulfilled
/// ─────────────────────
/// ✅ Calculate withdrawal shares (deposit → mint proportional WS)
/// ✅ Track share redemptions (per-redemption record, queryable)
/// ✅ Handle share burning (on redemption execution)
/// ✅ Support share transfers (standard ERC-20 transfer/transferFrom)
/// ✅ Provide share queries (balanceOf, totalSupply, previewShares, etc.)
contract WithdrawalShares is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Custom errors ───────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientShares();
    error UnknownRedemption();
    error NotRedemptionOwner();
    error RedemptionNotPending();
    error ContractPaused();
    error InsufficientPoolBalance();

    // ─── Types ───────────────────────────────────────────────────────────────

    enum RedemptionStatus { NONE, PENDING, EXECUTED, CANCELLED }

    struct RedemptionRecord {
        uint256 id;
        address user;
        uint256 shares;          // WS tokens burned on execution
        uint256 underlyingAmount;// underlying tokens to be returned
        uint64  requestedAt;
        uint64  executedAt;
        RedemptionStatus status;
    }

    // ─── Immutables / state ───────────────────────────────────────────────────

    IERC20  public immutable underlying;

    bool    public paused;

    uint256 public totalUnderlying;   // pool balance (excluding unredeemed pending)

    // ── Redemption storage ───────────────────────────────────────────────────
    uint256 private _nextId = 1;
    mapping(uint256 => RedemptionRecord) private _redemptions;
    mapping(address => uint256[])        private _userRedemptions;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 underlying, uint256 shares);
    event RedemptionRequested(
        uint256 indexed id,
        address indexed user,
        uint256 shares,
        uint256 underlyingAmount
    );
    event RedemptionExecuted(
        uint256 indexed id,
        address indexed user,
        uint256 shares,
        uint256 underlyingAmount
    );
    event RedemptionCancelled(uint256 indexed id, address indexed user, uint256 shares);
    event Paused(bool state);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param initialOwner  Contract owner.
    /// @param _underlying   Address of the underlying ERC-20 collateral token.
    constructor(address initialOwner, address _underlying)
        ERC20("Withdrawal Shares", "WS")
        Ownable(initialOwner)
    {
        if (_underlying == address(0)) revert ZeroAddress();
        underlying = IERC20(_underlying);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Deposit: underlying → WS ────────────────────────────────────────────

    /// @notice Deposit `amount` of underlying and receive proportional WS.
    /// @return shares  WS minted to the caller.
    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (paused) revert ContractPaused();
        if (amount == 0) revert ZeroAmount();

        shares = _calculateShares(amount);

        underlying.safeTransferFrom(msg.sender, address(this), amount);
        totalUnderlying += amount;
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, amount, shares);
    }

    // ─── Redemption: request ─────────────────────────────────────────────────

    /// @notice Queue a redemption for `shares` WS.
    ///         Tokens are locked (transferred to this contract) until execution.
    /// @param  shares  Amount of WS to redeem.
    /// @return id      Redemption record id.
    function requestRedemption(uint256 shares) external nonReentrant returns (uint256 id) {
        if (paused) revert ContractPaused();
        if (shares == 0) revert ZeroAmount();
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();

        uint256 underlyingAmount = _calculateUnderlying(shares);

        // Lock shares by transferring them to this contract.
        _transfer(msg.sender, address(this), shares);

        id = _nextId++;
        _redemptions[id] = RedemptionRecord({
            id:               id,
            user:             msg.sender,
            shares:           shares,
            underlyingAmount: underlyingAmount,
            requestedAt:      uint64(block.timestamp),
            executedAt:       0,
            status:           RedemptionStatus.PENDING
        });
        _userRedemptions[msg.sender].push(id);

        emit RedemptionRequested(id, msg.sender, shares, underlyingAmount);
    }

    // ─── Redemption: execute ─────────────────────────────────────────────────

    /// @notice Execute a pending redemption: burn the locked shares and
    ///         transfer the underlying to the user.
    /// @dev    Callable by the redemption owner or the contract owner.
    function executeRedemption(uint256 id) external nonReentrant {
        if (paused) revert ContractPaused();

        RedemptionRecord storage r = _redemptions[id];
        if (r.status == RedemptionStatus.NONE)    revert UnknownRedemption();
        if (r.user != msg.sender && msg.sender != owner()) revert NotRedemptionOwner();
        if (r.status != RedemptionStatus.PENDING) revert RedemptionNotPending();
        if (totalUnderlying < r.underlyingAmount) revert InsufficientPoolBalance();

        r.status     = RedemptionStatus.EXECUTED;
        r.executedAt = uint64(block.timestamp);

        // Burn locked shares.
        _burn(address(this), r.shares);

        // Return underlying.
        totalUnderlying -= r.underlyingAmount;
        underlying.safeTransfer(r.user, r.underlyingAmount);

        emit RedemptionExecuted(id, r.user, r.shares, r.underlyingAmount);
    }

    // ─── Redemption: cancel ───────────────────────────────────────────────────

    /// @notice Cancel a pending redemption and return locked shares to the caller.
    function cancelRedemption(uint256 id) external nonReentrant {
        RedemptionRecord storage r = _redemptions[id];
        if (r.status == RedemptionStatus.NONE)    revert UnknownRedemption();
        if (r.user != msg.sender)                  revert NotRedemptionOwner();
        if (r.status != RedemptionStatus.PENDING) revert RedemptionNotPending();

        r.status = RedemptionStatus.CANCELLED;

        // Return locked shares to owner.
        _transfer(address(this), r.user, r.shares);

        emit RedemptionCancelled(id, r.user, r.shares);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    /// @notice Full details of a redemption record.
    function getRedemption(uint256 id) external view returns (RedemptionRecord memory) {
        return _redemptions[id];
    }

    /// @notice Status of a redemption.
    function statusOf(uint256 id) external view returns (RedemptionStatus) {
        return _redemptions[id].status;
    }

    /// @notice All redemption ids for a user (any status).
    function userRedemptionIds(address user) external view returns (uint256[] memory) {
        return _userRedemptions[user];
    }

    /// @notice How many WS would be minted for a given underlying amount.
    function previewDeposit(uint256 amount) external view returns (uint256) {
        return _calculateShares(amount);
    }

    /// @notice How much underlying would be returned for `shares` WS.
    function previewRedemption(uint256 shares) external view returns (uint256) {
        return _calculateUnderlying(shares);
    }

    /// @notice Current share price expressed as underlying per WS (18 decimals).
    function sharePrice() external view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        return (totalUnderlying * 1e18) / totalSupply();
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    /// @dev Shares to mint for a deposit of `amount`.
    function _calculateShares(uint256 amount) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || totalUnderlying == 0) {
            // First depositor gets 1:1 shares.
            return amount;
        }
        return (amount * supply) / totalUnderlying;
    }

    /// @dev Underlying to return for a redemption of `shares`.
    function _calculateUnderlying(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (shares * totalUnderlying) / supply;
    }
}
