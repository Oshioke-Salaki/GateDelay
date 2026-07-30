// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UD60x18, convert} from "@prb/math/src/UD60x18.sol";

interface IThresholdActionExecutor {
    function executeThresholdAction(
        bytes32 thresholdId,
        uint256 currentValue,
        uint256 minValue,
        uint256 maxValue,
        uint256 deviationBps,
        bytes calldata actionData
    ) external;
}

contract RebalanceThreshold {
    uint256 public constant BPS = 10_000;

    struct Threshold {
        uint256 minValue;
        uint256 maxValue;
        bool enabled;
        bool autoTrigger;
        bytes actionData;
    }

    struct ThresholdStatus {
        bool breached;
        uint256 currentValue;
        uint256 deviationBps;
        uint256 checkedAt;
    }

    struct ThresholdHistory {
        uint256 id;
        bytes32 thresholdId;
        uint256 currentValue;
        uint256 minValue;
        uint256 maxValue;
        uint256 deviationBps;
        uint256 timestamp;
        bool actionTriggered;
    }

    mapping(bytes32 => Threshold) private _thresholds;
    mapping(bytes32 => ThresholdStatus) private _statuses;
    mapping(uint256 => ThresholdHistory) private _history;
    mapping(bytes32 => uint256[]) private _historyByThreshold;

    bytes32[] private _thresholdIds;
    mapping(bytes32 => bool) private _knownThreshold;

    address public actionExecutor;
    address public owner;
    uint256 public historyCount;
    uint256 public actionCount;
    uint256 private _reentrancyLock;

    event ThresholdSet(
        bytes32 indexed thresholdId,
        uint256 minValue,
        uint256 maxValue,
        bool enabled,
        bool autoTrigger,
        bytes actionData
    );
    event ThresholdChecked(bytes32 indexed thresholdId, uint256 currentValue, bool breached, uint256 deviationBps);
    event ThresholdActionTriggered(
        bytes32 indexed thresholdId, address indexed executor, uint256 currentValue, uint256 deviationBps
    );
    event ActionExecutorSet(address indexed executor);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error InvalidThreshold();
    error ThresholdNotFound(bytes32 thresholdId);
    error ThresholdDisabled(bytes32 thresholdId);
    error NotOwner();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyLock == 1) revert ReentrantCall();
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
    }

    constructor(address actionExecutor_) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _setActionExecutor(actionExecutor_);
    }

    function setActionExecutor(address actionExecutor_) external onlyOwner {
        _setActionExecutor(actionExecutor_);
    }

    function setThreshold(
        bytes32 thresholdId,
        uint256 minValue,
        uint256 maxValue,
        bool enabled,
        bool autoTrigger,
        bytes calldata actionData
    ) external onlyOwner {
        if (thresholdId == bytes32(0) || minValue >= maxValue) revert InvalidThreshold();

        if (!_knownThreshold[thresholdId]) {
            _knownThreshold[thresholdId] = true;
            _thresholdIds.push(thresholdId);
        }

        _thresholds[thresholdId] = Threshold({
            minValue: minValue, maxValue: maxValue, enabled: enabled, autoTrigger: autoTrigger, actionData: actionData
        });

        emit ThresholdSet(thresholdId, minValue, maxValue, enabled, autoTrigger, actionData);
    }

    function checkThreshold(bytes32 thresholdId, uint256 currentValue)
        external
        nonReentrant
        returns (bool breached, uint256 deviationBps)
    {
        Threshold storage threshold = _thresholds[thresholdId];
        if (!_knownThreshold[thresholdId]) revert ThresholdNotFound(thresholdId);
        if (!threshold.enabled) revert ThresholdDisabled(thresholdId);

        deviationBps = calculateDeviationBps(currentValue, threshold.minValue, threshold.maxValue);
        breached = deviationBps > 0;

        _statuses[thresholdId] = ThresholdStatus({
            breached: breached, currentValue: currentValue, deviationBps: deviationBps, checkedAt: block.timestamp
        });

        bool actionTriggered;
        if (breached && threshold.autoTrigger) {
            IThresholdActionExecutor(actionExecutor)
                .executeThresholdAction(
                    thresholdId,
                    currentValue,
                    threshold.minValue,
                    threshold.maxValue,
                    deviationBps,
                    threshold.actionData
                );
            actionCount += 1;
            actionTriggered = true;
            emit ThresholdActionTriggered(thresholdId, actionExecutor, currentValue, deviationBps);
        }

        _recordHistory(thresholdId, currentValue, threshold, deviationBps, actionTriggered);
        emit ThresholdChecked(thresholdId, currentValue, breached, deviationBps);
    }

    function calculateDeviationBps(uint256 currentValue, uint256 minValue, uint256 maxValue)
        public
        pure
        returns (uint256)
    {
        if (minValue >= maxValue) revert InvalidThreshold();
        if (currentValue >= minValue && currentValue <= maxValue) return 0;

        if (currentValue < minValue) {
            return _ratioBps(minValue - currentValue, minValue);
        }

        return _ratioBps(currentValue - maxValue, maxValue);
    }

    function getThreshold(bytes32 thresholdId) external view returns (Threshold memory) {
        if (!_knownThreshold[thresholdId]) revert ThresholdNotFound(thresholdId);
        return _thresholds[thresholdId];
    }

    function getThresholdStatus(bytes32 thresholdId) external view returns (ThresholdStatus memory) {
        if (!_knownThreshold[thresholdId]) revert ThresholdNotFound(thresholdId);
        return _statuses[thresholdId];
    }

    function getThresholdIds() external view returns (bytes32[] memory) {
        return _thresholdIds;
    }

    function getHistory(uint256 historyId) external view returns (ThresholdHistory memory) {
        return _history[historyId];
    }

    function getThresholdHistoryIds(bytes32 thresholdId) external view returns (uint256[] memory) {
        if (!_knownThreshold[thresholdId]) revert ThresholdNotFound(thresholdId);
        return _historyByThreshold[thresholdId];
    }

    function _setActionExecutor(address actionExecutor_) internal {
        if (actionExecutor_ == address(0)) revert ZeroAddress();
        actionExecutor = actionExecutor_;
        emit ActionExecutorSet(actionExecutor_);
    }

    function _recordHistory(
        bytes32 thresholdId,
        uint256 currentValue,
        Threshold storage threshold,
        uint256 deviationBps,
        bool actionTriggered
    ) internal {
        historyCount += 1;
        _history[historyCount] = ThresholdHistory({
            id: historyCount,
            thresholdId: thresholdId,
            currentValue: currentValue,
            minValue: threshold.minValue,
            maxValue: threshold.maxValue,
            deviationBps: deviationBps,
            timestamp: block.timestamp,
            actionTriggered: actionTriggered
        });
        _historyByThreshold[thresholdId].push(historyCount);
    }

    function _ratioBps(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        if (denominator == 0) revert InvalidThreshold();
        UD60x18 ratio = convert(numerator).div(convert(denominator));
        return convert(ratio.mul(convert(BPS)));
    }
}
