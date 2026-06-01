// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MarketPayout
/// @notice Manages payout calculation, distribution, and tracking for market winners.
contract MarketPayout is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidMarket();
    error InvalidRecipient();
    error InvalidAmount();
    error NoPayoutAvailable();
    error PayoutAlreadyClaimed();
    error PayoutFailed();
    error InsufficientFunds();
    error InvalidOutcome();
    error MarketNotResolved();
    error PayoutNotPending();
    error NotAuthorized();
    error ArrayLengthMismatch();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Outcome of a market
    enum Outcome {
        NONE,
        YES,
        NO
    }

    /// @notice Status of a payout
    enum PayoutStatus {
        NONE,
        PENDING,
        PARTIAL,
        COMPLETE,
        FAILED,
        RETRIED
    }

    /// @notice Market resolution information
    struct MarketResolution {
        address market;
        Outcome outcome;
        uint256 totalCollateral;
        uint256 resolvedAt;
        address resolver;
        bool finalized;
    }

    /// @notice Individual payout record
    struct PayoutRecord {
        address recipient;
        address market;
        uint256 amount;
        uint256 claimedAmount;
        PayoutStatus status;
        uint256 timestamp;
        uint256 claimedAt;
        string failureReason;
    }

    /// @notice Settlement summary for a market
    struct Settlement {
        address market;
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 failedAmount;
        uint256 pendingAmount;
        uint256 winnerCount;
        PayoutStatus status;
        uint256 settledAt;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketResolved(
        address indexed market,
        Outcome indexed outcome,
        uint256 totalCollateral,
        uint256 resolvedAt
    );

    event PayoutCalculated(
        address indexed market,
        address indexed recipient,
        uint256 amount
    );

    event PayoutInitiated(
        address indexed market,
        address indexed recipient,
        uint256 amount
    );

    event PayoutDistributed(
        address indexed market,
        address indexed recipient,
        uint256 amount
    );

    event PayoutFailureRecorded(
        address indexed market,
        address indexed recipient,
        uint256 amount,
        string reason
    );

    event PayoutRetried(
        address indexed market,
        address indexed recipient,
        uint256 amount
    );

    event PayoutClaimed(
        address indexed market,
        address indexed recipient,
        uint256 amount,
        uint256 claimedAt
    );

    event SettlementCompleted(
        address indexed market,
        uint256 totalDistributed,
        uint256 winnerCount
    );

    event SettlementPartial(
        address indexed market,
        uint256 distributed,
        uint256 failed,
        uint256 pending
    );

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant PAYOUT_TIMEOUT = 7 days;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address public admin;

    /// @dev market => MarketResolution
    mapping(address => MarketResolution) public resolutions;

    /// @dev market => recipient => PayoutRecord
    mapping(address => mapping(address => PayoutRecord)) public payoutRecords;

    /// @dev market => recipient[] (for tracking)
    mapping(address => address[]) public marketRecipients;

    /// @dev market => Settlement
    mapping(address => Settlement) public settlements;

    /// @dev market => failed recipients for retry
    mapping(address => address[]) public failedRecipients;

    /// @dev Mapping to track payout history
    mapping(address => mapping(address => PayoutRecord[])) public payoutHistory;

    /// @dev market => pending amount not yet distributed
    mapping(address => uint256) public pendingDistributions;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin");
        admin = _admin;
    }

    // -------------------------------------------------------------------------
    // Admin functions
    // -------------------------------------------------------------------------

    /// @notice Register market resolution
    function registerResolution(
        address market,
        Outcome outcome,
        uint256 totalCollateral,
        address resolver
    ) external {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());
        require(outcome != Outcome.NONE, InvalidOutcome());
        require(totalCollateral > 0, InvalidAmount());

        resolutions[market] = MarketResolution({
            market: market,
            outcome: outcome,
            totalCollateral: totalCollateral,
            resolvedAt: block.timestamp,
            resolver: resolver,
            finalized: true
        });

        pendingDistributions[market] = totalCollateral;

        emit MarketResolved(market, outcome, totalCollateral, block.timestamp);
    }

    /// @notice Update admin address
    function updateAdmin(address newAdmin) external {
        require(msg.sender == admin, NotAuthorized());
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }

    // -------------------------------------------------------------------------
    // Payout calculation and distribution
    // -------------------------------------------------------------------------

    /// @notice Calculate payout for a winner
    /// @param market Address of the market
    /// @param recipient Address of the winner
    /// @param winningBalance Balance of winning tokens
    /// @param totalWinningSupply Total supply of winning tokens
    /// @return payoutAmount Calculated payout amount
    function calculatePayout(
        address market,
        address recipient,
        uint256 winningBalance,
        uint256 totalWinningSupply
    ) external view returns (uint256 payoutAmount) {
        require(market != address(0), InvalidMarket());
        require(recipient != address(0), InvalidRecipient());
        require(winningBalance > 0, InvalidAmount());
        require(totalWinningSupply > 0, InvalidAmount());

        MarketResolution memory resolution = resolutions[market];
        require(resolution.finalized, MarketNotResolved());

        // Payout = (winning balance / total winning supply) × total collateral
        payoutAmount =
            (winningBalance * resolution.totalCollateral) /
            totalWinningSupply;

        return payoutAmount;
    }

    /// @notice Initiate payout for a single recipient
    function initiatePayout(
        address market,
        address recipient,
        uint256 payoutAmount
    ) external {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());
        require(recipient != address(0), InvalidRecipient());
        require(payoutAmount > 0, InvalidAmount());

        MarketResolution memory resolution = resolutions[market];
        require(resolution.finalized, MarketNotResolved());

        PayoutRecord storage record = payoutRecords[market][recipient];

        // Check if recipient already has a pending payout
        if (
            record.status == PayoutStatus.PENDING ||
            record.status == PayoutStatus.PARTIAL
        ) {
            revert PayoutAlreadyClaimed();
        }

        // Create or update payout record
        bool isNew = record.timestamp == 0;
        record.recipient = recipient;
        record.market = market;
        record.amount = payoutAmount;
        record.claimedAmount = 0;
        record.status = PayoutStatus.PENDING;
        record.timestamp = block.timestamp;
        record.failureReason = "";

        if (isNew) {
            marketRecipients[market].push(recipient);
        }

        emit PayoutInitiated(market, recipient, payoutAmount);
    }

    /// @notice Initiate batch payouts
    function initiateBatchPayouts(
        address market,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(msg.sender == admin, NotAuthorized());
        require(recipients.length == amounts.length, ArrayLengthMismatch());

        MarketResolution memory resolution = resolutions[market];
        require(resolution.finalized, MarketNotResolved());

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), InvalidRecipient());
            require(amounts[i] > 0, InvalidAmount());

            PayoutRecord storage record = payoutRecords[market][recipients[i]];

            if (
                record.status == PayoutStatus.PENDING ||
                record.status == PayoutStatus.PARTIAL
            ) {
                revert PayoutAlreadyClaimed();
            }

            bool isNew = record.timestamp == 0;
            record.recipient = recipients[i];
            record.market = market;
            record.amount = amounts[i];
            record.claimedAmount = 0;
            record.status = PayoutStatus.PENDING;
            record.timestamp = block.timestamp;
            record.failureReason = "";

            if (isNew) {
                marketRecipients[market].push(recipients[i]);
            }

            emit PayoutInitiated(market, recipients[i], amounts[i]);
        }
    }

    /// @notice Distribute payout to recipient (called by admin or automated system)
    function distributePayout(
        address market,
        address recipient
    ) external nonReentrant {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());
        require(recipient != address(0), InvalidRecipient());

        PayoutRecord storage record = payoutRecords[market][recipient];
        require(
            record.status == PayoutStatus.PENDING ||
                record.status == PayoutStatus.PARTIAL,
            PayoutNotPending()
        );

        uint256 amountToPay = record.amount - record.claimedAmount;
        require(amountToPay > 0, NoPayoutAvailable());

        require(
            pendingDistributions[market] >= amountToPay,
            InsufficientFunds()
        );

        // Update payout record
        record.claimedAmount += amountToPay;
        record.status = (record.claimedAmount >= record.amount)
            ? PayoutStatus.COMPLETE
            : PayoutStatus.PARTIAL;
        record.claimedAt = block.timestamp;

        // Update pending distributions
        pendingDistributions[market] -= amountToPay;

        // Add to history
        payoutHistory[market][recipient].push(record);

        emit PayoutDistributed(market, recipient, amountToPay);

        // Update settlement status
        _updateSettlement(market);
    }

    /// @notice Distribute batch payouts
    function distributeBatchPayouts(
        address market,
        address[] calldata recipients
    ) external nonReentrant {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), InvalidRecipient());

            PayoutRecord storage record = payoutRecords[market][recipients[i]];

            if (
                record.status != PayoutStatus.PENDING &&
                record.status != PayoutStatus.PARTIAL
            ) {
                continue;
            }

            uint256 amountToPay = record.amount - record.claimedAmount;
            if (
                amountToPay == 0 || pendingDistributions[market] < amountToPay
            ) {
                continue;
            }

            record.claimedAmount += amountToPay;
            record.status = (record.claimedAmount >= record.amount)
                ? PayoutStatus.COMPLETE
                : PayoutStatus.PARTIAL;
            record.claimedAt = block.timestamp;

            pendingDistributions[market] -= amountToPay;

            payoutHistory[market][recipients[i]].push(record);

            emit PayoutDistributed(market, recipients[i], amountToPay);
        }

        _updateSettlement(market);
    }

    /// @notice Mark payout as failed and add to retry queue
    function markPayoutFailed(
        address market,
        address recipient,
        string calldata reason
    ) external {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());
        require(recipient != address(0), InvalidRecipient());

        PayoutRecord storage record = payoutRecords[market][recipient];
        require(
            record.status == PayoutStatus.PENDING ||
                record.status == PayoutStatus.PARTIAL,
            PayoutNotPending()
        );

        record.status = PayoutStatus.FAILED;
        record.failureReason = reason;

        // Add to failed recipients for retry
        bool isAlreadyFailed = false;
        for (uint256 i = 0; i < failedRecipients[market].length; i++) {
            if (failedRecipients[market][i] == recipient) {
                isAlreadyFailed = true;
                break;
            }
        }
        if (!isAlreadyFailed) {
            failedRecipients[market].push(recipient);
        }

        emit PayoutFailureRecorded(
            market,
            recipient,
            record.amount - record.claimedAmount,
            reason
        );
    }

    /// @notice Retry failed payouts
    function retryFailedPayouts(
        address market,
        address[] calldata recipients
    ) external {
        require(msg.sender == admin, NotAuthorized());
        require(market != address(0), InvalidMarket());

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), InvalidRecipient());

            PayoutRecord storage record = payoutRecords[market][recipients[i]];
            require(record.status == PayoutStatus.FAILED, PayoutNotPending());

            record.status = PayoutStatus.RETRIED;
            record.failureReason = "";

            emit PayoutRetried(
                market,
                recipients[i],
                record.amount - record.claimedAmount
            );
        }
    }

    // -------------------------------------------------------------------------
    // Claim functions
    // -------------------------------------------------------------------------

    /// @notice Claim payout (called by recipient)
    function claimPayout(address market) external nonReentrant {
        require(market != address(0), InvalidMarket());

        PayoutRecord storage record = payoutRecords[market][msg.sender];
        require(record.status == PayoutStatus.COMPLETE, NoPayoutAvailable());

        uint256 unclaimedAmount = record.amount - record.claimedAmount;
        require(unclaimedAmount > 0, NoPayoutAvailable());

        record.claimedAmount = record.amount;
        record.claimedAt = block.timestamp;

        emit PayoutClaimed(
            market,
            msg.sender,
            unclaimedAmount,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Get resolution details for a market
    function getResolution(
        address market
    ) external view returns (MarketResolution memory) {
        return resolutions[market];
    }

    /// @notice Get payout record for a recipient
    function getPayoutRecord(
        address market,
        address recipient
    ) external view returns (PayoutRecord memory) {
        return payoutRecords[market][recipient];
    }

    /// @notice Get all payouts for a market
    function getMarketPayouts(
        address market
    ) external view returns (PayoutRecord[] memory) {
        address[] memory recipients = marketRecipients[market];
        PayoutRecord[] memory payouts = new PayoutRecord[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            payouts[i] = payoutRecords[market][recipients[i]];
        }

        return payouts;
    }

    /// @notice Get settlement status for a market
    function getSettlement(
        address market
    ) external view returns (Settlement memory) {
        return settlements[market];
    }

    /// @notice Get payout history for a recipient
    function getPayoutHistory(
        address market,
        address recipient
    ) external view returns (PayoutRecord[] memory) {
        return payoutHistory[market][recipient];
    }

    /// @notice Get recipients for a market
    function getMarketRecipients(
        address market
    ) external view returns (address[] memory) {
        return marketRecipients[market];
    }

    /// @notice Get failed recipients for a market
    function getFailedRecipients(
        address market
    ) external view returns (address[] memory) {
        return failedRecipients[market];
    }

    /// @notice Get pending distribution amount
    function getPendingDistribution(
        address market
    ) external view returns (uint256) {
        return pendingDistributions[market];
    }

    /// @notice Check if recipient has claimable payout
    function hasClaimablePayout(
        address market,
        address recipient
    ) external view returns (bool) {
        PayoutRecord memory record = payoutRecords[market][recipient];
        return
            record.status == PayoutStatus.COMPLETE &&
            record.claimedAmount < record.amount;
    }

    /// @notice Get claimable payout amount
    function getClaimableAmount(
        address market,
        address recipient
    ) external view returns (uint256) {
        PayoutRecord memory record = payoutRecords[market][recipient];
        if (record.status != PayoutStatus.COMPLETE) {
            return 0;
        }
        return record.amount - record.claimedAmount;
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    function _updateSettlement(address market) internal {
        address[] memory recipients = marketRecipients[market];
        uint256 totalDistributed = 0;
        uint256 totalFailed = 0;
        uint256 totalPending = 0;
        uint256 completedCount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            PayoutRecord memory record = payoutRecords[market][recipients[i]];

            if (record.status == PayoutStatus.COMPLETE) {
                totalDistributed += record.claimedAmount;
                completedCount++;
            } else if (record.status == PayoutStatus.FAILED) {
                totalFailed += (record.amount - record.claimedAmount);
            } else if (
                record.status == PayoutStatus.PENDING ||
                record.status == PayoutStatus.PARTIAL
            ) {
                totalPending += (record.amount - record.claimedAmount);
            }
        }

        PayoutStatus settlementStatus = PayoutStatus.PENDING;
        if (totalPending == 0 && totalFailed == 0) {
            settlementStatus = PayoutStatus.COMPLETE;
        } else if (totalDistributed > 0) {
            settlementStatus = PayoutStatus.PARTIAL;
        }

        settlements[market] = Settlement({
            market: market,
            totalAmount: resolutions[market].totalCollateral,
            distributedAmount: totalDistributed,
            failedAmount: totalFailed,
            pendingAmount: totalPending,
            winnerCount: recipients.length,
            status: settlementStatus,
            settledAt: block.timestamp
        });

        if (settlementStatus == PayoutStatus.COMPLETE) {
            emit SettlementCompleted(market, totalDistributed, completedCount);
        } else if (settlementStatus == PayoutStatus.PARTIAL) {
            emit SettlementPartial(
                market,
                totalDistributed,
                totalFailed,
                totalPending
            );
        }
    }
}
