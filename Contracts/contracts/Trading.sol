// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketMaker.sol";
import "./ERC20Token.sol";

/// @title Trading – high-level trade execution with fees + taker referrer rebates
/// @notice Wraps MarketMaker with fee collection and a taker-based rebate on BUY only.
///         Sell-side fee/rebate is intentionally skipped to match current MarketMaker.sell() flow.
contract Trading {
    // ── State ─────────────────────────────────────────────────────────────────
    MarketMaker public immutable marketMaker;
    ERC20Token  public immutable collateral;
    address     public owner;

    /// @notice Total fee in basis points (e.g. 30 = 0.3%)
    uint256 public feeBps;

    /// @notice Portion of fee paid as rebate to taker referrer
    uint256 public rebateBps;

    /// @notice Remaining fee paid as commission to commissionRecipient
    uint256 public commissionBps;

    address public commissionRecipient;
    uint256 public accumulatedCommission;

    /// @dev Taker referrer (taker => referrer). Used for BUY rebates.
    mapping(address => address) public marketReferrer;

    // ── Events ────────────────────────────────────────────────────────────────
    event TradeExecuted(
        address indexed trader,
        uint256 indexed marketId,
        uint256 outcome,
        bool    isBuy,
        uint256 shares,
        uint256 collateralAmount,
        uint256 fee,
        uint256 rebate,
        address indexed referrer
    );

    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeeUpdated(uint256 feeBps, uint256 rebateBps, uint256 commissionBps);

    event MarketReferrerSet(address indexed trader, address indexed referrer);
    event CommissionRecipientUpdated(address indexed to);

    // ── Errors ────────────────────────────────────────────────────────────────
    error Unauthorized();
    error SlippageExceeded();
    error ZeroAmount();
    error InvalidFee();
    error InvalidReferrer();
    error InvalidRecipient();

    constructor(
        address _marketMaker,
        uint256 _feeBps,
        uint256 _rebateBps,
        address _commissionRecipient
    ) {
        require(_feeBps <= 1000, "Trading: fee > 10%");
        require(_rebateBps <= _feeBps, "Trading: rebate > fee");
        require(_commissionRecipient != address(0), "Trading: zero commissionRecipient");

        marketMaker = MarketMaker(_marketMaker);
        collateral  = MarketMaker(_marketMaker).collateral();
        owner       = msg.sender;

        feeBps = _feeBps;
        rebateBps = _rebateBps;
        commissionBps = _feeBps - _rebateBps;
        commissionRecipient = _commissionRecipient;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Referrer setter ───────────────────────────────────────────────────────

    function setMyMarketReferrer(address referrer) external {
        if (referrer == address(0) || referrer == msg.sender) revert InvalidReferrer();
        marketReferrer[msg.sender] = referrer;
        emit MarketReferrerSet(msg.sender, referrer);
    }

    // ── Trade execution ───────────────────────────────────────────────────────

    /// @notice Execute a buy order.
    /// @param marketId Target market
    /// @param outcome  Outcome index
    /// @param shares   Number of shares (WAD)
    /// @param maxCost  Max collateral willing to spend
    function executeBuy(
        uint256 marketId,
        uint256 outcome,
        uint256 shares,
        uint256 maxCost
    ) external {
        if (shares == 0) revert ZeroAmount();

        uint256 rawCost = marketMaker.getCostToBuy(marketId, outcome, shares);
        uint256 fee = _calcFee(rawCost);
        uint256 total = rawCost + fee;
        if (total > maxCost) revert SlippageExceeded();

        // Pull total from trader.
        collateral.transferFrom(msg.sender, address(this), total);

        uint256 rebate = _calcRebate(fee);
        address referrer = marketReferrer[msg.sender];

        uint256 commission = fee - rebate;
        accumulatedCommission += commission;

        if (rebate > 0 && referrer != address(0)) {
            collateral.transfer(referrer, rebate);
        } else {
            // No referrer set => rebate portion becomes commission.
            accumulatedCommission += rebate;
            rebate = 0;
        }

        // Execute trade
        collateral.approve(address(marketMaker), rawCost);
        marketMaker.buy(marketId, outcome, shares);

        emit TradeExecuted(msg.sender, marketId, outcome, true, shares, total, fee, rebate, referrer);
    }

    /// @notice Execute a sell order.
    /// @dev On-chain fee/rebate is skipped for sell to match MarketMaker.sell() collateral flow.
    function executeSell(
        uint256 marketId,
        uint256 outcome,
        uint256 shares,
        uint256 minProceeds
    ) external {
        if (shares == 0) revert ZeroAmount();

        // MarketMaker does not expose a sell proceeds view, so we use getCostToBuy as a proxy.
        uint256 rawProceeds = marketMaker.getCostToBuy(marketId, outcome, shares);
        if (rawProceeds < minProceeds) revert SlippageExceeded();

        // Execute sell. No on-chain fee/rebate taken.
        marketMaker.sell(marketId, outcome, shares);

        emit TradeExecuted(msg.sender, marketId, outcome, false, shares, rawProceeds, 0, 0, address(0));
    }

    // ── Fee management ───────────────────────────────────────────────────────

    function setFeeSplit(uint256 newFeeBps, uint256 newRebateBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        if (newRebateBps > newFeeBps) revert InvalidFee();
        feeBps = newFeeBps;
        rebateBps = newRebateBps;
        commissionBps = newFeeBps - newRebateBps;
        emit FeeUpdated(feeBps, rebateBps, commissionBps);
    }

    function setCommissionRecipient(address to) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        commissionRecipient = to;
        emit CommissionRecipientUpdated(to);
    }

    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        uint256 amount = accumulatedCommission;
        accumulatedCommission = 0;
        collateral.transfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _calcFee(uint256 amount) internal view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    function _calcRebate(uint256 totalFee) internal view returns (uint256) {
        if (rebateBps == 0 || totalFee == 0) return 0;
        // rebateBps is part of feeBps: rebate = fee * rebateBps / feeBps
        return (totalFee * rebateBps) / feeBps;
    }
}

