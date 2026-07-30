// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./PositionToken.sol";
import "./LiquidityPool.sol";

/// @title Resolution
/// @notice Manages the full lifecycle of market resolution, disputes, payouts, and refunds.
contract Resolution {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotResolver();
    error DeadlineNotPassed();
    error MarketNotOpen();
    error EmptyResolutionData();
    error DisputeWindowActive();
    error DisputeWindowElapsed();
    error NotWinningHolder();
    error MarketNotCancelled();
    error NotAdmin();
    error MarketNotDisputed();
    error MarketNotResolved();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum Outcome { NONE, YES, NO }

    struct ResolutionRecord {
        Outcome outcome;
        uint256 resolvedAt;
        bytes resolutionData;
        address resolver;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketResolved(address indexed market, Outcome outcome, address indexed resolver);
    event DisputeRaised(address indexed market, address indexed disputer, string evidenceURI);
    event PayoutClaimed(address indexed market, address indexed claimant, uint256 amount);
    event RefundClaimed(address indexed market, address indexed claimant, uint256 amount);

    // -------------------------------------------------------------------------
    // Immutable state
    // -------------------------------------------------------------------------
    uint256 public immutable disputeWindowSeconds;
    address public immutable resolver;
    address public immutable admin;
    PositionToken public immutable positionToken;

    // -------------------------------------------------------------------------
    // Mutable state
    // -------------------------------------------------------------------------
    mapping(address => ResolutionRecord) private _records;
    mapping(address => uint256) private _disputeWindowEnd;
    mapping(address => MarketFactory.MarketStatus) private _marketStatus;
    /// @dev market => LiquidityPool address
    mapping(address => address) private _pools;
    /// @dev market => resolution deadline
    mapping(address => uint256) private _deadlines;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        uint256 _disputeWindowSeconds,
        address _resolver,
        address _admin,
        address _positionToken
    ) {
        disputeWindowSeconds = _disputeWindowSeconds;
        resolver = _resolver;
        admin = _admin;
        positionToken = PositionToken(_positionToken);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Register a market with its pool and resolution deadline.
    /// @param market  The market address.
    /// @param pool    The LiquidityPool address for this market.
    /// @param deadline  The resolution deadline (Unix timestamp).
    function registerMarket(address market, address pool, uint256 deadline) external {
        _pools[market] = pool;
        _deadlines[market] = deadline;
        _marketStatus[market] = MarketFactory.MarketStatus.OPEN;
    }

    /// @notice Resolve a market with an outcome and supporting data.
    /// @param market   The market address.
    /// @param outcome  The resolution outcome (YES or NO).
    /// @param data     Non-empty resolution data bytes.
    function resolve(address market, Outcome outcome, bytes calldata data) external {
        if (msg.sender != resolver) revert NotResolver();
        if (block.timestamp <= _deadlines[market]) revert DeadlineNotPassed();
        if (_marketStatus[market] != MarketFactory.MarketStatus.OPEN) revert MarketNotOpen();
        if (data.length == 0) revert EmptyResolutionData();

        _records[market] = ResolutionRecord({
            outcome: outcome,
            resolvedAt: block.timestamp,
            resolutionData: data,
            resolver: msg.sender
        });

        _marketStatus[market] = MarketFactory.MarketStatus.RESOLVED;
        _disputeWindowEnd[market] = block.timestamp + disputeWindowSeconds;

        LiquidityPool(_pools[market]).setMarketStatus(MarketFactory.MarketStatus.RESOLVED);

        emit MarketResolved(market, outcome, msg.sender);
    }

    /// @notice Raise a dispute against a resolved market within the dispute window.
    /// @param market       The market address.
    /// @param evidenceURI  Non-empty URI pointing to dispute evidence.
    function dispute(address market, string calldata evidenceURI) external {
        if (_marketStatus[market] != MarketFactory.MarketStatus.RESOLVED) revert MarketNotResolved();
        if (block.timestamp > _disputeWindowEnd[market]) revert DisputeWindowElapsed();

        _marketStatus[market] = MarketFactory.MarketStatus.DISPUTED;
        LiquidityPool(_pools[market]).setMarketStatus(MarketFactory.MarketStatus.DISPUTED);

        emit DisputeRaised(market, msg.sender, evidenceURI);
    }

    /// @notice Settle a disputed market with a final outcome. Only callable by admin.
    /// @param market        The market address.
    /// @param finalOutcome  The final resolution outcome.
    function settleDispute(address market, Outcome finalOutcome) external {
        if (msg.sender != admin) revert NotAdmin();
        if (_marketStatus[market] != MarketFactory.MarketStatus.DISPUTED) revert MarketNotDisputed();

        _records[market].outcome = finalOutcome;
        _marketStatus[market] = MarketFactory.MarketStatus.RESOLVED;
        _disputeWindowEnd[market] = block.timestamp + disputeWindowSeconds;

        LiquidityPool(_pools[market]).setMarketStatus(MarketFactory.MarketStatus.RESOLVED);
    }

    /// @notice Claim payout for winning position tokens after the dispute window has elapsed.
    /// @param market  The market address.
    function claimPayout(address market) external {
        if (block.timestamp <= _disputeWindowEnd[market]) revert DisputeWindowActive();
        if (_marketStatus[market] != MarketFactory.MarketStatus.RESOLVED) revert MarketNotResolved();

        Outcome outcome = _records[market].outcome;
        uint256 winningId = outcome == Outcome.YES
            ? positionToken.yesId(market)
            : positionToken.noId(market);

        uint256 holderBalance = positionToken.balanceOf(msg.sender, winningId);
        if (holderBalance == 0) revert NotWinningHolder();

        uint256 totalWinningSupply = positionToken.totalSupply(winningId);
        LiquidityPool pool = LiquidityPool(_pools[market]);
        uint256 totalCollateral = pool.totalLiquidity();

        uint256 payout = (holderBalance * totalCollateral) / totalWinningSupply;

        // Burn winning tokens (self-burn: msg.sender == from is allowed)
        positionToken.burn(msg.sender, winningId, holderBalance);

        // Transfer payout from pool
        pool.withdrawForResolution(msg.sender, payout);

        emit PayoutClaimed(market, msg.sender, payout);
    }

    /// @notice Claim a refund for position tokens in a cancelled market.
    /// @param market  The market address.
    function claimRefund(address market) external {
        if (_marketStatus[market] != MarketFactory.MarketStatus.CANCELLED) revert MarketNotCancelled();

        uint256 yesId = positionToken.yesId(market);
        uint256 noId = positionToken.noId(market);

        uint256 yesBalance = positionToken.balanceOf(msg.sender, yesId);
        uint256 noBalance = positionToken.balanceOf(msg.sender, noId);
        uint256 totalTokens = yesBalance + noBalance;
        require(totalTokens > 0, "No tokens to refund");

        uint256 totalSupply = positionToken.totalSupply(yesId) + positionToken.totalSupply(noId);
        LiquidityPool pool = LiquidityPool(_pools[market]);
        uint256 refund = (totalTokens * pool.totalLiquidity()) / totalSupply;

        // Burn both token types
        if (yesBalance > 0) positionToken.burn(msg.sender, yesId, yesBalance);
        if (noBalance > 0) positionToken.burn(msg.sender, noId, noBalance);

        // Transfer refund from pool
        pool.withdrawForResolution(msg.sender, refund);

        emit RefundClaimed(market, msg.sender, refund);
    }

    /// @notice Cancel a market. Only callable by admin.
    /// @param market  The market address.
    function cancelMarket(address market) external {
        if (msg.sender != admin) revert NotAdmin();
        _marketStatus[market] = MarketFactory.MarketStatus.CANCELLED;
        LiquidityPool(_pools[market]).setMarketStatus(MarketFactory.MarketStatus.CANCELLED);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Returns the current market status tracked by Resolution.
    function getMarketStatus(address market) external view returns (MarketFactory.MarketStatus) {
        return _marketStatus[market];
    }

    /// @notice Returns the resolution record for a market.
    function getResolutionRecord(address market) external view returns (ResolutionRecord memory) {
        return _records[market];
    }

    /// @notice Returns the dispute window end timestamp for a market.
    function getDisputeWindowEnd(address market) external view returns (uint256) {
        return _disputeWindowEnd[market];
    }
}
