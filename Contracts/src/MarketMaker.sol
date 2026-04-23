// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LMSR.sol";
import "./ERC20Token.sol";

/// @title MarketMaker – LMSR-based prediction market
/// @notice Manages liquidity pools and outcome positions for binary/multi-outcome markets.
contract MarketMaker {
    using LMSR for uint256[];

    // ── Types ─────────────────────────────────────────────────────────────────
    struct Market {
        string   description;
        uint256  b;                  // LMSR liquidity parameter (WAD)
        uint256  numOutcomes;
        uint256[] quantities;        // q_i per outcome (WAD)
        bool     resolved;
        uint256  winningOutcome;
        address  creator;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    ERC20Token public immutable collateral;
    address    public owner;

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    // user => marketId => outcomeIndex => shares (WAD)
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public positions;

    // ── Events ────────────────────────────────────────────────────────────────
    event MarketCreated(uint256 indexed marketId, address indexed creator, uint256 numOutcomes, uint256 b);
    event SharesBought(uint256 indexed marketId, address indexed buyer, uint256 outcome, uint256 shares, uint256 cost);
    event SharesSold(uint256 indexed marketId, address indexed seller, uint256 outcome, uint256 shares, uint256 proceeds);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome);
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 payout);

    // ── Errors ────────────────────────────────────────────────────────────────
    error Unauthorized();
    error InvalidMarket();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InvalidOutcome();
    error InsufficientShares();
    error ZeroAmount();

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _collateral) {
        collateral = ERC20Token(_collateral);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Market lifecycle ──────────────────────────────────────────────────────

    /// @notice Create a new LMSR market.
    /// @param description  Human-readable description
    /// @param numOutcomes  Number of outcomes (>= 2)
    /// @param b            Liquidity parameter in WAD (e.g. 100e18)
    function createMarket(
        string calldata description,
        uint256 numOutcomes,
        uint256 b
    ) external returns (uint256 marketId) {
        require(numOutcomes >= 2, "MM: need >= 2 outcomes");
        require(b > 0, "MM: b must be > 0");

        marketId = marketCount++;
        Market storage m = markets[marketId];
        m.description  = description;
        m.b            = b;
        m.numOutcomes  = numOutcomes;
        m.creator      = msg.sender;
        m.quantities   = new uint256[](numOutcomes); // all zeros → equal prices

        emit MarketCreated(marketId, msg.sender, numOutcomes, b);
    }

    // ── Trading ───────────────────────────────────────────────────────────────

    /// @notice Buy `shares` of `outcome` in market `marketId`.
    function buy(uint256 marketId, uint256 outcome, uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        Market storage m = _activeMarket(marketId, outcome);

        uint256[] memory qNew = _copyQuantities(m);
        qNew[outcome] += shares;

        int256 netCost = LMSR.cost(m.quantities, qNew, m.b);
        require(netCost > 0, "MM: non-positive cost");
        uint256 costAmt = uint256(netCost);

        collateral.transferFrom(msg.sender, address(this), costAmt);
        m.quantities[outcome] += shares;
        positions[msg.sender][marketId][outcome] += shares;

        emit SharesBought(marketId, msg.sender, outcome, shares, costAmt);
    }

    /// @notice Sell `shares` of `outcome` in market `marketId`.
    function sell(uint256 marketId, uint256 outcome, uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (positions[msg.sender][marketId][outcome] < shares) revert InsufficientShares();
        Market storage m = _activeMarket(marketId, outcome);

        uint256[] memory qNew = _copyQuantities(m);
        qNew[outcome] -= shares;

        int256 netCost = LMSR.cost(m.quantities, qNew, m.b);
        require(netCost < 0, "MM: non-negative proceeds");
        uint256 proceeds = uint256(-netCost);

        m.quantities[outcome] -= shares;
        positions[msg.sender][marketId][outcome] -= shares;
        collateral.transfer(msg.sender, proceeds);

        emit SharesSold(marketId, msg.sender, outcome, shares, proceeds);
    }

    // ── Resolution & redemption ───────────────────────────────────────────────

    /// @notice Resolve a market (owner or creator only).
    function resolve(uint256 marketId, uint256 winningOutcome) external {
        Market storage m = markets[marketId];
        if (marketId >= marketCount) revert InvalidMarket();
        if (m.resolved) revert MarketAlreadyResolved();
        if (msg.sender != owner && msg.sender != m.creator) revert Unauthorized();
        if (winningOutcome >= m.numOutcomes) revert InvalidOutcome();

        m.resolved       = true;
        m.winningOutcome = winningOutcome;
        emit MarketResolved(marketId, winningOutcome);
    }

    /// @notice Redeem winning shares after resolution.
    function redeem(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (!m.resolved) revert MarketNotResolved();

        uint256 shares = positions[msg.sender][marketId][m.winningOutcome];
        if (shares == 0) revert ZeroAmount();

        positions[msg.sender][marketId][m.winningOutcome] = 0;
        collateral.transfer(msg.sender, shares); // 1 share = 1 collateral token
        emit Redeemed(marketId, msg.sender, shares);
    }

    // ── Price queries ─────────────────────────────────────────────────────────

    /// @notice Spot price of outcome `i` in WAD.
    function getPrice(uint256 marketId, uint256 outcome) external view returns (uint256) {
        Market storage m = markets[marketId];
        if (marketId >= marketCount) revert InvalidMarket();
        if (outcome >= m.numOutcomes) revert InvalidOutcome();
        return LMSR.price(m.quantities, m.b, outcome);
    }

    /// @notice Cost to buy `shares` of `outcome`.
    function getCostToBuy(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256[] memory qNew = _copyQuantities(m);
        qNew[outcome] += shares;
        int256 c = LMSR.cost(m.quantities, qNew, m.b);
        return c > 0 ? uint256(c) : 0;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _activeMarket(uint256 marketId, uint256 outcome) internal view returns (Market storage m) {
        if (marketId >= marketCount) revert InvalidMarket();
        m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (outcome >= m.numOutcomes) revert InvalidOutcome();
    }

    function _copyQuantities(Market storage m) internal view returns (uint256[] memory q) {
        uint256 len = m.numOutcomes;
        q = new uint256[](len);
        for (uint256 i = 0; i < len; i++) q[i] = m.quantities[i];
    }
}
