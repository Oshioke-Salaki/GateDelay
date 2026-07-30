// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarketCompound
 * @notice Implements compounding functionality for markets with yield calculation,
 *         compound operations, history tracking, fee handling, and query support.
 */
contract MarketCompound is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InvalidFeeBps();
    error MarketNotFound();
    error MarketNotActive();
    error InsufficientBalance();
    error NoYieldToCompound();
    error TransferFailed();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct Market {
        uint256 id;
        string name;
        uint256 baseYieldRate;     // Base yield rate per second (scaled by 1e18)
        uint256 accCompoundPerShare; // Accumulated compound per share (scaled by 1e12)
        uint256 lastUpdateTime;   // Timestamp of last update
        uint256 totalDeposits;     // Total deposits in this market
        uint256 feeBps;           // Compound fee in basis points
        bool isActive;             // Status of the market
    }

    struct UserPosition {
        uint256 depositAmount;     // Amount deposited by user
        uint256 yieldDebt;         // Yield debt
        uint256 accumulatedYield; // Unclaimed yield accumulated
    }

    struct CompoundRecord {
        uint256 marketId;
        address user;
        address compunder;
        uint256 yieldAmount;
        uint256 feeAmount;
        uint256 netAmount;
        uint256 timestamp;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event MarketAdded(
        uint256 indexed marketId,
        string name,
        uint256 baseYieldRate,
        uint256 feeBps
    );
    event MarketUpdated(
        uint256 indexed marketId,
        uint256 baseYieldRate,
        uint256 feeBps,
        bool isActive
    );
    event Deposited(uint256 indexed marketId, address indexed user, uint256 amount);
    event Withdrawn(uint256 indexed marketId, address indexed user, uint256 amount);
    event Compounded(
        uint256 indexed marketId,
        address indexed user,
        address indexed compunder,
        uint256 yieldAmount,
        uint256 feeAmount,
        uint256 netAmount
    );
    event FeeTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EmergencyWithdrawn(uint256 indexed marketId, address indexed user, uint256 amount);

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant MAX_FEE_BPS = 2000; // Maximum compound fee: 20%
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SHARE_MULTIPLIER = 1e12;

    // ── State ──────────────────────────────────────────────────────────────────
    uint256 public marketCount;
    address public feeTreasury;

    // marketId => Market
    mapping(uint256 => Market) public markets;

    // marketId => userAddress => UserPosition
    mapping(uint256 => mapping(address => UserPosition)) public userPositions;

    // Complete history of compounds
    CompoundRecord[] private _compoundHistory;

    // marketId => userAddress => list of indices in _compoundHistory
    mapping(uint256 => mapping(address => uint256[])) private _userCompoundIndices;

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _feeTreasury) Ownable(msg.sender) {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(address(0), _feeTreasury);
    }

    // ── Admin Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Add a new market for compounding
     */
    function addMarket(
        string calldata name,
        uint256 baseYieldRate,
        uint256 feeBps
    ) external onlyOwner returns (uint256 marketId) {
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeBps();

        marketId = ++marketCount;
        markets[marketId] = Market({
            id: marketId,
            name: name,
            baseYieldRate: baseYieldRate,
            accCompoundPerShare: 0,
            lastUpdateTime: block.timestamp,
            totalDeposits: 0,
            feeBps: feeBps,
            isActive: true
        });

        emit MarketAdded(marketId, name, baseYieldRate, feeBps);
    }

    /**
     * @notice Update an existing market
     */
    function updateMarket(
        uint256 marketId,
        uint256 baseYieldRate,
        uint256 feeBps,
        bool isActive
    ) external onlyOwner {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeBps();

        _updateMarket(marketId);

        market.baseYieldRate = baseYieldRate;
        market.feeBps = feeBps;
        market.isActive = isActive;

        emit MarketUpdated(marketId, baseYieldRate, feeBps, isActive);
    }

    /**
     * @notice Set a new fee treasury address
     */
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = feeTreasury;
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(oldTreasury, _feeTreasury);
    }

    // ── Deposit/Withdraw Functions ─────────────────────────────────────────────

    /**
     * @notice Deposit tokens into a market
     */
    function deposit(uint256 marketId, uint256 amount) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        if (!market.isActive) revert MarketNotActive();
        if (amount == 0) revert ZeroAmount();

        _updateMarket(marketId);

        UserPosition storage position = userPositions[marketId][msg.sender];
        position.depositAmount += amount;
        market.totalDeposits += amount;

        emit Deposited(marketId, msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens from a market
     */
    function withdraw(uint256 marketId, uint256 amount) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        UserPosition storage position = userPositions[marketId][msg.sender];
        if (position.depositAmount < amount) revert InsufficientBalance();
        if (amount == 0) revert ZeroAmount();

        _updateMarket(marketId);

        position.depositAmount -= amount;
        market.totalDeposits -= amount;

        emit Withdrawn(marketId, msg.sender, amount);
    }

    /**
     * @notice Emergency withdraw without caring about yield
     */
    function emergencyWithdraw(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        UserPosition storage position = userPositions[marketId][msg.sender];
        uint256 amount = position.depositAmount;
        if (amount == 0) revert ZeroAmount();

        position.depositAmount = 0;
        position.yieldDebt = 0;
        position.accumulatedYield = 0;
        market.totalDeposits = market.totalDeposits > amount ? market.totalDeposits - amount : 0;

        emit EmergencyWithdrawn(marketId, msg.sender, amount);
    }

    // ── Compound Operations ──────────────────────────────────────────────────────

    /**
     * @notice Compound yield for a user in a market
     */
    function compound(uint256 marketId, address user) external nonReentrant returns (uint256 netAmount) {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        if (!market.isActive) revert MarketNotActive();
        if (user == address(0)) revert ZeroAddress();

        _updateMarket(marketId);

        UserPosition storage position = userPositions[marketId][user];
        uint256 pending = (position.depositAmount * market.accCompoundPerShare) / SHARE_MULTIPLIER - position.yieldDebt;
        uint256 totalYield = position.accumulatedYield + pending;

        if (totalYield == 0) revert NoYieldToCompound();

        // Reset user yield
        position.accumulatedYield = 0;
        position.yieldDebt = (position.depositAmount * market.accCompoundPerShare) / SHARE_MULTIPLIER;

        // Calculate fees
        uint256 feeAmount = calculateCompoundFee(totalYield, market.feeBps);
        netAmount = totalYield - feeAmount;

        // Record history
        CompoundRecord memory record = CompoundRecord({
            marketId: marketId,
            user: user,
            compunder: msg.sender,
            yieldAmount: totalYield,
            feeAmount: feeAmount,
            netAmount: netAmount,
            timestamp: block.timestamp
        });

        _compoundHistory.push(record);
        _userCompoundIndices[marketId][user].push(_compoundHistory.length - 1);

        // Increase deposit amount by compounded yield
        position.depositAmount += netAmount;
        market.totalDeposits += netAmount;

        emit Compounded(marketId, user, msg.sender, totalYield, feeAmount, netAmount);
    }

    /**
     * @notice Compound yield across multiple markets for a user
     */
    function compoundMultiple(uint256[] calldata marketIds, address user) external returns (uint256[] memory netAmounts) {
        netAmounts = new uint256[](marketIds.length);
        for (uint256 i = 0; i < marketIds.length; i++) {
            netAmounts[i] = this.compound(marketIds[i], user);
        }
    }

    // ── Fee Calculation ────────────────────────────────────────────────────────────

    /**
     * @notice Calculate compound fee for a given yield amount and fee BPS
     */
    function calculateCompoundFee(uint256 amount, uint256 feeBps) public pure returns (uint256) {
        if (feeBps > FEE_DENOMINATOR) revert InvalidFeeBps();
        return (amount * feeBps) / FEE_DENOMINATOR;
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /**
     * @notice Get pending yield to compound for a user
     */
    function getPendingYield(uint256 marketId, address user) external view returns (uint256) {
        Market memory market = markets[marketId];
        if (market.id == 0) return 0;

        UserPosition memory position = userPositions[marketId][user];
        uint256 accCompoundPerShare = market.accCompoundPerShare;

        if (block.timestamp > market.lastUpdateTime && market.totalDeposits > 0) {
            uint256 elapsed = block.timestamp - market.lastUpdateTime;
            uint256 yield = elapsed * market.baseYieldRate;
            accCompoundPerShare += (yield * SHARE_MULTIPLIER) / market.totalDeposits;
        }

        return position.accumulatedYield + ((position.depositAmount * accCompoundPerShare) / SHARE_MULTIPLIER - position.yieldDebt);
    }

    /**
     * @notice Get compound history records for a specific market and user
     */
    function getCompoundHistory(uint256 marketId, address user) external view returns (CompoundRecord[] memory) {
        uint256[] memory indices = _userCompoundIndices[marketId][user];
        CompoundRecord[] memory records = new CompoundRecord[](indices.length);
        for (uint256 i = 0; i < indices.length; i++) {
            records[i] = _compoundHistory[indices[i]];
        }
        return records;
    }

    /**
     * @notice Get the total count of compound history records
     */
    function getCompoundHistoryCount() external view returns (uint256) {
        return _compoundHistory.length;
    }

    /**
     * @notice Get a specific compound history record by index
     */
    function getCompoundHistoryRecord(uint256 index) external view returns (CompoundRecord memory) {
        return _compoundHistory[index];
    }

    /**
     * @notice Query active markets count
     */
    function getActiveMarketsCount() external view returns (uint256 activeCount) {
        for (uint256 i = 1; i <= marketCount; i++) {
            if (markets[i].isActive) {
                activeCount++;
            }
        }
    }

    // ── Internal Functions ─────────────────────────────────────────────────────

    /**
     * @notice Update market's compound rate
     */
    function _updateMarket(uint256 marketId) internal {
        Market storage market = markets[marketId];
        if (block.timestamp <= market.lastUpdateTime) {
            return;
        }

        if (market.totalDeposits == 0) {
            market.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - market.lastUpdateTime;
        uint256 yield = elapsed * market.baseYieldRate;
        market.accCompoundPerShare += (yield * SHARE_MULTIPLIER) / market.totalDeposits;
        market.lastUpdateTime = block.timestamp;
    }
}