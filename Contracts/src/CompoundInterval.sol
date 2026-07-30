// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CompoundInterval
 * @notice Implements compound interval timing for yield calculations with scheduling
 *         support for different intervals and query functionality.
 */
contract CompoundInterval is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error InvalidInterval();
    error IntervalNotFound();
    error PositionNotFound();

    // ── Types ──────────────────────────────────────────────────────────────────

    enum IntervalType {
        HOURLY,
        DAILY,
        WEEKLY,
        MONTHLY,
        CUSTOM
    }

    struct CompoundIntervalConfig {
        uint256 id;
        string name;
        uint256 intervalSeconds;
        uint256 minYieldForInterval;
        bool isActive;
    }

    struct IntervalPosition {
        uint256 intervalId;
        address user;
        uint256 lastCompoundTime;
        uint256 nextCompoundTime;
        uint256 totalCompounds;
        bool hasCustomSchedule;
    }

    struct IntervalRecord {
        uint256 intervalId;
        address user;
        uint256 compoundTime;
        uint256 yieldAmount;
        uint256 feeAmount;
        uint256 netAmount;
    }

    struct ScheduleConfig {
        uint256 intervalId;
        uint256 customSeconds;
        uint256 maxYieldThreshold;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event IntervalAdded(
        uint256 indexed intervalId,
        string name,
        uint256 intervalSeconds,
        uint256 minYieldForInterval
    );
    event IntervalUpdated(
        uint256 indexed intervalId,
        uint256 intervalSeconds,
        uint256 minYieldForInterval,
        bool isActive
    );
    event PositionScheduled(
        uint256 indexed intervalId,
        address indexed user,
        uint256 nextCompoundTime
    );
    event CompoundExecuted(
        uint256 indexed intervalId,
        address indexed user,
        uint256 yieldAmount,
        uint256 netAmount
    );
    event CustomScheduleSet(
        uint256 indexed intervalId,
        address indexed user,
        uint256 customSeconds
    );
    event CustomScheduleRemoved(uint256 indexed intervalId, address indexed user);

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant HOURLY_SECONDS = 3600;
    uint256 public constant DAILY_SECONDS = 86400;
    uint256 public constant WEEKLY_SECONDS = 604800;
    uint256 public constant MONTHLY_SECONDS = 2592000; // ~30 days
    uint256 public constant MIN_INTERVAL_SECONDS = 60; // Minimum 1 minute

    // ── State ──────────────────────────────────────────────────────────────────
    uint256 public intervalCount;

    // Interval configurations
    mapping(uint256 => CompoundIntervalConfig) public intervals;

    // User positions: (intervalId, user) => IntervalPosition
    mapping(uint256 => mapping(address => IntervalPosition)) public positions;

    // Custom schedules: (intervalId, user) => ScheduleConfig
    mapping(uint256 => mapping(address => ScheduleConfig)) public customSchedules;

    // History tracking
    IntervalRecord[] private _intervalHistory;
    mapping(uint256 => mapping(address => uint256[])) private _userHistoryIndices;

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ── Interval Management ─────────────────────────────────────────────────────

    /**
     * @notice Add a new compound interval configuration
     */
    function addInterval(
        string calldata name,
        uint256 intervalSeconds,
        uint256 minYieldForInterval
    ) external onlyOwner returns (uint256 intervalId) {
        if (intervalSeconds < MIN_INTERVAL_SECONDS) revert InvalidInterval();

        intervalId = ++intervalCount;
        intervals[intervalId] = CompoundIntervalConfig({
            id: intervalId,
            name: name,
            intervalSeconds: intervalSeconds,
            minYieldForInterval: minYieldForInterval,
            isActive: true
        });

        emit IntervalAdded(intervalId, name, intervalSeconds, minYieldForInterval);
    }

    /**
     * @notice Update an existing interval configuration
     */
    function updateInterval(
        uint256 intervalId,
        uint256 intervalSeconds,
        uint256 minYieldForInterval,
        bool isActive
    ) external onlyOwner {
        CompoundIntervalConfig storage interval = intervals[intervalId];
        if (interval.id == 0) revert IntervalNotFound();
        if (intervalSeconds < MIN_INTERVAL_SECONDS) revert InvalidInterval();

        interval.intervalSeconds = intervalSeconds;
        interval.minYieldForInterval = minYieldForInterval;
        interval.isActive = isActive;

        emit IntervalUpdated(intervalId, intervalSeconds, minYieldForInterval, isActive);
    }

    // ── Position Scheduling ──────────────────────────────────────────────────────

    /**
     * @notice Schedule a position for compounding
     */
    function schedulePosition(uint256 intervalId, address user) external onlyOwner {
        CompoundIntervalConfig storage interval = intervals[intervalId];
        if (interval.id == 0) revert IntervalNotFound();

        IntervalPosition storage pos = positions[intervalId][user];
        pos.intervalId = intervalId;
        pos.user = user;
        pos.lastCompoundTime = block.timestamp;
        pos.nextCompoundTime = block.timestamp + interval.intervalSeconds;
        pos.totalCompounds = 0;

        emit PositionScheduled(intervalId, user, pos.nextCompoundTime);
    }

    /**
     * @notice Set custom schedule for a position
     */
    function setCustomSchedule(
        uint256 intervalId,
        address user,
        uint256 customSeconds,
        uint256 maxYieldThreshold
    ) external onlyOwner {
        if (customSeconds < MIN_INTERVAL_SECONDS) revert InvalidInterval();

        IntervalPosition storage pos = positions[intervalId][user];
        if (pos.intervalId == 0) revert PositionNotFound();

        customSchedules[intervalId][user] = ScheduleConfig({
            intervalId: intervalId,
            customSeconds: customSeconds,
            maxYieldThreshold: maxYieldThreshold
        });
        pos.hasCustomSchedule = true;

        emit CustomScheduleSet(intervalId, user, customSeconds);
    }

    /**
     * @notice Remove custom schedule for a position
     */
    function removeCustomSchedule(uint256 intervalId, address user) external onlyOwner {
        positions[intervalId][user].hasCustomSchedule = false;
        delete customSchedules[intervalId][user];

        emit CustomScheduleRemoved(intervalId, user);
    }

    // ── Compound Execution ───────────────────────────────────────────────────────

    /**
     * @notice Check if a position is eligible for compounding based on interval
     */
    function checkIntervalEligibility(uint256 intervalId, address user) external view returns (bool) {
        CompoundIntervalConfig memory interval = intervals[intervalId];
        if (interval.id == 0 || !interval.isActive) return false;

        IntervalPosition memory pos = positions[intervalId][user];
        return block.timestamp >= pos.nextCompoundTime;
    }

    /**
     * @notice Execute compound for an interval position
     */
    function executeCompound(
        uint256 intervalId,
        address user,
        uint256 yieldAmount,
        uint256 feeAmount
    ) external nonReentrant returns (uint256 netAmount) {
        CompoundIntervalConfig storage interval = intervals[intervalId];
        if (interval.id == 0) revert IntervalNotFound();

        IntervalPosition storage pos = positions[intervalId][user];
        if (pos.intervalId == 0) revert PositionNotFound();

        netAmount = yieldAmount - feeAmount;

        // Update position timing
        pos.lastCompoundTime = block.timestamp;
        uint256 effectiveInterval = pos.hasCustomSchedule
            ? customSchedules[intervalId][user].customSeconds
            : interval.intervalSeconds;
        pos.nextCompoundTime = block.timestamp + effectiveInterval;
        pos.totalCompounds += 1;

        // Record history
        IntervalRecord memory record = IntervalRecord({
            intervalId: intervalId,
            user: user,
            compoundTime: block.timestamp,
            yieldAmount: yieldAmount,
            feeAmount: feeAmount,
            netAmount: netAmount
        });

        _intervalHistory.push(record);
        _userHistoryIndices[intervalId][user].push(_intervalHistory.length - 1);

        emit CompoundExecuted(intervalId, user, yieldAmount, netAmount);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /**
     * @notice Get next compound time for a position
     */
    function getNextCompoundTime(uint256 intervalId, address user) external view returns (uint256) {
        return positions[intervalId][user].nextCompoundTime;
    }

    /**
     * @notice Get time until next compound
     */
    function getTimeUntilNextCompound(uint256 intervalId, address user) external view returns (uint256) {
        uint256 nextTime = positions[intervalId][user].nextCompoundTime;
        return nextTime > block.timestamp ? nextTime - block.timestamp : 0;
    }

    /**
     * @notice Get interval history for a user
     */
    function getIntervalHistory(uint256 intervalId, address user) external view returns (IntervalRecord[] memory) {
        uint256[] memory indices = _userHistoryIndices[intervalId][user];
        IntervalRecord[] memory records = new IntervalRecord[](indices.length);
        for (uint256 i = 0; i < indices.length; i++) {
            records[i] = _intervalHistory[indices[i]];
        }
        return records;
    }

    /**
     * @notice Get total interval history count
     */
    function getIntervalHistoryCount() external view returns (uint256) {
        return _intervalHistory.length;
    }

    /**
     * @notice Get a specific interval history record
     */
    function getIntervalRecord(uint256 index) external view returns (IntervalRecord memory) {
        return _intervalHistory[index];
    }

    /**
     * @notice Get positions due for compounding before a timestamp
     */
    function getPositionsDueBefore(uint256 timestamp) external view returns (uint256[] memory positionIds) {
        // Note: This would typically require iteration over all positions
        // Simplified for gas efficiency - caller would check eligibility individually
        positionIds = new uint256[](0);
    }

    /**
     * @notice Get all active interval configurations
     */
    function getActiveIntervals() external view returns (CompoundIntervalConfig[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= intervalCount; i++) {
            if (intervals[i].isActive) {
                activeCount++;
            }
        }

        CompoundIntervalConfig[] memory result = new CompoundIntervalConfig[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= intervalCount; i++) {
            if (intervals[i].isActive) {
                result[index] = intervals[i];
                index++;
            }
        }
        return result;
    }

    /**
     * @notice Query if a custom schedule exists for a position
     */
    function hasCustomSchedule(uint256 intervalId, address user) external view returns (bool) {
        return positions[intervalId][user].hasCustomSchedule;
    }

    /**
     * @notice Get custom schedule configuration
     */
    function getCustomSchedule(uint256 intervalId, address user) external view returns (
        uint256 customSeconds,
        uint256 maxYieldThreshold
    ) {
        ScheduleConfig memory config = customSchedules[intervalId][user];
        return (config.customSeconds, config.maxYieldThreshold);
    }
}