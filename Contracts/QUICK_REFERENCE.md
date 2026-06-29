# MarketCap Quick Reference Card

## 🚀 Quick Start

```solidity
// Deploy
MarketCap marketCap = new MarketCap();

// Calculate cap
uint256 cap = marketCap.calculateMarketCap(1, 2e18, 1000e18);
// Returns: 2000e18
```

## 📊 Core Functions

### Calculate Cap
```solidity
marketCap.calculateMarketCap(marketId, price, supply)
```

### Update Cap
```solidity
marketCap.updateMarketCap(marketId, newPrice, newSupply)
```

### Set Limit
```solidity
marketCap.setCapLimit(marketId, maxCap)
```

## 🔍 Query Functions

### Get Market Data
```solidity
(cap, prevCap, limit, supply, price, time) = marketCap.getMarketCap(marketId)
```

### Get Change
```solidity
(change, isIncrease) = marketCap.getCapChange(marketId)
```

### Get Percentage
```solidity
(percentage, isIncrease) = marketCap.getCapChangePercentage(marketId)
```

### Get Extremes
```solidity
(peak, lowest) = marketCap.getCapExtremes(marketId)
```

## 🎯 Advanced Features

### Batch Calculate
```solidity
results = marketCap.batchCalculateMarketCap(
    [1, 2, 3],
    [2e18, 3e18, 1e18],
    [1000e18, 500e18, 2000e18]
)
```

### Get Top Markets
```solidity
(ids, caps) = marketCap.getTopMarketsByCap(10)
```

### Compare Markets
```solidity
(diff, market1Larger) = marketCap.compareMarketCaps(1, 2)
```

### Total Cap
```solidity
total = marketCap.getTotalMarketCap()
```

## 📈 Historical Data

### Get Snapshots
```solidity
snapshots = marketCap.getSnapshots(marketId)
```

### Latest Snapshot
```solidity
snapshot = marketCap.getLatestSnapshot(marketId)
```

### Update Count
```solidity
count = marketCap.getUpdateCount(marketId)
```

## 🔔 Alerts

### Set Threshold
```solidity
marketCap.setCapThreshold(marketId, 5000e18)
```

### Remove Threshold
```solidity
marketCap.removeCapThreshold(marketId, 5000e18)
```

## 📋 Common Patterns

### Pattern 1: Track Market
```solidity
// Calculate initial cap
uint256 cap = marketCap.calculateMarketCap(1, 2e18, 1000e18);

// Set limit
marketCap.setCapLimit(1, 10000e18);

// Update periodically
marketCap.updateMarketCap(1, newPrice, newSupply);

// Query data
(uint256 currentCap,,,,,) = marketCap.getMarketCap(1);
```

### Pattern 2: Batch Update
```solidity
uint256[] memory ids = new uint256[](3);
uint256[] memory prices = new uint256[](3);
uint256[] memory supplies = new uint256[](3);

// Fill arrays...

BatchCapResult[] memory results = marketCap.batchCalculateMarketCap(
    ids, prices, supplies
);
```

### Pattern 3: Market Analysis
```solidity
// Get extremes
(uint256 peak, uint256 lowest) = marketCap.getCapExtremes(marketId);

// Get change
(uint256 percentage, bool isIncrease) = marketCap.getCapChangePercentage(marketId);

// Get history
CapSnapshot[] memory history = marketCap.getSnapshots(marketId);
```

### Pattern 4: Rankings
```solidity
// Get top 10 markets
(uint256[] memory topIds, uint256[] memory topCaps) = 
    marketCap.getTopMarketsByCap(10);

// Display rankings
for (uint256 i = 0; i < topIds.length; i++) {
    console.log("Rank", i+1, "- Market", topIds[i], ":", topCaps[i]);
}
```

## ⚡ Gas Costs

| Function | Gas | Cost @ 50 gwei |
|----------|-----|----------------|
| calculateMarketCap (first) | ~150k | ~$15 |
| calculateMarketCap (update) | ~80k | ~$8 |
| batchCalculate (5 markets) | ~350k | ~$35 |
| updateMarketCap | ~70k | ~$7 |
| setCapLimit | ~45k | ~$4.50 |
| View functions | 0 | $0 |

## 🔒 Security

### Access Control
- `setCapLimit()` - Owner only
- `setCapThreshold()` - Owner only
- `removeCapThreshold()` - Owner only

### Validations
- Market ID must be > 0
- Price must be > 0
- Supply must be > 0
- Market must exist (for updates)

### Protection
- Reentrancy guard on state changes
- Cap limit enforcement
- Safe math with PRBMath

## ❌ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ZeroMarketId()` | marketId is 0 | Use marketId > 0 |
| `ZeroPrice()` | price is 0 | Use price > 0 |
| `ZeroSupply()` | supply is 0 | Use supply > 0 |
| `MarketNotFound()` | Market doesn't exist | Call calculateMarketCap first |
| `CapLimitExceeded()` | Cap > limit | Increase limit or reduce cap |
| `InvalidBatchSize()` | Wrong array sizes | Ensure arrays match |

## 📱 Events

### MarketCapCalculated
```solidity
event MarketCapCalculated(
    uint256 indexed marketId,
    uint256 currentCap,
    uint256 previousCap,
    uint256 change,
    uint256 timestamp
)
```

### CapLimitSet
```solidity
event CapLimitSet(
    uint256 indexed marketId,
    uint256 capLimit
)
```

### MarketCapUpdated
```solidity
event MarketCapUpdated(
    uint256 indexed marketId,
    uint256 newCap,
    uint256 price,
    uint256 supply
)
```

### CapThresholdReached
```solidity
event CapThresholdReached(
    uint256 indexed marketId,
    uint256 cap,
    uint256 threshold,
    bool isAbove
)
```

### PeakCapReached
```solidity
event PeakCapReached(
    uint256 indexed marketId,
    uint256 newPeak
)
```

### BatchCapCalculated
```solidity
event BatchCapCalculated(
    uint256 successCount,
    uint256 failureCount
)
```

## 🧪 Testing

```bash
# Run all tests
forge test --match-contract MarketCapTest -vv

# Run specific test
forge test --match-test test_calculateMarketCap_success -vvv

# Gas report
forge test --match-contract MarketCapTest --gas-report
```

## 📚 Documentation

- **Full API**: `API_REFERENCE.md`
- **Integration**: `INTEGRATION_GUIDE.md`
- **Implementation**: `MARKET_CAP_IMPLEMENTATION.md`
- **Gas Analysis**: `GAS_OPTIMIZATION_REPORT.md`

## 🔗 Links

- Contract: `contracts/MarketCap.sol`
- Tests: `test/MarketCap.t.sol`
- Deploy: `script/DeployMarketCap.s.sol`

## 💡 Tips

1. **Use batch operations** for multiple markets
2. **Use view functions** for free queries
3. **Set cap limits** to prevent excessive growth
4. **Monitor events** for real-time updates
5. **Check snapshots** for historical analysis
6. **Compare markets** to identify trends
7. **Use thresholds** for milestone alerts

## 🚨 Best Practices

✅ **DO:**
- Validate inputs before calling
- Use batch operations when possible
- Monitor gas costs
- Set reasonable cap limits
- Use view functions for queries
- Handle errors gracefully

❌ **DON'T:**
- Use marketId = 0
- Set price or supply to 0
- Exceed batch size of 50
- Ignore cap limit errors
- Call state-changing functions for queries

## 📞 Support

Need help? Check:
1. This quick reference
2. `API_REFERENCE.md` for detailed docs
3. `INTEGRATION_GUIDE.md` for examples
4. Test files for usage patterns

---

**Version**: 2.0.0  
**Last Updated**: 2026-04-28  
**License**: MIT
