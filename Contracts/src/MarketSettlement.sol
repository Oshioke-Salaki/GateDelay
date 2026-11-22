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
    error ZeroAddress();

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
    event SettlementStatusUpdated(
        address indexed market,
        SettlementStatus oldStatus,
        SettlementStatus newStatus,
        uint256 oldDistributedAmount,
        uint256 newDistributedAmount,
        uint256 oldRemainingAmount,
        uint256 newRemainingAmount
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
        if (_positionToken == address(0) || _marketFactory == address(0) || _resolution == address(0)) {
            revert ZeroAddress();
        }
        positionToken = PositionToken(_positionToken);
        marketFactory = MarketFactory(_marketFactory);
        resolution = Resolution(_resolution);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Initiate settlement for a resolved market
    /// @param market Market address associated with this operation.
    /// @param pool Address associated with pool.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `MarketNotResolved` if `status != MarketFactory.MarketStatus.RESOLVED` is true.
    ///     `AlreadySettled` if `_settlements[market].status == SettlementStatus.COMPLETE` is true.
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
    /// @param market Market address associated with this operation.
    /// @param user User address affected by this operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `AlreadySettled` if `settlement.status == SettlementStatus.COMPLETE` is true.
    ///     `InvalidSettlementAmount` if `amount > settlement.remainingAmount` is true.
    function processPayout(
        address market,
        address user,
        uint256 amount
    ) external {
        Settlement storage settlement = _settlements[market];
        
        if (settlement.status == SettlementStatus.COMPLETE) revert AlreadySettled();
        if (amount > settlement.remainingAmount) revert InvalidSettlementAmount();
        SettlementStatus oldStatus = settlement.status;
        uint256 oldDistributedAmount = settlement.distributedAmount;
        uint256 oldRemainingAmount = settlement.remainingAmount;

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
        emit SettlementStatusUpdated(
            market,
            oldStatus,
            settlement.status,
            oldDistributedAmount,
            settlement.distributedAmount,
            oldRemainingAmount,
            settlement.remainingAmount
        );

        emit PayoutDistributed(market, user, amount);
    }

    /// @notice Process batch payouts
    /// @param market Market address associated with this operation.
    /// @param users Address associated with users.
    /// @param amounts Numeric amounts used by this operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `AlreadySettled` if `settlement.status == SettlementStatus.COMPLETE` is true.
    ///     `InvalidSettlementAmount` if `totalBatchAmount > settlement.remainingAmount` is true.
    ///     "Array length mismatch" if `users.length == amounts.length` is false.
    function processBatchPayouts(
        address market,
        address[] calldata users,
        uint256[] calldata amounts
    ) external {
        require(users.length == amounts.length, "Array length mismatch");

        Settlement storage settlement = _settlements[market];
        if (settlement.status == SettlementStatus.COMPLETE) revert AlreadySettled();
        SettlementStatus oldStatus = settlement.status;
        uint256 oldDistributedAmount = settlement.distributedAmount;
        uint256 oldRemainingAmount = settlement.remainingAmount;

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
        emit SettlementStatusUpdated(
            market,
            oldStatus,
            settlement.status,
            oldDistributedAmount,
            settlement.distributedAmount,
            oldRemainingAmount,
            settlement.remainingAmount
        );
    }

    /// @notice Get settlement info for a market
    /// @param market Market address associated with this operation.
    /// @return Settlement returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSettlement(address market) external view returns (Settlement memory) {
        return _settlements[market];
    }

    /// @notice Get payout records for a market
    /// @param market Market address associated with this operation.
    /// @return Payout records returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPayoutRecords(address market) external view returns (PayoutRecord[] memory) {
        return _payoutRecords[market];
    }

    /// @notice Get claimed payout for a user in a market
    /// @param market Market address associated with this operation.
    /// @param user User address affected by this operation.
    /// @return Claimed payout returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getClaimedPayout(address market, address user) external view returns (uint256) {
        return _claimedPayouts[market][user];
    }

    /// @notice Check if settlement is complete
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isSettlementComplete(address market) external view returns (bool) {
        return _settlements[market].status == SettlementStatus.COMPLETE;
    }

    /// @notice Get settlement status
    /// @param market Market address associated with this operation.
    /// @return Settlement status returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSettlementStatus(address market) external view returns (SettlementStatus) {
        return _settlements[market].status;
    }

    /// @notice Calculate remaining settlement amount
    /// @param market Market address associated with this operation.
    /// @return Remaining settlement returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRemainingSettlement(address market) external view returns (uint256) {
        return _settlements[market].remainingAmount;
    }
}
