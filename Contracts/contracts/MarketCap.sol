// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@prb/math/src/UD60x18.sol";

/// @title MarketCap
/// @notice Calculates and tracks market capitalization for prediction markets
/// @dev Uses PRBMath for precise decimal calculations
contract MarketCap is Ownable, ReentrancyGuard {
    using {unwrap, add, sub, mul, div, gt, gte, lt, lte} for UD60x18;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroMarketId();
    error ZeroPrice();
    error ZeroSupply();
    error CapLimitExceeded();
    error InvalidCapLimit();
    error MarketNotFound();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct MarketCapData {
        UD60x18 currentCap;           // Current market cap
        UD60x18 previousCap;          // Previous market cap for change tracking
        UD60x18 capLimit;             // Maximum allowed market cap (0 = no limit)
        UD60x18 totalSupply;          // Total token supply
        UD60x18 price;                // Current price per token
        uint256 lastUpdateTime;       // Timestamp of last update
        bool exists;                  // Market existence flag
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

    event CapLimitSet(
        uint256 indexed marketId,
        uint256 capLimit
    );

    event MarketCapUpdated(
        uint256 indexed marketId,
        uint256 newCap,
        uint256 price,
        uint256 supply
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev marketId => MarketCapData
    mapping(uint256 => MarketCapData) private _marketCaps;

    /// @dev List of all market IDs
    uint256[] private _marketIds;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Calculate market capitalization for a market
    /// @param marketId The market identifier
    /// @param price Current price per token (18 decimals)
    /// @param totalSupply Total token supply (18 decimals)
    /// @return cap The calculated market cap
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
        
        // Check cap limit if set
        if (data.capLimit.unwrap() > 0 && calculatedCap.gt(data.capLimit)) {
            revert CapLimitExceeded();
        }

        // Initialize market if it doesn't exist
        if (!data.exists) {
            _marketIds.push(marketId);
            data.exists = true;
        }

        // Store previous cap for change tracking
        data.previousCap = data.currentCap;
        data.currentCap = calculatedCap;
        data.price = priceUD;
        data.totalSupply = supplyUD;
        data.lastUpdateTime = block.timestamp;

        cap = calculatedCap.unwrap();

        // Calculate change
        uint256 change = data.previousCap.unwrap() > 0 
            ? (calculatedCap.gt(data.previousCap) 
                ? calculatedCap.sub(data.previousCap).unwrap()
                : data.previousCap.sub(calculatedCap).unwrap())
            : 0;

        emit MarketCapCalculated(
            marketId,
            cap,
            data.previousCap.unwrap(),
            change,
            block.timestamp
        );
    }

    /// @notice Update market cap with new price and supply
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

        // Check cap limit if set
        if (data.capLimit.unwrap() > 0 && newCap.gt(data.capLimit)) {
            revert CapLimitExceeded();
        }

        data.previousCap = data.currentCap;
        data.currentCap = newCap;
        data.price = priceUD;
        data.totalSupply = supplyUD;
        data.lastUpdateTime = block.timestamp;

        emit MarketCapUpdated(marketId, newCap.unwrap(), price, totalSupply);
    }

    /// @notice Set a cap limit for a market
    /// @param marketId The market identifier
    /// @param capLimit Maximum allowed market cap (0 = no limit)
    function setCapLimit(uint256 marketId, uint256 capLimit) external onlyOwner {
        if (marketId == 0) revert ZeroMarketId();

        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();

        data.capLimit = ud(capLimit);

        emit CapLimitSet(marketId, capLimit);
    }

    /// @notice Get market cap data for a specific market
    /// @param marketId The market identifier
    /// @return currentCap Current market capitalization
    /// @return previousCap Previous market capitalization
    /// @return capLimit Maximum allowed cap (0 = no limit)
    /// @return totalSupply Total token supply
    /// @return price Current price per token
    /// @return lastUpdateTime Last update timestamp
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

    /// @notice Get the change in market cap
    /// @param marketId The market identifier
    /// @return change Absolute change in market cap
    /// @return isIncrease True if cap increased, false if decreased
    function getCapChange(uint256 marketId) 
        external 
        view 
        returns (uint256 change, bool isIncrease) 
    {
        MarketCapData storage data = _marketCaps[marketId];
        if (!data.exists) revert MarketNotFound();

        if (data.previousCap.unwrap() == 0) {
            return (0, true);
        }

        if (data.currentCap.gt(data.previousCap)) {
            change = data.currentCap.sub(data.previousCap).unwrap();
            isIncrease = true;
        } else {
            change = data.previousCap.sub(data.currentCap).unwrap();
            isIncrease = false;
        }
    }

    /// @notice Get all market IDs
    /// @return Array of market IDs
    function getAllMarketIds() external view returns (uint256[] memory) {
        return _marketIds;
    }

    /// @notice Check if a market exists
    /// @param marketId The market identifier
    /// @return True if market exists
    function marketExists(uint256 marketId) external view returns (bool) {
        return _marketCaps[marketId].exists;
    }

    /// @notice Get total number of markets
    /// @return Number of markets
    function getMarketCount() external view returns (uint256) {
        return _marketIds.length;
    }

    /// @notice Calculate market cap without storing (view function)
    /// @param price Price per token (18 decimals)
    /// @param totalSupply Total supply (18 decimals)
    /// @return cap Calculated market cap
    function calculateCap(uint256 price, uint256 totalSupply) 
        external 
        pure 
        returns (uint256 cap) 
    {
        if (price == 0) revert ZeroPrice();
        if (totalSupply == 0) revert ZeroSupply();

        UD60x18 priceUD = ud(price);
        UD60x18 supplyUD = ud(totalSupply);
        cap = priceUD.mul(supplyUD).unwrap();
    }
}
