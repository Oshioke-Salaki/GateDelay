// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketMaker.sol";
import "./ERC20Token.sol";

/// @title Trading – high-level trade execution with fees
/// @notice Wraps MarketMaker with fee collection, slippage protection, and trade events.
contract Trading {
    // ── State ─────────────────────────────────────────────────────────────────
    MarketMaker public immutable marketMaker;
    ERC20Token  public immutable collateral;
    address     public owner;

    /// @notice Fee in basis points (e.g. 30 = 0.3%)
    uint256 public feeBps;
    uint256 public accumulatedFees;

    // ── Events ────────────────────────────────────────────────────────────────
    event TradeExecuted(
        address indexed trader,
        uint256 indexed marketId,
        uint256 outcome,
        bool    isBuy,
        uint256 shares,
        uint256 collateralAmount,
        uint256 fee
    );
    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeeUpdated(uint256 newFeeBps);

    // ── Errors ────────────────────────────────────────────────────────────────
    error Unauthorized();
    error SlippageExceeded();
    error ZeroAmount();
    error InvalidFee();

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _marketMaker, uint256 _feeBps) {
        require(_feeBps <= 1000, "Trading: fee > 10%");
        marketMaker = MarketMaker(_marketMaker);
        collateral  = MarketMaker(_marketMaker).collateral();
        owner       = msg.sender;
        feeBps      = _feeBps;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Trade execution ───────────────────────────────────────────────────────

    /// @notice Execute a buy order.
    /// @param marketId   Target market
    /// @param outcome    Outcome index to buy
    /// @param shares     Number of shares (WAD)
    /// @param maxCost    Maximum collateral willing to spend (slippage guard)
    function executeBuy(
        uint256 marketId,
        uint256 outcome,
        uint256 shares,
        uint256 maxCost
    ) external {
        if (shares == 0) revert ZeroAmount();

        uint256 rawCost = marketMaker.getCostToBuy(marketId, outcome, shares);
        uint256 fee     = _calcFee(rawCost);
        uint256 total   = rawCost + fee;

        if (total > maxCost) revert SlippageExceeded();

        // Pull total from trader; fee stays in this contract
        collateral.transferFrom(msg.sender, address(this), total);
        accumulatedFees += fee;

        // Approve MarketMaker to pull rawCost
        collateral.approve(address(marketMaker), rawCost);
        marketMaker.buy(marketId, outcome, shares);

        // Forward shares to trader via MarketMaker position (positions are tracked by msg.sender in MM)
        // Note: positions are recorded under address(this) in MM; transfer ownership via internal accounting
        _positions[msg.sender][marketId][outcome] += shares;

        emit TradeExecuted(msg.sender, marketId, outcome, true, shares, total, fee);
    }

    /// @notice Execute a sell order.
    /// @param marketId   Target market
    /// @param outcome    Outcome index to sell
    /// @param shares     Number of shares (WAD)
    /// @param minProceeds Minimum collateral expected (slippage guard)
    function executeSell(
        uint256 marketId,
        uint256 outcome,
        uint256 shares,
        uint256 minProceeds
    ) external {
        if (shares == 0) revert ZeroAmount();
        if (_positions[msg.sender][marketId][outcome] < shares) revert ZeroAmount();

        // Sell through MarketMaker (Trading contract holds the MM position)
        marketMaker.sell(marketId, outcome, shares);
        _positions[msg.sender][marketId][outcome] -= shares;

        // Proceeds are now in this contract; deduct fee
        uint256 rawProceeds = _lastSellProceeds(marketId, outcome, shares);
        uint256 fee         = _calcFee(rawProceeds);
        uint256 net         = rawProceeds - fee;

        if (net < minProceeds) revert SlippageExceeded();

        accumulatedFees += fee;
        collateral.transfer(msg.sender, net);

        emit TradeExecuted(msg.sender, marketId, outcome, false, shares, net, fee);
    }

    // ── Fee management ────────────────────────────────────────────────────────

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        collateral.transfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    // ── Position queries ──────────────────────────────────────────────────────

    function getPosition(address trader, uint256 marketId, uint256 outcome) external view returns (uint256) {
        return _positions[trader][marketId][outcome];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    // trader => marketId => outcome => shares
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) private _positions;

    function _calcFee(uint256 amount) internal view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    /// @dev Re-query cost for the sell to get proceeds (MarketMaker already executed it,
    ///      so we use the collateral balance delta approach via getCostToBuy with negative direction).
    ///      In practice the proceeds were transferred to address(this) by MarketMaker.sell().
    function _lastSellProceeds(uint256 marketId, uint256 outcome, uint256 shares) internal view returns (uint256) {
        // After sell, MM quantities decreased; cost to buy back = proceeds received
        return marketMaker.getCostToBuy(marketId, outcome, shares);
    }
}
