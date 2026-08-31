// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@prb/math/src/UD60x18.sol";

/**
 * @title MarketCap
 * @notice Advanced market capitalization tracker for prediction markets
 * @dev Uses PRBMath UD60x18 for high-precision 18-decimal calculations. Deployed via
 *      `forge create MarketCap --rpc-url $RPC_URL --private-key $PRIVATE_KEY`.
 *      Constructor sets `owner = msg.sender`; owner may call `setCapLimit` / `setCapThreshold`.
 *      No constructor args; no proxy. Solc 0.8.28, optimizer 200, viaIR true.
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
    /// @notice Deploys MarketCap; caller becomes owner.
    /// @dev No arguments. Ownable sets owner to msg.sender. Ensure deployer is safe.
    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Calculate and store market cap for a market
    /// @param marketId The market identifier (must be > 0)
    /// @param price Current price per token (18 decimals)
    /// @param totalSupply Total token supply (18 decimals)
    /// @return cap The calculated market cap (18 decimals)
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

        _updateExtremes(marketId, data, calculatedCap);
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

    /// @notice Update existing market cap with new price and supply
    /// @param marketId The market identifier
    /// @param price New price per token (18 decimals)
    /// @param totalSupply New total supply (18 decimals)
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

        _updateExtremes(marketId, data, newCap);
        _checkThresholds(marketId, newCap);
        _storeSnapshot(marketId, newCap.unwrap(), price, totalSupply);

        emit MarketCapUpdated(marketId, newCap.unwrap(), price, totalSupply);
    }

    /// @notice Pure calculation without storage (view)
    /// @param price Price per token (18 decimals)
    /// @param totalSupply Total supply (18 decimals)
    /// @return cap Calculated market cap (price * supply / 1e18)
    function calculateCap(uint256 price, uint256 totalSupply) external pure returns (uint256 cap) {
        if (price == 0) revert ZeroPrice();
        if (totalSupply == 0) revert ZeroSupply();
        UD60x18 priceUD = ud(price);
        UD60x18 supplyUD = ud(totalSupply);
        cap = priceUD.mul(supplyUD).unwrap();
    }

    // -------------------------------------------------------------------------
    // Admin & Configuration
    // -------------------------------------------------------------------------

    /// @notice Set cap limit (owner only, 0 = no limit)
    function setCapLimit(uint256 marketId, uint256 capLimit) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();
        if (!_marketCaps[marketId].exists) revert MarketNotFound();

        _marketCaps[marketId].capLimit = ud(capLimit);
        emit CapLimitSet(marketId, capLimit);
    }

    /// @notice Set a threshold alert for a market (owner only)
    function setCapThreshold(uint256 marketId, uint256 threshold) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();
        if (threshold == 0) revert InvalidThreshold();
        if (!_marketCaps[marketId].exists) revert MarketNotFound();

        _thresholds[marketId][threshold] = true;
    }

    /// @notice Remove a threshold alert (owner only)
    function removeCapThreshold(uint256 marketId, uint256 threshold) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();
        _thresholds[marketId][threshold] = false;
    }

    /// @notice Batch calculate market caps for multiple markets (max 50)
    function batchCalculateMarketCap(
        uint256[] calldata marketIds,
        uint256[] calldata prices,
        uint256[] calldata supplies
    ) external nonReentrant returns (BatchCapResult[] memory results) {
        if (marketIds.length != prices.length || marketIds.length != supplies.length) revert InvalidBatchSize();
        if (marketIds.length == 0 || marketIds.length > 50) revert InvalidBatchSize();

        results = new BatchCapResult[](marketIds.length);
        uint256 successCount = 0;
        uint256 failureCount = 0;

        for (uint256 i = 0; i < marketIds.length; i++) {
            try this.calculateMarketCap(marketIds[i], prices[i], supplies[i]) returns (uint256 cap) {
                results[i] = BatchCapResult({marketId: marketIds[i], cap: cap, success: true});
                successCount++;
            } catch {
                results[i] = BatchCapResult({marketId: marketIds[i], cap: 0, success: false});
                failureCount++;
            }
        }

        emit BatchCapCalculated(successCount, failureCount);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function getMarketCap(uint256 marketId)
        external
        view
        returns (
            uint256 currentCap,
            uint256 previousCap,
            uint256 capLimit,
            uint256 totalSupply,
            uint256 price,
            uint256 lastUpdateTime
        )
    {
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

    /// @notice Percentage change (18 decimals, 5e18 = 5%)
    function getCapChangePercentage(uint256 marketId)
        external
        view
        returns (uint256 percentageChange, bool isIncrease)
    {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();
        if (data.previousCap.unwrap() == 0) return (0, true);

        UD60x18 hundred = ud(100e18);
        if (data.currentCap.gt(data.previousCap)) {
            UD60x18 change = data.currentCap.sub(data.previousCap);
            percentageChange = change.mul(hundred).div(data.previousCap).unwrap();
            isIncrease = true;
        } else {
            UD60x18 change = data.previousCap.sub(data.currentCap);
            percentageChange = change.mul(hundred).div(data.previousCap).unwrap();
            isIncrease = false;
        }
    }

    /// @notice Get peak and lowest caps
    function getCapExtremes(uint256 marketId) external view returns (uint256 peakCap, uint256 lowestCap) {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();
        peakCap = data.peakCap.unwrap();
        lowestCap = data.lowestCap.unwrap();
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        return _marketIds;
    }

    function marketExists(uint256 marketId) external view returns (bool) {
        return _marketCaps[marketId].exists;
    }

    function getMarketCount() external view returns (uint256) {
        return _marketIds.length;
    }

    function getUpdateCount(uint256 marketId) external view returns (uint256 count) {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();
        count = data.updateCount;
    }

    function getTotalMarketCap() external view returns (uint256) {
        UD60x18 total = ud(0);
        for (uint256 i = 0; i < _marketIds.length; i++) {
            total = total.add(_marketCaps[_marketIds[i]].currentCap);
        }
        return total.unwrap();
    }

    function getSnapshots(uint256 marketId) external view returns (CapSnapshot[] memory snapshots) {
        return _snapshots[marketId];
    }

    function getLatestSnapshot(uint256 marketId) external view returns (CapSnapshot memory snapshot) {
        CapSnapshot[] storage snaps = _snapshots[marketId];
        if (snaps.length == 0) return CapSnapshot(0, 0, 0, 0);
        return snaps[snaps.length - 1];
    }

    function compareMarketCaps(uint256 marketId1, uint256 marketId2)
        external
        view
        returns (uint256 difference, bool market1IsLarger)
    {
        MarketCapData storage data1 = _marketCaps[marketId1];
        MarketCapData storage data2 = _marketCaps[marketId2];
        if (!data1.exists) revert MarketNotFound();
        if (!data2.exists) revert MarketNotFound();

        if (data1.currentCap.gt(data2.currentCap)) {
            difference = data1.currentCap.sub(data2.currentCap).unwrap();
            market1IsLarger = true;
        } else {
            difference = data2.currentCap.sub(data1.currentCap).unwrap();
            market1IsLarger = false;
        }
    }

    function getTopMarketsByCap(uint256 limit)
        external
        view
        returns (uint256[] memory marketIds, uint256[] memory caps)
    {
        uint256 length = _marketIds.length;
        if (limit > length) limit = length;
        if (limit == 0) return (new uint256[](0), new uint256[](0));

        uint256[] memory allIds = new uint256[](length);
        uint256[] memory allCaps = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            allIds[i] = _marketIds[i];
            allCaps[i] = _marketCaps[_marketIds[i]].currentCap.unwrap();
        }

        // Bubble sort descending by cap
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (allCaps[j] < allCaps[j + 1]) {
                    (allCaps[j], allCaps[j + 1]) = (allCaps[j + 1], allCaps[j]);
                    (allIds[j], allIds[j + 1]) = (allIds[j + 1], allIds[j]);
                }
            }
        }

        marketIds = new uint256[](limit);
        caps = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            marketIds[i] = allIds[i];
            caps[i] = allCaps[i];
        }
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _updateExtremes(uint256 marketId, MarketCapData storage data, UD60x18 newCap) internal {
        if (newCap.gt(data.peakCap)) {
            data.peakCap = newCap;
            emit PeakCapReached(marketId, newCap.unwrap());
        }
        if (data.lowestCap.unwrap() == 0 || newCap.lt(data.lowestCap)) {
            data.lowestCap = newCap;
        }
    }

    function _checkThresholds(uint256 marketId, UD60x18 cap) internal {
        uint256 capValue = cap.unwrap();
        uint256[5] memory common = [
            uint256(1000e18),
            uint256(10000e18),
            uint256(100000e18),
            uint256(1_000_000e18),
            uint256(10_000_000e18)
        ];

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
