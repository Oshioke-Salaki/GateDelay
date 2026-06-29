// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PositionToken.sol";
import "./MarketFactory.sol";
import "./LiquidityPool.sol";
import "./Resolution.sol";

/// @title MarketSettlement
/// @notice Handles market settlements and payout distributions
contract MarketSettlement {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error MarketNotResolved();
    error AlreadySettled();
    error InvalidSettlementAmount();
    error SettlementNotComplete();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum SettlementStatus { PENDING, PARTIAL, COMPLETE, FAILED }

    struct Settlement {
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 remainingAmount;
        SettlementStatus status;
        uint256 settledAt;
        uint256 participantCount;
    }

    struct PayoutRecord {
        address recipient;
        uint256 amount;
        uint256 timestamp;
        bool claimed;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event SettlementInitiated(
        address indexed market,
        uint256 totalAmount,
        uint256 timestamp
    );
    event PayoutDistributed(
        address indexed market,
        address indexed recipient,
        uint256 amount
    );
    event SettlementCompleted(
        address indexed market,
        uint256 totalDistributed,
        uint256 participantCount
    );
    event PartialSettlementProcessed(
        address indexed market,
        uint256 amountDistributed,
        uint256 remainingAmount
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    MarketFactory public immutable marketFactory;
    Resolution public immutable resolution;

    /// @dev market => Settlement
    mapping(address => Settlement) private _settlements;

    /// @dev market => PayoutRecord[]
    mapping(address => PayoutRecord[]) private _payoutRecords;

    /// @dev market => user => claimed amount
    mapping(address => mapping(address => uint256)) private _claimedPayouts;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address _positionToken,
        address _marketFactory,
        address _resolution
    ) {
        positionToken = PositionToken(_positionToken);
        marketFactory = MarketFactory(_marketFactory);
        resolution = Resolution(_resolution);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Initiate settlement for a resolved market
    function initiateSettlement(address market, address pool) external {
        // Check market is resolved
        MarketFactory.MarketStatus status = resolution.getMarketStatus(market);
        if (status != MarketFactory.MarketStatus.RESOLVED) revert MarketNotResolved();

        // Check not already settled
        if (_settlements[market].status == SettlementStatus.COMPLETE) revert AlreadySettled();

        // Get total collateral available for distribution
        uint256 totalAmount = LiquidityPool(pool).totalLiquidity();

        _settlements[market] = Settlement({
            totalAmount: totalAmount,
            distributedAmount: 0,
            remainingAmount: totalAmount,
            status: SettlementStatus.PENDING,
            settledAt: block.timestamp,
            participantCount: 0
        });

        emit SettlementInitiated(market, totalAmount, block.timestamp);
    }

    /// @notice Process payout for a single user
    function processPayout(
        address market,
        address user,
        uint256 amount
    ) external {
        Settlement storage settlement = _settlements[market];
        
        if (settlement.status == SettlementStatus.COMPLETE) revert AlreadySettled();
        if (amount > settlement.remainingAmount) revert InvalidSettlementAmount();

        // Record payout
        _payoutRecords[market].push(PayoutRecord({
            recipient: user,
            amount: amount,
            timestamp: block.timestamp,
            claimed: false
        }));

        _claimedPayouts[market][user] += amount;

        // Update settlement
        settlement.distributedAmount += amount;
        settlement.remainingAmount -= amount;
        settlement.participantCount++;

        // Update status
        if (settlement.remainingAmount == 0) {
            settlement.status = SettlementStatus.COMPLETE;
            emit SettlementCompleted(market, settlement.distributedAmount, settlement.participantCount);
        } else {
            settlement.status = SettlementStatus.PARTIAL;
            emit PartialSettlementProcessed(market, amount, settlement.remainingAmount);
        }

        emit PayoutDistributed(market, user, amount);
    }

    /// @notice Process batch payouts
    function processBatchPayouts(
        address market,
        address[] calldata users,
        uint256[] calldata amounts
    ) external {
        require(users.length == amounts.length, "Array length mismatch");

        Settlement storage settlement = _settlements[market];
        if (settlement.status == SettlementStatus.COMPLETE) revert AlreadySettled();

        uint256 totalBatchAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalBatchAmount += amounts[i];
        }

        if (totalBatchAmount > settlement.remainingAmount) revert InvalidSettlementAmount();

        for (uint256 i = 0; i < users.length; i++) {
            _payoutRecords[market].push(PayoutRecord({
                recipient: users[i],
                amount: amounts[i],
                timestamp: block.timestamp,
                claimed: false
            }));

            _claimedPayouts[market][users[i]] += amounts[i];
            emit PayoutDistributed(market, users[i], amounts[i]);
        }

        settlement.distributedAmount += totalBatchAmount;
        settlement.remainingAmount -= totalBatchAmount;
        settlement.participantCount += users.length;

        if (settlement.remainingAmount == 0) {
            settlement.status = SettlementStatus.COMPLETE;
            emit SettlementCompleted(market, settlement.distributedAmount, settlement.participantCount);
        } else {
            settlement.status = SettlementStatus.PARTIAL;
            emit PartialSettlementProcessed(market, totalBatchAmount, settlement.remainingAmount);
        }
    }

    /// @notice Get settlement info for a market
    function getSettlement(address market) external view returns (Settlement memory) {
        return _settlements[market];
    }

    /// @notice Get payout records for a market
    function getPayoutRecords(address market) external view returns (PayoutRecord[] memory) {
        return _payoutRecords[market];
    }

    /// @notice Get claimed payout for a user in a market
    function getClaimedPayout(address market, address user) external view returns (uint256) {
        return _claimedPayouts[market][user];
    }

    /// @notice Check if settlement is complete
    function isSettlementComplete(address market) external view returns (bool) {
        return _settlements[market].status == SettlementStatus.COMPLETE;
    }

    /// @notice Get settlement status
    function getSettlementStatus(address market) external view returns (SettlementStatus) {
        return _settlements[market].status;
    }

    /// @notice Calculate remaining settlement amount
    function getRemainingSettlement(address market) external view returns (uint256) {
        return _settlements[market].remainingAmount;
    }
}
