# MarketCap Integration Guide

## Overview
This guide demonstrates how to integrate the MarketCap contract into your prediction market platform.

## Quick Start

### 1. Deploy the Contract

```bash
# Using Foundry
forge script script/DeployMarketCap.s.sol:DeployMarketCap --rpc-url $RPC_URL --broadcast

# Or using forge create
forge create contracts/MarketCap.sol:MarketCap --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### 2. Basic Usage

```solidity
// Initialize the contract
MarketCap marketCap = MarketCap(DEPLOYED_ADDRESS);

// Calculate market cap
uint256 cap = marketCap.calculateMarketCap(
    1,              // marketId
    2e18,           // price (2.0 tokens)
    1000e18         // supply (1000 tokens)
);
// Returns: 2000e18 (2000.0)
```

## Integration Patterns

### Pattern 1: Real-time Market Tracking

```solidity
contract PredictionMarket {
    MarketCap public marketCap;
    
    constructor(address _marketCap) {
        marketCap = MarketCap(_marketCap);
    }
    
    function updateMarketPrice(uint256 marketId, uint256 newPrice) external {
        // Update your market logic
        // ...
        
        // Update market cap
        uint256 totalSupply = getTotalSupply(marketId);
        marketCap.calculateMarketCap(marketId, newPrice, totalSupply);
    }
}
```

### Pattern 2: Batch Updates

```solidity
function updateMultipleMarkets(
    uint256[] calldata marketIds,
    uint256[] calldata prices
) external {
    uint256[] memory supplies = new uint256[](marketIds.length);
    
    for (uint256 i = 0; i < marketIds.length; i++) {
        supplies[i] = getTotalSupply(marketIds[i]);
    }
    
    MarketCap.BatchCapResult[] memory results = marketCap.batchCalculateMarketCap(
        marketIds,
        prices,
        supplies
    );
    
    // Process results
    for (uint256 i = 0; i < results.length; i++) {
        if (results[i].success) {
            emit MarketCapUpdated(results[i].marketId, results[i].cap);
        }
    }
}
```

### Pattern 3: Cap Limit Enforcement

```solidity
function createMarket(
    uint256 marketId,
    uint256 initialPrice,
    uint256 initialSupply,
    uint256 maxCap
) external onlyOwner {
    // Create market
    // ...
    
    // Calculate initial cap
    marketCap.calculateMarketCap(marketId, initialPrice, initialSupply);
    
    // Set cap limit
    if (maxCap > 0) {
        marketCap.setCapLimit(marketId, maxCap);
    }
}
```

### Pattern 4: Threshold Alerts

```solidity
function setupMarketAlerts(uint256 marketId) external onlyOwner {
    // Set thresholds for important milestones
    marketCap.setCapThreshold(marketId, 1000e18);   // 1k
    marketCap.setCapThreshold(marketId, 10000e18);  // 10k
    marketCap.setCapThreshold(marketId, 100000e18); // 100k
}

// Listen for threshold events
function onCapThresholdReached(
    uint256 marketId,
    uint256 cap,
    uint256 threshold,
    bool isAbove
) external {
    if (isAbove) {
        // Market reached milestone
        rewardMarketCreator(marketId);
    }
}
```

### Pattern 5: Historical Analysis

```solidity
function analyzeMarketPerformance(uint256 marketId) 
    external 
    view 
    returns (
        uint256 currentCap,
        uint256 peakCap,
        uint256 lowestCap,
        uint256 percentageChange,
        uint256 updateCount
    ) 
{
    (currentCap, , , , , ) = marketCap.getMarketCap(marketId);
    (peakCap, lowestCap) = marketCap.getCapExtremes(marketId);
    (percentageChange, ) = marketCap.getCapChangePercentage(marketId);
    updateCount = marketCap.getUpdateCount(marketId);
}
```

### Pattern 6: Market Comparison

```solidity
function getMarketRankings(uint256 limit) 
    external 
    view 
    returns (uint256[] memory marketIds, uint256[] memory caps) 
{
    return marketCap.getTopMarketsByCap(limit);
}

function compareMarkets(uint256 marketId1, uint256 marketId2) 
    external 
    view 
    returns (string memory result) 
{
    (uint256 diff, bool market1IsLarger) = marketCap.compareMarketCaps(
        marketId1,
        marketId2
    );
    
    if (market1IsLarger) {
        return string(abi.encodePacked(
            "Market ",
            Strings.toString(marketId1),
            " is larger by ",
            Strings.toString(diff)
        ));
    } else {
        return string(abi.encodePacked(
            "Market ",
            Strings.toString(marketId2),
            " is larger by ",
            Strings.toString(diff)
        ));
    }
}
```

## Event Handling

### Listen to Events

```javascript
// JavaScript/TypeScript example using ethers.js
const marketCap = new ethers.Contract(address, abi, provider);

// Listen for cap calculations
marketCap.on("MarketCapCalculated", (marketId, currentCap, previousCap, change, timestamp) => {
    console.log(`Market ${marketId} cap: ${ethers.utils.formatEther(currentCap)}`);
    console.log(`Change: ${ethers.utils.formatEther(change)}`);
});

// Listen for threshold alerts
marketCap.on("CapThresholdReached", (marketId, cap, threshold, isAbove) => {
    if (isAbove) {
        console.log(`Market ${marketId} reached ${ethers.utils.formatEther(threshold)} milestone!`);
    }
});

// Listen for peak caps
marketCap.on("PeakCapReached", (marketId, newPeak) => {
    console.log(`Market ${marketId} new peak: ${ethers.utils.formatEther(newPeak)}`);
});
```

## Advanced Features

### 1. Snapshot Analysis

```solidity
function getMarketHistory(uint256 marketId) 
    external 
    view 
    returns (MarketCap.CapSnapshot[] memory) 
{
    return marketCap.getSnapshots(marketId);
}

function getLatestMarketData(uint256 marketId) 
    external 
    view 
    returns (
        uint256 timestamp,
        uint256 cap,
        uint256 price,
        uint256 supply
    ) 
{
    MarketCap.CapSnapshot memory snapshot = marketCap.getLatestSnapshot(marketId);
    return (snapshot.timestamp, snapshot.cap, snapshot.price, snapshot.supply);
}
```

### 2. Portfolio Analysis

```solidity
function getPortfolioValue(uint256[] calldata marketIds) 
    external 
    view 
    returns (uint256 totalValue) 
{
    for (uint256 i = 0; i < marketIds.length; i++) {
        (uint256 cap, , , , , ) = marketCap.getMarketCap(marketIds[i]);
        totalValue += cap;
    }
}
```

### 3. Market Health Indicators

```solidity
function getMarketHealth(uint256 marketId) 
    external 
    view 
    returns (
        bool isHealthy,
        string memory status
    ) 
{
    (uint256 currentCap, , uint256 capLimit, , , ) = marketCap.getMarketCap(marketId);
    (uint256 peakCap, ) = marketCap.getCapExtremes(marketId);
    
    if (capLimit > 0 && currentCap > capLimit * 90 / 100) {
        return (false, "Near cap limit");
    }
    
    if (currentCap < peakCap * 50 / 100) {
        return (false, "Significant decline");
    }
    
    return (true, "Healthy");
}
```

## Gas Optimization Tips

### 1. Batch Operations
Always use `batchCalculateMarketCap` when updating multiple markets:

```solidity
// ❌ Bad: Multiple transactions
for (uint256 i = 0; i < marketIds.length; i++) {
    marketCap.calculateMarketCap(marketIds[i], prices[i], supplies[i]);
}

// ✅ Good: Single batch transaction
marketCap.batchCalculateMarketCap(marketIds, prices, supplies);
```

### 2. View Functions
Use view functions for queries to avoid gas costs:

```solidity
// ✅ No gas cost
uint256 cap = marketCap.calculateCap(price, supply);

// ❌ Gas cost (state-changing)
uint256 cap = marketCap.calculateMarketCap(marketId, price, supply);
```

### 3. Event Indexing
Index events off-chain for historical data instead of storing everything on-chain.

## Security Considerations

### 1. Access Control
```solidity
// Only owner can set limits
function setMarketCapLimit(uint256 marketId, uint256 limit) external onlyOwner {
    marketCap.setCapLimit(marketId, limit);
}
```

### 2. Input Validation
```solidity
function updateCap(uint256 marketId, uint256 price, uint256 supply) external {
    require(marketId > 0, "Invalid market ID");
    require(price > 0, "Invalid price");
    require(supply > 0, "Invalid supply");
    
    marketCap.calculateMarketCap(marketId, price, supply);
}
```

### 3. Reentrancy Protection
The MarketCap contract uses `nonReentrant` modifier, but ensure your integration also follows best practices.

## Testing Integration

```solidity
contract MarketCapIntegrationTest is Test {
    MarketCap marketCap;
    
    function setUp() public {
        marketCap = new MarketCap();
    }
    
    function testIntegration() public {
        // Your integration tests
        uint256 cap = marketCap.calculateMarketCap(1, 2e18, 1000e18);
        assertEq(cap, 2000e18);
    }
}
```

## Frontend Integration

### React Example

```typescript
import { useContract, useContractRead, useContractWrite } from 'wagmi';
import MarketCapABI from './MarketCap.json';

function MarketCapDashboard() {
    const { data: totalCap } = useContractRead({
        address: MARKET_CAP_ADDRESS,
        abi: MarketCapABI,
        functionName: 'getTotalMarketCap',
    });
    
    const { data: topMarkets } = useContractRead({
        address: MARKET_CAP_ADDRESS,
        abi: MarketCapABI,
        functionName: 'getTopMarketsByCap',
        args: [10],
    });
    
    return (
        <div>
            <h2>Total Market Cap: {formatEther(totalCap)}</h2>
            <h3>Top Markets:</h3>
            <ul>
                {topMarkets?.marketIds.map((id, i) => (
                    <li key={id}>
                        Market {id}: {formatEther(topMarkets.caps[i])}
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

## API Integration

### REST API Example

```javascript
// Express.js endpoint
app.get('/api/market/:id/cap', async (req, res) => {
    const marketId = req.params.id;
    
    const data = await marketCap.getMarketCap(marketId);
    
    res.json({
        marketId,
        currentCap: ethers.utils.formatEther(data.currentCap),
        previousCap: ethers.utils.formatEther(data.previousCap),
        change: calculateChange(data.currentCap, data.previousCap),
        lastUpdate: new Date(data.lastUpdateTime * 1000).toISOString()
    });
});
```

## Troubleshooting

### Common Issues

1. **CapLimitExceeded Error**
   - Check if cap limit is set too low
   - Increase limit or remove it: `setCapLimit(marketId, 0)`

2. **MarketNotFound Error**
   - Ensure market is initialized with `calculateMarketCap` first
   - Check market ID is correct

3. **InvalidBatchSize Error**
   - Ensure all arrays have same length
   - Keep batch size between 1-50

## Support

For issues or questions:
- Check the main documentation: `MARKET_CAP_IMPLEMENTATION.md`
- Review test cases: `test/MarketCap.t.sol`
- Open an issue on GitHub

## License

MIT License - See LICENSE file for details
