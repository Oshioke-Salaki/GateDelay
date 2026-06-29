// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { UD60x18, ud, unwrap } from "@prb/math/src/UD60x18.sol";
import "../src/ERC20Token.sol";

/// @title Payout – market payout calculation and claim processing
/// @notice Supports three payout models:
///         WINNER_TAKE_ALL  – each winning share redeems 1 collateral token (standard binary market)
///         PROPORTIONAL     – winning-side pool is distributed pro-rata to share holders
///         SCALAR           – payout per share scales linearly between a floor and ceiling price
contract Payout {
    // ── Types ─────────────────────────────────────────────────────────────────

    enum PayoutModel { WINNER_TAKE_ALL, PROPORTIONAL, SCALAR }
    enum ClaimStatus { NONE, PENDING, CLAIMED }

    struct MarketPayout {
        PayoutModel model;
        bool        resolved;
        uint256     winningOutcome;
        uint256     totalPool;        // total collateral held (WAD)
        uint256     winningPool;      // collateral staked on winning outcome (WAD)
        /// @dev For SCALAR: settlement price in WAD (must be in [floorPrice, ceilPrice])
        uint256     settlementPrice;
        uint256     floorPrice;       // WAD – minimum payout per share for SCALAR
        uint256     ceilPrice;        // WAD – maximum payout per share for SCALAR
    }

    // ── State ─────────────────────────────────────────────────────────────────

    ERC20Token public immutable collateral;
    address    public owner;

    /// marketId => MarketPayout
    mapping(uint256 => MarketPayout) public markets;
    /// marketId => user => outcome => shares (WAD)
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public shares;
    /// marketId => outcome => total shares outstanding (WAD)
    mapping(uint256 => mapping(uint256 => uint256)) public totalShares;
    /// marketId => user => ClaimStatus
    mapping(uint256 => mapping(address => ClaimStatus)) public claimStatus;

    // ── Events ────────────────────────────────────────────────────────────────

    event MarketRegistered(uint256 indexed marketId, PayoutModel model);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome, uint256 settlementPrice);
    event SharesRecorded(uint256 indexed marketId, address indexed user, uint256 outcome, uint256 amount);
    event PayoutClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error AlreadyRegistered();
    error AlreadyResolved();
    error NotResolved();
    error AlreadyClaimed();
    error NothingToClaim();
    error InvalidPrice();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _collateral) {
        collateral = ERC20Token(_collateral);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Market setup ──────────────────────────────────────────────────────────

    /// @notice Register a new market with a chosen payout model.
    /// @param floorPrice  Only used for SCALAR; ignored otherwise (pass 0).
    /// @param ceilPrice   Only used for SCALAR; ignored otherwise (pass 0).
    function registerMarket(
        uint256    marketId,
        PayoutModel model,
        uint256    floorPrice,
        uint256    ceilPrice
    ) external onlyOwner {
        if (markets[marketId].totalPool != 0 || markets[marketId].resolved) revert AlreadyRegistered();
        if (model == PayoutModel.SCALAR) {
            if (floorPrice >= ceilPrice) revert InvalidPrice();
        }
        markets[marketId] = MarketPayout({
            model:           model,
            resolved:        false,
            winningOutcome:  0,
            totalPool:       0,
            winningPool:     0,
            settlementPrice: 0,
            floorPrice:      floorPrice,
            ceilPrice:       ceilPrice
        });
        emit MarketRegistered(marketId, model);
    }

    /// @notice Record shares purchased by a user (called by the trading layer).
    function recordShares(uint256 marketId, address user, uint256 outcome, uint256 amount) external onlyOwner {
        shares[marketId][user][outcome]  += amount;
        totalShares[marketId][outcome]   += amount;
        markets[marketId].totalPool      += amount; // 1 share costs 1 collateral in WINNER_TAKE_ALL
        emit SharesRecorded(marketId, user, outcome, amount);
    }

    /// @notice Resolve a market.
    /// @param settlementPrice  For SCALAR: final price in WAD within [floor, ceil].
    ///                         For other models: ignored (pass 0).
    function resolveMarket(
        uint256 marketId,
        uint256 winningOutcome,
        uint256 settlementPrice
    ) external onlyOwner {
        MarketPayout storage m = markets[marketId];
        if (m.resolved) revert AlreadyResolved();

        m.resolved       = true;
        m.winningOutcome = winningOutcome;
        m.winningPool    = totalShares[marketId][winningOutcome];

        if (m.model == PayoutModel.SCALAR) {
            if (settlementPrice < m.floorPrice || settlementPrice > m.ceilPrice) revert InvalidPrice();
            m.settlementPrice = settlementPrice;
        }

        emit MarketResolved(marketId, winningOutcome, settlementPrice);
    }

    // ── Payout calculation ────────────────────────────────────────────────────

    /// @notice Calculate the payout owed to `user` for `marketId`.
    /// @dev    Pure view – does not transfer tokens.
    function calculatePayout(uint256 marketId, address user) public view returns (uint256 payout) {
        MarketPayout storage m = markets[marketId];
        if (!m.resolved) revert NotResolved();

        uint256 userShares = shares[marketId][user][m.winningOutcome];
        if (userShares == 0) return 0;

        if (m.model == PayoutModel.WINNER_TAKE_ALL) {
            // 1 winning share → 1 collateral token
            payout = userShares;

        } else if (m.model == PayoutModel.PROPORTIONAL) {
            // user's share of the winning pool × total pool
            // payout = (userShares / winningPool) * totalPool
            UD60x18 ratio = ud(userShares).div(ud(m.winningPool));
            payout = unwrap(ratio.mul(ud(m.totalPool)));

        } else {
            // SCALAR: payout per share scales linearly between floor and ceil
            // payoutPerShare = floor + (settlement - floor) * (ceil - floor) / (ceil - floor)
            //                = settlementPrice  (already clamped to [floor, ceil])
            // payout = userShares * settlementPrice / WAD
            UD60x18 payoutPerShare = ud(m.settlementPrice);
            payout = unwrap(ud(userShares).mul(payoutPerShare));
        }
    }

    // ── Claim processing ──────────────────────────────────────────────────────

    /// @notice Claim payout for the caller.
    function claim(uint256 marketId) external {
        if (claimStatus[marketId][msg.sender] == ClaimStatus.CLAIMED) revert AlreadyClaimed();

        uint256 amount = calculatePayout(marketId, msg.sender);
        if (amount == 0) revert NothingToClaim();

        claimStatus[marketId][msg.sender] = ClaimStatus.CLAIMED;
        collateral.transfer(msg.sender, amount);

        emit PayoutClaimed(marketId, msg.sender, amount);
    }

    /// @notice Check claim status for a user.
    function getClaimStatus(uint256 marketId, address user) external view returns (ClaimStatus) {
        return claimStatus[marketId][user];
    }
}
