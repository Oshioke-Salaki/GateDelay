// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@prb/math/src/UD60x18.sol";

/**
 * @title MarketCap
 * @notice Advanced market capitalization tracker for prediction markets
 * @dev Uses PRBMath UD60x18 for high-precision calculations
 */
contract MarketCap is Ownable, ReentrancyGuard {
    using {unwrap, add, sub, mul, div, gt, gte, lt, lte} for UD60x18;

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------
    error ZeroMarketId();
    error ZeroPrice();
    error ZeroSupply();
    error CapLimitExceeded();
    error MarketNotFound();
    error InvalidBatchSize();
    error InvalidThreshold();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct MarketCapData {
        UD60x18 currentCap;
        UD60x18 previousCap;
        UD60x18 capLimit;
        UD60x18 totalSupply;
        UD60x18 price;
        uint256 lastUpdateTime;
        uint256 updateCount;
        UD60x18 peakCap;
        UD60x18 lowestCap;
        bool exists;
    }

    struct CapSnapshot {
        uint256 timestamp;
        uint256 cap;
        uint256 price;
        uint256 supply;
    }

    struct BatchCapResult {
        uint256 marketId;
        uint256 cap;
        bool success;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketCapCalculated(
        uint256 indexed marketId,
        uint256 currentCap,
        uint256 previousCap,
        uint256 change,
        uint256 timestamp
    );

    event MarketCapUpdated(
        uint256 indexed marketId,
        uint256 newCap,
        uint256 price,
        uint256 supply
    );

    event CapLimitSet(uint256 indexed marketId, uint256 capLimit);
    event CapThresholdReached(uint256 indexed marketId, uint256 cap, uint256 threshold, bool isAbove);
    event PeakCapReached(uint256 indexed marketId, uint256 newPeak);
    event BatchCapCalculated(uint256 successCount, uint256 failureCount);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(uint256 => MarketCapData) private _marketCaps;
    uint256[] private _marketIds;
    mapping(uint256 => mapping(uint256 => bool)) private _thresholds;
    mapping(uint256 => CapSnapshot[]) private _snapshots;

    uint256 public constant MAX_SNAPSHOTS = 100;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Calculate and store market cap for a market
    function calculateMarketCap(
        uint256 marketId,
        uint256 price,
        uint256 totalSupply
    ) external nonReentrant returns (uint256 cap) {
        if (marketId == 0) revert ZeroMarketId();
        if (price == 0) revert ZeroPrice();
        if (totalSupply == 0) revert ZeroSupply();

        UD60x18 priceUD = ud(price);
        UD60x18 supplyUD = ud(totalSupply);
        UD60x18 calculatedCap = priceUD.mul(supplyUD);

        MarketCapData storage data = _marketCaps[marketId];

        if (data.capLimit.gt(ud(0)) && calculatedCap.gt(data.capLimit)) {
            revert CapLimitExceeded();
        }

        if (!data.exists) {
            _marketIds.push(marketId);
            data.exists = true;
            data.peakCap = calculatedCap;
            data.lowestCap = calculatedCap;
        }

        data.previousCap = data.currentCap;
        data.currentCap = calculatedCap;
        data.price = priceUD;
        data.totalSupply = supplyUD;
        data.lastUpdateTime = block.timestamp;
        data.updateCount++;

        _updateExtremes(data, calculatedCap);
        _checkThresholds(marketId, calculatedCap);
        _storeSnapshot(marketId, calculatedCap.unwrap(), price, totalSupply);

        cap = calculatedCap.unwrap();

        uint256 change = data.previousCap.unwrap() > 0 
            ? (calculatedCap.gt(data.previousCap) 
                ? calculatedCap.sub(data.previousCap).unwrap() 
                : data.previousCap.sub(calculatedCap).unwrap())
            : 0;

        emit MarketCapCalculated(marketId, cap, data.previousCap.unwrap(), change, block.timestamp);
    }

    /// @notice Update existing market cap
    function updateMarketCap(
        uint256 marketId,
        uint256 price,
        uint256 totalSupply
    ) external nonReentrant {
        if (marketId == 0) revert ZeroMarketId();
        if (price == 0) revert ZeroPrice();
        if (totalSupply == 0) revert ZeroSupply();

        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();

        UD60x18 priceUD = ud(price);
        UD60x18 supplyUD = ud(totalSupply);
        UD60x18 newCap = priceUD.mul(supplyUD);

        if (data.capLimit.gt(ud(0)) && newCap.gt(data.capLimit)) {
            revert CapLimitExceeded();
        }

        data.previousCap = data.currentCap;
        data.currentCap = newCap;
        data.price = priceUD;
        data.totalSupply = supplyUD;
        data.lastUpdateTime = block.timestamp;
        data.updateCount++;

        _updateExtremes(data, newCap);
        _checkThresholds(marketId, newCap);
        _storeSnapshot(marketId, newCap.unwrap(), price, totalSupply);

        emit MarketCapUpdated(marketId, newCap.unwrap(), price, totalSupply);
    }

    // -------------------------------------------------------------------------
    // Admin & Configuration
    // -------------------------------------------------------------------------

    function setCapLimit(uint256 marketId, uint256 capLimit) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();
        if (!_marketCaps[marketId].exists) revert MarketNotFound();

        _marketCaps[marketId].capLimit = ud(capLimit);
        emit CapLimitSet(marketId, capLimit);
    }

    function setCapThreshold(uint256 marketId, uint256 threshold) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();
        if (threshold == 0) revert InvalidThreshold();
        if (!_marketCaps[marketId].exists) revert MarketNotFound();

        _thresholds[marketId][threshold] = true;
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function getMarketCap(uint256 marketId) external view returns (
        uint256 currentCap,
        uint256 previousCap,
        uint256 capLimit,
        uint256 totalSupply,
        uint256 price,
        uint256 lastUpdateTime
    ) {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();

        return (
            data.currentCap.unwrap(),
            data.previousCap.unwrap(),
            data.capLimit.unwrap(),
            data.totalSupply.unwrap(),
            data.price.unwrap(),
            data.lastUpdateTime
        );
    }

    function getCapChange(uint256 marketId) external view returns (uint256 change, bool isIncrease) {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();

        if (data.previousCap.unwrap() == 0) return (0, true);

        if (data.currentCap.gt(data.previousCap)) {
            change = data.currentCap.sub(data.previousCap).unwrap();
            isIncrease = true;
        } else {
            change = data.previousCap.sub(data.currentCap).unwrap();
            isIncrease = false;
        }
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        return _marketIds;
    }

    function marketExists(uint256 marketId) external view returns (bool) {
        return _marketCaps[marketId].exists;
    }

    function getTotalMarketCap() external view returns (uint256) {
        UD60x18 total = ud(0);
        for (uint256 i = 0; i < _marketIds.length; i++) {
            total = total.add(_marketCaps[_marketIds[i]].currentCap);
        }
        return total.unwrap();
    }

    // ... (I can add more view functions if needed)

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _updateExtremes(MarketCapData storage data, UD60x18 newCap) internal {
        if (newCap.gt(data.peakCap)) {
            data.peakCap = newCap;
            emit PeakCapReached(data.updateCount, newCap.unwrap());
        }
        if (data.lowestCap.unwrap() == 0 || newCap.lt(data.lowestCap)) {
            data.lowestCap = newCap;
        }
    }

    function _checkThresholds(uint256 marketId, UD60x18 cap) internal {
        uint256 capValue = cap.unwrap();
        uint256[5] memory common = [1000e18, 10000e18, 100000e18, 1_000_000e18, 10_000_000e18];

        for (uint256 i = 0; i < common.length; i++) {
            if (_thresholds[marketId][common[i]]) {
                bool isAbove = capValue >= common[i];
                emit CapThresholdReached(marketId, capValue, common[i], isAbove);
            }
        }
    }

    function _storeSnapshot(uint256 marketId, uint256 cap, uint256 price, uint256 supply) internal {
        CapSnapshot[] storage snaps = _snapshots[marketId];

        if (snaps.length >= MAX_SNAPSHOTS) {
            for (uint256 i = 0; i < snaps.length - 1; i++) {
                snaps[i] = snaps[i + 1];
            }
            snaps.pop();
        }

        snaps.push(CapSnapshot(block.timestamp, cap, price, supply));
    }
}