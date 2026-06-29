# MarketCap API Reference

## Contract Address
```
Mainnet: TBD
Testnet: TBD
```

## Table of Contents
- [Core Functions](#core-functions)
- [Query Functions](#query-functions)
- [Advanced Features](#advanced-features)
- [Admin Functions](#admin-functions)
- [Events](#events)
- [Errors](#errors)
- [Data Structures](#data-structures)

## Core Functions

### calculateMarketCap

Calculate and store market capitalization for a market.

```solidity
function calculateMarketCap(
    uint256 marketId,
    uint256 price,
    uint256 totalSupply
) external nonReentrant returns (uint256 cap)
```

**Parameters:**
- `marketId` (uint256): The market identifier (must be > 0)
- `price` (uint256): Current price per token in 18 decimals (e.g., 2e18 = 2.0)
- `totalSupply` (uint256): Total token supply in 18 decimals (e.g., 1000e18 = 1000 tokens)

**Returns:**
- `cap` (uint256): The calculated market cap in 18 decimals

**Emits:**
- `MarketCapCalculated(marketId, currentCap, previousCap, change, timestamp)`
- `PeakCapReached(marketId, newPeak)` (if new peak)
- `CapThresholdReached(marketId, cap, threshold, isAbove)` (if threshold set)

**Reverts:**
- `ZeroMarketId()`: If marketId is 0
- `ZeroPrice()`: If price is 0
- `ZeroSupply()`: If totalSupply is 0
- `CapLimitExceeded()`: If calculated cap exceeds set limit

**Example:**
```solidity
uint256 cap = marketCap.calculateMarketCap(
    1,          // marketId
    2e18,       // price = 2.0
    1000e18     // supply = 1000
);
// Returns: 2000e18 (2000.0)
```

---

### updateMarketCap

Update market cap for an existing market.

```solidity
function updateMarketCap(
    uint256 marketId,
    uint256 price,
    uint256 totalSupply
) external nonReentrant
```

**Parameters:**
- `marketId` (uint256): The market identifier
- `price` (uint256): New price per token (18 decimals)
- `totalSupply` (uint256): New total supply (18 decimals)

**Emits:**
- `MarketCapUpdated(marketId, newCap, price, supply)`

**Reverts:**
- `ZeroMarketId()`: If marketId is 0
- `ZeroPrice()`: If price is 0
- `ZeroSupply()`: If totalSupply is 0
- `MarketNotFound()`: If market doesn't exist
- `CapLimitExceeded()`: If new cap exceeds limit

**Example:**
```solidity
marketCap.updateMarketCap(1, 2.5e18, 1200e18);
```

---

### calculateCap

Pure function to calculate market cap without storing.

```solidity
function calculateCap(
    uint256 price,
    uint256 totalSupply
) external pure returns (uint256 cap)
```

**Parameters:**
- `price` (uint256): Price per token (18 decimals)
- `totalSupply` (uint256): Total supply (18 decimals)

**Returns:**
- `cap` (uint256): Calculated market cap

**Reverts:**
- `ZeroPrice()`: If price is 0
- `ZeroSupply()`: If totalSupply is 0

**Gas Cost:** 0 (view function)

**Example:**
```solidity
uint256 cap = marketCap.calculateCap(2e18, 1000e18);
// Returns: 2000e18
```

---

## Query Functions

### getMarketCap

Get complete market cap data for a market.

```solidity
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
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `currentCap` (uint256): Current market capitalization
- `previousCap` (uint256): Previous market capitalization
- `capLimit` (uint256): Maximum allowed cap (0 = unlimited)
- `totalSupply` (uint256): Total token supply
- `price` (uint256): Current price per token
- `lastUpdateTime` (uint256): Last update timestamp

**Reverts:**
- `MarketNotFound()`: If market doesn't exist

**Example:**
```solidity
(
    uint256 currentCap,
    uint256 previousCap,
    uint256 capLimit,
    uint256 totalSupply,
    uint256 price,
    uint256 lastUpdateTime
) = marketCap.getMarketCap(1);
```

---

### getCapChange

Get the change in market cap.

```solidity
function getCapChange(uint256 marketId) 
    external 
    view 
    returns (uint256 change, bool isIncrease)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `change` (uint256): Absolute change in market cap
- `isIncrease` (bool): True if cap increased, false if decreased

**Reverts:**
- `MarketNotFound()`: If market doesn't exist

**Example:**
```solidity
(uint256 change, bool isIncrease) = marketCap.getCapChange(1);
if (isIncrease) {
    console.log("Cap increased by:", change);
} else {
    console.log("Cap decreased by:", change);
}
```

---

### getCapChangePercentage

Get percentage change in market cap.

```solidity
function getCapChangePercentage(uint256 marketId) 
    external 
    view 
    returns (uint256 percentageChange, bool isIncrease)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `percentageChange` (uint256): Percentage change (18 decimals, e.g., 5e18 = 5%)
- `isIncrease` (bool): True if increased

**Reverts:**
- `MarketNotFound()`: If market doesn't exist

**Example:**
```solidity
(uint256 percentage, bool isIncrease) = marketCap.getCapChangePercentage(1);
// percentage = 25e18 means 25% change
```

---

### getCapExtremes

Get peak and lowest caps for a market.

```solidity
function getCapExtremes(uint256 marketId) 
    external 
    view 
    returns (uint256 peakCap, uint256 lowestCap)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `peakCap` (uint256): Highest cap reached
- `lowestCap` (uint256): Lowest cap reached

**Reverts:**
- `MarketNotFound()`: If market doesn't exist

**Example:**
```solidity
(uint256 peak, uint256 lowest) = marketCap.getCapExtremes(1);
console.log("Range:", peak - lowest);
```

---

### getAllMarketIds

Get all market IDs.

```solidity
function getAllMarketIds() external view returns (uint256[] memory)
```

**Returns:**
- Array of all market IDs

**Example:**
```solidity
uint256[] memory ids = marketCap.getAllMarketIds();
for (uint256 i = 0; i < ids.length; i++) {
    console.log("Market ID:", ids[i]);
}
```

---

### marketExists

Check if a market exists.

```solidity
function marketExists(uint256 marketId) external view returns (bool)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `bool`: True if market exists

**Example:**
```solidity
if (marketCap.marketExists(1)) {
    // Market exists
}
```

---

### getMarketCount

Get total number of markets.

```solidity
function getMarketCount() external view returns (uint256)
```

**Returns:**
- `uint256`: Number of markets

**Example:**
```solidity
uint256 count = marketCap.getMarketCount();
console.log("Total markets:", count);
```

---

### getUpdateCount

Get number of updates for a market.

```solidity
function getUpdateCount(uint256 marketId) external view returns (uint256 count)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `count` (uint256): Number of updates

**Reverts:**
- `MarketNotFound()`: If market doesn't exist

**Example:**
```solidity
uint256 updates = marketCap.getUpdateCount(1);
```

---

## Advanced Features

### batchCalculateMarketCap

Calculate market caps for multiple markets in one transaction.

```solidity
function batchCalculateMarketCap(
    uint256[] calldata marketIds,
    uint256[] calldata prices,
    uint256[] calldata supplies
) external nonReentrant returns (BatchCapResult[] memory results)
```

**Parameters:**
- `marketIds` (uint256[]): Array of market IDs
- `prices` (uint256[]): Array of prices
- `supplies` (uint256[]): Array of supplies

**Returns:**
- `results` (BatchCapResult[]): Array of results with success status

**Emits:**
- `BatchCapCalculated(successCount, failureCount)`

**Reverts:**
- `InvalidBatchSize()`: If arrays have different lengths or size is 0 or > 50

**Example:**
```solidity
uint256[] memory ids = new uint256[](3);
uint256[] memory prices = new uint256[](3);
uint256[] memory supplies = new uint256[](3);

ids[0] = 1; prices[0] = 2e18; supplies[0] = 1000e18;
ids[1] = 2; prices[1] = 3e18; supplies[1] = 500e18;
ids[2] = 3; prices[2] = 1e18; supplies[2] = 2000e18;

BatchCapResult[] memory results = marketCap.batchCalculateMarketCap(
    ids, prices, supplies
);

for (uint256 i = 0; i < results.length; i++) {
    if (results[i].success) {
        console.log("Market", results[i].marketId, "cap:", results[i].cap);
    }
}
```

---

### getSnapshots

Get historical snapshots for a market.

```solidity
function getSnapshots(uint256 marketId) 
    external 
    view 
    returns (CapSnapshot[] memory snapshots)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `snapshots` (CapSnapshot[]): Array of historical snapshots (max 100)

**Example:**
```solidity
CapSnapshot[] memory history = marketCap.getSnapshots(1);
for (uint256 i = 0; i < history.length; i++) {
    console.log("Time:", history[i].timestamp);
    console.log("Cap:", history[i].cap);
}
```

---

### getLatestSnapshot

Get the most recent snapshot for a market.

```solidity
function getLatestSnapshot(uint256 marketId) 
    external 
    view 
    returns (CapSnapshot memory snapshot)
```

**Parameters:**
- `marketId` (uint256): The market identifier

**Returns:**
- `snapshot` (CapSnapshot): Latest snapshot

**Example:**
```solidity
CapSnapshot memory latest = marketCap.getLatestSnapshot(1);
console.log("Latest cap:", latest.cap);
console.log("Latest price:", latest.price);
```

---

### compareMarketCaps

Compare two markets by cap.

```solidity
function compareMarketCaps(uint256 marketId1, uint256 marketId2) 
    external 
    view 
    returns (uint256 difference, bool market1IsLarger)
```

**Parameters:**
- `marketId1` (uint256): First market ID
- `marketId2` (uint256): Second market ID

**Returns:**
- `difference` (uint256): Absolute difference in caps
- `market1IsLarger` (bool): True if market1 has larger cap

**Reverts:**
- `MarketNotFound()`: If either market doesn't exist

**Example:**
```solidity
(uint256 diff, bool market1Larger) = marketCap.compareMarketCaps(1, 2);
if (market1Larger) {
    console.log("Market 1 is larger by:", diff);
}
```

---

### getTotalMarketCap

Get total market cap across all markets.

```solidity
function getTotalMarketCap() external view returns (uint256 totalCap)
```

**Returns:**
- `totalCap` (uint256): Sum of all market caps

**Example:**
```solidity
uint256 total = marketCap.getTotalMarketCap();
console.log("Total market cap:", total);
```

---

### getTopMarketsByCap

Get markets sorted by cap (descending).

```solidity
function getTopMarketsByCap(uint256 limit) 
    external 
    view 
    returns (uint256[] memory marketIds, uint256[] memory caps)
```

**Parameters:**
- `limit` (uint256): Maximum number of markets to return

**Returns:**
- `marketIds` (uint256[]): Array of market IDs sorted by cap
- `caps` (uint256[]): Array of corresponding caps

**Example:**
```solidity
(uint256[] memory topIds, uint256[] memory topCaps) = marketCap.getTopMarketsByCap(10);
for (uint256 i = 0; i < topIds.length; i++) {
    console.log("Rank", i+1, "- Market", topIds[i], ":", topCaps[i]);
}
```

---

## Admin Functions

### setCapLimit

Set a cap limit for a market (owner only).

```solidity
function setCapLimit(uint256 marketId, uint256 capLimit) external onlyOwner
```

**Parameters:**
- `marketId` (uint256): The market identifier
- `capLimit` (uint256): Maximum allowed market cap (0 = no limit)

**Emits:**
- `CapLimitSet(marketId, capLimit)`

**Reverts:**
- `ZeroMarketId()`: If marketId is 0
- `MarketNotFound()`: If market doesn't exist
- `Unauthorized()`: If caller is not owner

**Example:**
```solidity
marketCap.setCapLimit(1, 10000e18); // Set limit to 10,000
marketCap.setCapLimit(1, 0);        // Remove limit
```

---

### setCapThreshold

Set a threshold alert for a market (owner only).

```solidity
function setCapThreshold(uint256 marketId, uint256 threshold) external onlyOwner
```

**Parameters:**
- `marketId` (uint256): The market identifier
- `threshold` (uint256): The threshold value

**Reverts:**
- `ZeroMarketId()`: If marketId is 0
- `InvalidThreshold()`: If threshold is 0
- `MarketNotFound()`: If market doesn't exist
- `Unauthorized()`: If caller is not owner

**Example:**
```solidity
marketCap.setCapThreshold(1, 5000e18); // Alert at 5,000
```

---

### removeCapThreshold

Remove a threshold alert (owner only).

```solidity
function removeCapThreshold(uint256 marketId, uint256 threshold) external onlyOwner
```

**Parameters:**
- `marketId` (uint256): The market identifier
- `threshold` (uint256): The threshold value to remove

**Reverts:**
- `ZeroMarketId()`: If marketId is 0
- `Unauthorized()`: If caller is not owner

**Example:**
```solidity
marketCap.removeCapThreshold(1, 5000e18);
```

---

## Events

### MarketCapCalculated

Emitted when market cap is calculated.

```solidity
event MarketCapCalculated(
    uint256 indexed marketId,
    uint256 currentCap,
    uint256 previousCap,
    uint256 change,
    uint256 timestamp
)
```

---

### CapLimitSet

Emitted when cap limit is set.

```solidity
event CapLimitSet(
    uint256 indexed marketId,
    uint256 capLimit
)
```

---

### MarketCapUpdated

Emitted when market cap is updated.

```solidity
event MarketCapUpdated(
    uint256 indexed marketId,
    uint256 newCap,
    uint256 price,
    uint256 supply
)
```

---

### CapThresholdReached

Emitted when a threshold is reached.

```solidity
event CapThresholdReached(
    uint256 indexed marketId,
    uint256 cap,
    uint256 threshold,
    bool isAbove
)
```

---

### PeakCapReached

Emitted when a new peak cap is reached.

```solidity
event PeakCapReached(
    uint256 indexed marketId,
    uint256 newPeak
)
```

---

### BatchCapCalculated

Emitted after batch calculation.

```solidity
event BatchCapCalculated(
    uint256 successCount,
    uint256 failureCount
)
```

---

## Errors

- `ZeroMarketId()`: Market ID cannot be zero
- `ZeroPrice()`: Price cannot be zero
- `ZeroSupply()`: Supply cannot be zero
- `CapLimitExceeded()`: Calculated cap exceeds limit
- `InvalidCapLimit()`: Invalid cap limit value
- `MarketNotFound()`: Market does not exist
- `InvalidThreshold()`: Invalid threshold value
- `InvalidBatchSize()`: Invalid batch operation size

---

## Data Structures

### MarketCapData

```solidity
struct MarketCapData {
    UD60x18 currentCap;      // Current market cap
    UD60x18 previousCap;     // Previous cap for change tracking
    UD60x18 capLimit;        // Max allowed cap (0 = unlimited)
    UD60x18 totalSupply;     // Total token supply
    UD60x18 price;           // Current price per token
    uint256 lastUpdateTime;  // Last update timestamp
    uint256 updateCount;     // Number of updates
    UD60x18 peakCap;         // Highest cap reached
    UD60x18 lowestCap;       // Lowest cap reached
    bool exists;             // Market existence flag
}
```

### CapSnapshot

```solidity
struct CapSnapshot {
    uint256 timestamp;  // Snapshot timestamp
    uint256 cap;        // Market cap at snapshot
    uint256 price;      // Price at snapshot
    uint256 supply;     // Supply at snapshot
}
```

### BatchCapResult

```solidity
struct BatchCapResult {
    uint256 marketId;  // Market identifier
    uint256 cap;       // Calculated cap
    bool success;      // Operation success status
}
```

---

## Constants

```solidity
uint256 public constant MAX_SNAPSHOTS = 100;
```

Maximum number of snapshots stored per market.

---

## Version

Contract Version: 2.0.0
Solidity Version: ^0.8.20

---

## License

MIT License
