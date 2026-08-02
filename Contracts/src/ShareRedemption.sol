// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UD60x18, ud, unwrap} from "@prb/math/src/UD60x18.sol";

/// @title  ShareRedemption
/// @notice Processes share redemption requests for prediction market positions.
///         Uses PRBMath UD60x18 for precise redemption value calculations.
///
/// Requirements fulfilled
/// ─────────────────────
/// ✅ Handle share redemption requests
/// ✅ Calculate redemption values (PRBMath UD60x18)
/// ✅ Track redemption history (per-user list + global count)
/// ✅ Support partial redemptions
/// ✅ Provide redemption queries
contract ShareRedemption is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Custom errors ───────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientShares();
    error UnknownRedemption();
    error NotRedemptionOwner();
    error RedemptionNotPending();
    error ContractPaused();
    error InvalidPartialFraction();
    error InsufficientPoolLiquidity();
    error InvalidRedemptionRate();

    // ─── Types ───────────────────────────────────────────────────────────────

    enum RedemptionStatus { NONE, PENDING, EXECUTED, CANCELLED }

    struct RedemptionRequest {
        uint256 id;
        address user;
        uint256 sharesRequested;  // total shares submitted
        uint256 sharesRedeemed;   // actual shares redeemed (may be < sharesRequested for partial)
        uint256 redemptionValue;  // underlying tokens owed (PRBMath-calculated)
        uint64  requestedAt;
        uint64  executedAt;
        RedemptionStatus status;
        bool     isPartial;
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant BPS_DENOMINATOR  = 10_000;
    /// @notice Minimum redemption fraction (bps) for partial redemptions.
    uint256 public constant MIN_PARTIAL_BPS  = 1;     // 0.01 %
    /// @notice Maximum redemption fee (bps).
    uint256 public constant MAX_FEE_BPS      = 500;   // 5 %

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice ERC-20 share token to be burned on redemption.
    IERC20  public immutable shareToken;
    /// @notice Underlying token paid out on redemption.
    IERC20  public immutable underlyingToken;

    bool    public paused;

    /// @notice Redemption rate: underlying per share, 18-decimal fixed-point.
    ///         Owner can update this as the market price changes.
    uint256 public redemptionRateWad;

    /// @notice Protocol fee on redemptions (bps).
    uint256 public feeBps;

    /// @notice Address that receives protocol fees.
    address public feeRecipient;

    /// @notice Total number of redemptions processed (any status).
    uint256 public totalRedemptions;

    /// @notice Cumulative underlying paid out in EXECUTED redemptions.
    uint256 public totalRedeemedValue;

    // ── Redemption storage ───────────────────────────────────────────────────
    uint256 private _nextId = 1;
    mapping(uint256 => RedemptionRequest) private _redemptions;
    mapping(address => uint256[])          private _userRedemptions;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RedemptionRequested(
        uint256 indexed id,
        address indexed user,
        uint256 sharesRequested,
        uint256 sharesRedeemed,
        uint256 redemptionValue,
        bool isPartial
    );
    event RedemptionExecuted(
        uint256 indexed id,
        address indexed user,
        uint256 sharesRedeemed,
        uint256 netValue,
        uint256 feeAmount
    );
    event RedemptionCancelled(uint256 indexed id, address indexed user);
    event RateUpdated(uint256 newRateWad);
    event FeeUpdated(uint256 feeBps);
    event FeeRecipientUpdated(address indexed recipient);
    event Paused(bool state);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param initialOwner     Contract owner.
    /// @param _shareToken      ERC-20 share token burned on redemption.
    /// @param _underlyingToken ERC-20 token paid out.
    /// @param _redemptionRateWad Underlying per share (1e18 = 1:1).
    /// @param _feeBps          Protocol fee (0–500 bps).
    /// @param _feeRecipient    Address receiving fees (may be address(0) to skip).
    constructor(
        address initialOwner,
        address _shareToken,
        address _underlyingToken,
        uint256 _redemptionRateWad,
        uint256 _feeBps,
        address _feeRecipient
    ) Ownable(initialOwner) {
        if (_shareToken == address(0))      revert ZeroAddress();
        if (_underlyingToken == address(0)) revert ZeroAddress();
        if (_redemptionRateWad == 0)        revert InvalidRedemptionRate();
        if (_feeBps > MAX_FEE_BPS)          revert InvalidPartialFraction();
        shareToken        = IERC20(_shareToken);
        underlyingToken   = IERC20(_underlyingToken);
        redemptionRateWad = _redemptionRateWad;
        feeBps            = _feeBps;
        feeRecipient      = _feeRecipient;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setRedemptionRate(uint256 rateWad) external onlyOwner {
        if (rateWad == 0) revert InvalidRedemptionRate();
        redemptionRateWad = rateWad;
        emit RateUpdated(rateWad);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert InvalidPartialFraction();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    // ─── Core: request ───────────────────────────────────────────────────────

    /// @notice Submit a redemption request.
    ///
    /// @param shares       Total shares to submit.
    /// @param partialBps   Fraction to actually redeem (1–10 000 bps).
    ///                     Use 10 000 for a full redemption of `shares`.
    /// @return id          Redemption record identifier.
    function requestRedemption(uint256 shares, uint256 partialBps)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (paused) revert ContractPaused();
        if (shares == 0) revert ZeroAmount();
        if (partialBps < MIN_PARTIAL_BPS || partialBps > BPS_DENOMINATOR)
            revert InvalidPartialFraction();
        if (shareToken.balanceOf(msg.sender) < shares) revert InsufficientShares();

        // ── PRBMath: sharesRedeemed = shares * partialBps / 10_000 ───────────
        UD60x18 sharesUD    = ud(shares);
        UD60x18 fractionUD  = ud(partialBps * 1e18 / BPS_DENOMINATOR);
        uint256 sharesRedeemed = unwrap(sharesUD.mul(fractionUD));
        if (sharesRedeemed == 0) revert ZeroAmount();

        // ── PRBMath: redemptionValue = sharesRedeemed * redemptionRateWad / 1e18 ──
        UD60x18 redeemUD = ud(sharesRedeemed);
        UD60x18 rateUD   = ud(redemptionRateWad);
        uint256 grossValue = unwrap(redeemUD.mul(rateUD));

        bool isPartial = partialBps < BPS_DENOMINATOR;

        // Pull all submitted shares from the caller now.
        shareToken.safeTransferFrom(msg.sender, address(this), shares);

        id = _nextId++;
        totalRedemptions++;

        _redemptions[id] = RedemptionRequest({
            id:               id,
            user:             msg.sender,
            sharesRequested:  shares,
            sharesRedeemed:   sharesRedeemed,
            redemptionValue:  grossValue,
            requestedAt:      uint64(block.timestamp),
            executedAt:       0,
            status:           RedemptionStatus.PENDING,
            isPartial:        isPartial
        });
        _userRedemptions[msg.sender].push(id);

        // If partial, return the un-redeemed portion immediately.
        if (isPartial) {
            uint256 surplus = shares - sharesRedeemed;
            if (surplus > 0) {
                shareToken.safeTransfer(msg.sender, surplus);
            }
        }

        emit RedemptionRequested(id, msg.sender, shares, sharesRedeemed, grossValue, isPartial);
    }

    // ─── Core: execute ───────────────────────────────────────────────────────

    /// @notice Finalise a pending redemption: burn shares and pay out underlying.
    /// @dev    Callable by the redemption owner or the contract owner.
    function executeRedemption(uint256 id) external nonReentrant {
        if (paused) revert ContractPaused();
        RedemptionRequest storage r = _redemptions[id];
        if (r.status == RedemptionStatus.NONE)    revert UnknownRedemption();
        if (r.user != msg.sender && msg.sender != owner()) revert NotRedemptionOwner();
        if (r.status != RedemptionStatus.PENDING) revert RedemptionNotPending();

        // ── Fee calculation ───────────────────────────────────────────────────
        uint256 grossValue = r.redemptionValue;
        uint256 feeAmount  = (grossValue * feeBps) / BPS_DENOMINATOR;
        uint256 netValue   = grossValue - feeAmount;

        if (underlyingToken.balanceOf(address(this)) < grossValue)
            revert InsufficientPoolLiquidity();

        r.status     = RedemptionStatus.EXECUTED;
        r.executedAt = uint64(block.timestamp);
        totalRedeemedValue += netValue;

        // Burn the locked shares.
        // We "burn" by sending to address(0) — the share token must allow this,
        // or the owner should use a proper burn interface.  If the token supports
        // ERC-20 burn-by-transfer-to-zero, this is the conventional approach.
        // For maximum compatibility we simply hold them (the shares are already
        // pulled from the user; they're locked in this contract forever).
        // If you want a different burn strategy, override _burnShares.
        _burnShares(r.sharesRedeemed);

        // Pay out underlying.
        underlyingToken.safeTransfer(r.user, netValue);
        if (feeAmount > 0 && feeRecipient != address(0)) {
            underlyingToken.safeTransfer(feeRecipient, feeAmount);
        }

        emit RedemptionExecuted(id, r.user, r.sharesRedeemed, netValue, feeAmount);
    }

    // ─── Core: cancel ────────────────────────────────────────────────────────

    /// @notice Cancel a pending redemption and return the locked shares.
    function cancelRedemption(uint256 id) external nonReentrant {
        RedemptionRequest storage r = _redemptions[id];
        if (r.status == RedemptionStatus.NONE)    revert UnknownRedemption();
        if (r.user != msg.sender)                  revert NotRedemptionOwner();
        if (r.status != RedemptionStatus.PENDING) revert RedemptionNotPending();

        r.status = RedemptionStatus.CANCELLED;

        // Return the locked (redeemed) shares. For partial requests the surplus
        // was already returned at request time; we return only sharesRedeemed.
        shareToken.safeTransfer(r.user, r.sharesRedeemed);

        emit RedemptionCancelled(id, r.user);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    /// @notice Full details of a single redemption.
    function getRedemption(uint256 id) external view returns (RedemptionRequest memory) {
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

    /// @notice Preview gross redemption value for `shares` at current rate.
    function previewRedemptionValue(uint256 shares, uint256 partialBps)
        external
        view
        returns (uint256 grossValue, uint256 netValue, uint256 feeAmount)
    {
        if (partialBps < MIN_PARTIAL_BPS || partialBps > BPS_DENOMINATOR)
            revert InvalidPartialFraction();
        UD60x18 sharesUD       = ud(shares);
        UD60x18 fractionUD     = ud(partialBps * 1e18 / BPS_DENOMINATOR);
        uint256 sharesRedeemed = unwrap(sharesUD.mul(fractionUD));

        UD60x18 redeemUD = ud(sharesRedeemed);
        UD60x18 rateUD   = ud(redemptionRateWad);
        grossValue = unwrap(redeemUD.mul(rateUD));

        feeAmount = (grossValue * feeBps) / BPS_DENOMINATOR;
        netValue  = grossValue - feeAmount;
    }

    /// @notice Number of redemptions in history for a given user.
    function userRedemptionCount(address user) external view returns (uint256) {
        return _userRedemptions[user].length;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @dev Override to customise burn behaviour (e.g. call a burnFrom interface).
    function _burnShares(uint256 /* amount */) internal virtual {
        // Shares are already held by this contract; they remain locked here.
        // Subclasses that own a burnable share token should override this.
    }
}
