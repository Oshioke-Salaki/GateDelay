// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MarketCompound} from "./MarketCompound.sol";

/**
 * @title AutoCompounder
 * @notice Implements automatic compounding system that monitors triggers and executes
 *         compounds automatically, tracking performance and handling fees.
 */
contract AutoCompounder is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error MarketNotRegistered();
    error NoEligiblePositions();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct AutoCompoundPosition {
        uint256 marketId;
        address user;
        uint256 minYieldThreshold;
        uint256 lastCompound;
        bool isActive;
    }

    struct AutoCompoundRecord {
        uint256 positionId;
        uint256 yieldAmount;
        uint256 feeAmount;
        uint256 netAmount;
        uint256 timestamp;
    }

    struct PerformanceMetrics {
        uint256 totalCompounds;
        uint256 totalYieldCompounded;
        uint256 totalFeesCollected;
    }

    struct CompoundTrigger {
        uint256 positionId;
        uint256 yieldThreshold;
        bool triggerMet;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event PositionRegistered(
        uint256 indexed positionId,
        uint256 indexed marketId,
        address indexed user,
        uint256 minYieldThreshold
    );
    event PositionUnregistered(uint256 indexed positionId);
    event AutoCompounded(
        uint256 indexed positionId,
        uint256 yieldAmount,
        uint256 feeAmount,
        uint256 netAmount
    );
    event PerformanceUpdated(uint256 totalCompounds, uint256 totalYield, uint256 totalFees);
    event TriggerUpdated(uint256 indexed positionId, uint256 yieldThreshold);

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant MIN_YIELD_THRESHOLD = 1e18; // Minimum yield to trigger compound

    // ── State ──────────────────────────────────────────────────────────────────
    uint256 public positionCount;
    address public marketCompoundAddress;

    // Position data
    mapping(uint256 => AutoCompoundPosition) public positions;
    mapping(uint256 => AutoCompoundRecord[]) private _autoCompoundHistory;

    // User positions: user => positionId[]
    mapping(address => uint256[]) private _userPositionIds;

    // Performance tracking
    PerformanceMetrics public performance;

    // Reference to MarketCompound contract
    MarketCompound public marketCompound;

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _marketCompound) Ownable(msg.sender) {
        if (_marketCompound == address(0)) revert ZeroAddress();
        marketCompoundAddress = _marketCompound;
        marketCompound = MarketCompound(_marketCompound);
    }

    // ── Admin Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Register a position for automatic compounding
     */
    function registerPosition(
        uint256 marketId,
        address user,
        uint256 minYieldThreshold
    ) external onlyOwner returns (uint256 positionId) {
        positionId = ++positionCount;

        positions[positionId] = AutoCompoundPosition({
            marketId: marketId,
            user: user,
            minYieldThreshold: minYieldThreshold,
            lastCompound: block.timestamp,
            isActive: true
        });

        _userPositionIds[user].push(positionId);

        emit PositionRegistered(positionId, marketId, user, minYieldThreshold);
    }

    /**
     * @notice Unregister a position from automatic compounding
     */
    function unregisterPosition(uint256 positionId) external onlyOwner {
        AutoCompoundPosition storage pos = positions[positionId];
        if (pos.positionId == 0) revert MarketNotRegistered();

        pos.isActive = false;
        emit PositionUnregistered(positionId);
    }

    /**
     * @notice Update yield threshold for a position
     */
    function updateYieldThreshold(uint256 positionId, uint256 minYieldThreshold) external onlyOwner {
        AutoCompoundPosition storage pos = positions[positionId];
        if (pos.positionId == 0) revert MarketNotRegistered();

        pos.minYieldThreshold = minYieldThreshold;
        emit TriggerUpdated(positionId, minYieldThreshold);
    }

    // ── Keeper Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Check if a position is eligible for compounding
     * Used by Chainlink Keepers to determine if compound should be executed
     */
    function checkCompoundEligibility(uint256 positionId) external view returns (bool) {
        AutoCompoundPosition memory pos = positions[positionId];
        if (!pos.isActive || pos.positionId == 0) return false;

        uint256 pendingYield = marketCompound.getPendingYield(pos.marketId, pos.user);
        return pendingYield >= pos.minYieldThreshold;
    }

    /**
     * @notice Perform automatic compounding for a single position
     * Can be called by anyone (including bots/keepers)
     */
    function performCompound(uint256 positionId) external nonReentrant returns (uint256 netAmount) {
        AutoCompoundPosition storage pos = positions[positionId];
        if (!pos.isActive || pos.positionId == 0) revert MarketNotRegistered();

        uint256 pendingYield = marketCompound.getPendingYield(pos.marketId, pos.user);
        if (pendingYield < pos.minYieldThreshold) revert NoEligiblePositions();

        // Execute compound via MarketCompound
        netAmount = marketCompound.compound(pos.marketId, pos.user);

        // Record auto-compound
        AutoCompoundRecord memory record = AutoCompoundRecord({
            positionId: positionId,
            yieldAmount: pendingYield,
            feeAmount: pendingYield - netAmount,
            netAmount: netAmount,
            timestamp: block.timestamp
        });

        _autoCompoundHistory[positionId].push(record);
        pos.lastCompound = block.timestamp;

        // Update performance metrics
        performance.totalCompounds += 1;
        performance.totalYieldCompounded += pendingYield;
        performance.totalFeesCollected += (pendingYield - netAmount);

        emit AutoCompounded(positionId, pendingYield, pendingYield - netAmount, netAmount);
        emit PerformanceUpdated(performance.totalCompounds, performance.totalYieldCompounded, performance.totalFeesCollected);
    }

    /**
     * @notice Perform automatic compounding for all eligible positions
     * This is the main keeper function that can be called periodically
     */
    function performAllEligibleCompounds() external nonReentrant returns (uint256 compoundsExecuted) {
        for (uint256 i = 1; i <= positionCount; i++) {
            AutoCompoundPosition memory pos = positions[i];
            if (!pos.isActive) continue;

            try this.performCompound(i) {
                compoundsExecuted++;
            } catch {
                // Continue to next position if this one fails
            }
        }
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /**
     * @notice Get all position IDs for a user
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositionIds[user];
    }

    /**
     * @notice Get auto-compound history for a position
     */
    function getAutoCompoundHistory(uint256 positionId) external view returns (AutoCompoundRecord[] memory) {
        return _autoCompoundHistory[positionId];
    }

    /**
     * @notice Get count of auto-compound records for a position
     */
    function getAutoCompoundHistoryCount(uint256 positionId) external view returns (uint256) {
        return _autoCompoundHistory[positionId].length;
    }

    /**
     * @notice Get a specific auto-compound record
     */
    function getAutoCompoundRecord(uint256 positionId, uint256 index) external view returns (AutoCompoundRecord memory) {
        return _autoCompoundHistory[positionId][index];
    }

    /**
     * @notice Get performance metrics
     */
    function getPerformanceMetrics() external view returns (
        uint256 totalCompounds,
        uint256 totalYieldCompounded,
        uint256 totalFeesCollected
    ) {
        return (performance.totalCompounds, performance.totalYieldCompounded, performance.totalFeesCollected);
    }

    /**
     * @notice Check triggers for all positions (for keeper monitoring)
     */
    function checkAllTriggers() external view returns (CompoundTrigger[] memory triggers) {
        triggers = new CompoundTrigger[](positionCount);
        for (uint256 i = 1; i <= positionCount; i++) {
            AutoCompoundPosition memory pos = positions[i];
            uint256 pendingYield = pos.isActive ? marketCompound.getPendingYield(pos.marketId, pos.user) : 0;

            triggers[i - 1] = CompoundTrigger({
                positionId: i,
                yieldThreshold: pos.minYieldThreshold,
                triggerMet: pendingYield >= pos.minYieldThreshold
            });
        }
    }

    /**
     * @notice Get count of eligible positions for compounding
     */
    function getEligiblePositionsCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= positionCount; i++) {
            if (checkCompoundEligibility(i)) {
                count++;
            }
        }
    }
}