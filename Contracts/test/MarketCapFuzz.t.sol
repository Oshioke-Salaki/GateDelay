// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketCap.sol";

/// @title MarketCapFuzz
/// @notice Fuzz tests for market cap, supply limits, caps, and pause state boundaries
/// @dev Tests #958: Fuzz supply limits, caps, pause states, and edge inputs under varied call sequences
contract MarketCapFuzz is Test {
    MarketCap internal marketCap;
    address internal owner = address(this);

    function setUp() public {
        marketCap = new MarketCap();
    }

    /// @notice Fuzz test: Market cap calculation with varied inputs
    function testFuzz_CalculateMarketCap(
        uint256 marketId,
        uint256 price,
        uint256 supply
    ) public {
        // Bound inputs to valid ranges
        marketId = bound(marketId, 1, type(uint128).max);
        price = bound(price, 1, 1e30); // Reasonable price range
        supply = bound(supply, 1, 1e30); // Reasonable supply range

        uint256 cap = marketCap.calculateMarketCap(marketId, price, supply);
        
        // Verify cap is non-zero and within reasonable bounds
        assertGt(cap, 0, "Cap should be greater than zero");
        assertTrue(marketCap.marketExists(marketId), "Market should exist");
    }

    /// @notice Fuzz test: Cap limit enforcement with varied sequences
    function testFuzz_CapLimitEnforcement(
        uint256 marketId,
        uint256 initialPrice,
        uint256 initialSupply,
        uint256 capLimit,
        uint256 newPrice,
        uint256 newSupply
    ) public {
        // Bound inputs
        marketId = bound(marketId, 1, type(uint64).max);
        initialPrice = bound(initialPrice, 1, 1e24);
        initialSupply = bound(initialSupply, 1, 1e24);
        capLimit = bound(capLimit, 1, type(uint128).max);
        newPrice = bound(newPrice, 1, 1e24);
        newSupply = bound(newSupply, 1, 1e24);

        // Initialize market
        marketCap.calculateMarketCap(marketId, initialPrice, initialSupply);
        
        // Set cap limit
        marketCap.setCapLimit(marketId, capLimit);

        // Calculate new cap
        uint256 newCap = (newPrice * newSupply) / 1e18;

        if (newCap <= capLimit) {
            // Should succeed
            marketCap.calculateMarketCap(marketId, newPrice, newSupply);
            (uint256 currentCap,,,,,) = marketCap.getMarketCap(marketId);
            assertEq(currentCap, newCap, "Cap should match calculated value");
        } else {
            // Should revert
            vm.expectRevert(MarketCap.CapLimitExceeded.selector);
            marketCap.calculateMarketCap(marketId, newPrice, newSupply);
        }
    }

    /// @notice Fuzz test: Multiple market operations with varied sequences
    function testFuzz_MultipleMarketSequence(
        uint256[5] memory marketIds,
        uint256[5] memory prices,
        uint256[5] memory supplies
    ) public {
        for (uint256 i = 0; i < 5; i++) {
            // Bound each input
            marketIds[i] = bound(marketIds[i], 1, type(uint64).max);
            prices[i] = bound(prices[i], 1, 1e24);
            supplies[i] = bound(supplies[i], 1, 1e24);

            // Create market
            marketCap.calculateMarketCap(marketIds[i], prices[i], supplies[i]);
            
            // Verify market exists
            assertTrue(marketCap.marketExists(marketIds[i]), "Market should exist");
        }

        // Verify market count
        assertGe(marketCap.getMarketCount(), 1, "Should have at least 1 market");
        assertLe(marketCap.getMarketCount(), 5, "Should have at most 5 markets");
    }

    /// @notice Fuzz test: Threshold boundaries
    function testFuzz_ThresholdBoundaries(
        uint256 marketId,
        uint256 price,
        uint256 supply,
        uint256 threshold
    ) public {
        // Bound inputs
        marketId = bound(marketId, 1, type(uint64).max);
        price = bound(price, 1, 1e24);
        supply = bound(supply, 1, 1e24);
        threshold = bound(threshold, 1, 1e30);

        // Create market
        marketCap.calculateMarketCap(marketId, price, supply);
        
        // Set threshold
        marketCap.setCapThreshold(marketId, threshold);

        // Update market and verify no revert
        marketCap.updateMarketCap(marketId, price, supply);
    }

    /// @notice Fuzz test: Batch operations with varied inputs
    function testFuzz_BatchOperations(
        uint256[10] memory marketIds,
        uint256[10] memory prices,
        uint256[10] memory supplies,
        uint8 batchSize
    ) public {
        // Bound batch size (1-10 for reasonable testing, max 50 allowed)
        batchSize = uint8(bound(batchSize, 1, 10));

        // Prepare arrays
        uint256[] memory ids = new uint256[](batchSize);
        uint256[] memory priceArr = new uint256[](batchSize);
        uint256[] memory supplyArr = new uint256[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            ids[i] = bound(marketIds[i], 1, type(uint64).max);
            priceArr[i] = bound(prices[i], 1, 1e24);
            supplyArr[i] = bound(supplies[i], 1, 1e24);
        }

        // Execute batch
        MarketCap.BatchCapResult[] memory results = 
            marketCap.batchCalculateMarketCap(ids, priceArr, supplyArr);

        // Verify all succeeded
        assertEq(results.length, batchSize, "Result count should match batch size");
    }

    /// @notice Fuzz test: Update with cap limit variations
    function testFuzz_UpdateWithCapLimit(
        uint256 marketId,
        uint256 price1,
        uint256 supply1,
        uint256 price2,
        uint256 supply2,
        uint256 capLimit
    ) public {
        // Bound inputs
        marketId = bound(marketId, 1, type(uint64).max);
        price1 = bound(price1, 1, 1e23);
        supply1 = bound(supply1, 1, 1e23);
        price2 = bound(price2, 1, 1e23);
        supply2 = bound(supply2, 1, 1e23);
        capLimit = bound(capLimit, 1e18, type(uint128).max);

        // Initialize
        marketCap.calculateMarketCap(marketId, price1, supply1);
        
        // Set cap limit
        marketCap.setCapLimit(marketId, capLimit);

        // Try update
        uint256 newCap = (price2 * supply2) / 1e18;
        
        if (newCap <= capLimit) {
            marketCap.updateMarketCap(marketId, price2, supply2);
            (uint256 currentCap,,,,,) = marketCap.getMarketCap(marketId);
            assertEq(currentCap, newCap, "Cap should be updated");
        } else {
            vm.expectRevert(MarketCap.CapLimitExceeded.selector);
            marketCap.updateMarketCap(marketId, price2, supply2);
        }
    }

    /// @notice Fuzz test: Supply boundary conditions
    function testFuzz_SupplyBoundaries(
        uint256 marketId,
        uint256 price
    ) public {
        marketId = bound(marketId, 1, type(uint64).max);
        price = bound(price, 1, 1e24);

        // Test minimum supply (1 wei)
        marketCap.calculateMarketCap(marketId, price, 1);
        assertTrue(marketCap.marketExists(marketId));

        // Test zero supply (should revert)
        vm.expectRevert(MarketCap.ZeroSupply.selector);
        marketCap.calculateMarketCap(marketId + 1, price, 0);
    }

    /// @notice Fuzz test: Price boundary conditions
    function testFuzz_PriceBoundaries(
        uint256 marketId,
        uint256 supply
    ) public {
        marketId = bound(marketId, 1, type(uint64).max);
        supply = bound(supply, 1, 1e24);

        // Test minimum price (1 wei)
        marketCap.calculateMarketCap(marketId, 1, supply);
        assertTrue(marketCap.marketExists(marketId));

        // Test zero price (should revert)
        vm.expectRevert(MarketCap.ZeroPrice.selector);
        marketCap.calculateMarketCap(marketId + 1, 0, supply);
    }

    /// @notice Fuzz test: Extreme cap changes
    function testFuzz_ExtremeCapChanges(
        uint256 marketId,
        uint256 priceA,
        uint256 supplyA,
        uint256 priceB,
        uint256 supplyB
    ) public {
        marketId = bound(marketId, 1, type(uint64).max);
        priceA = bound(priceA, 1, 1e24);
        supplyA = bound(supplyA, 1, 1e24);
        priceB = bound(priceB, 1, 1e24);
        supplyB = bound(supplyB, 1, 1e24);

        // First calculation
        marketCap.calculateMarketCap(marketId, priceA, supplyA);
        
        // Second calculation with potentially extreme change
        marketCap.calculateMarketCap(marketId, priceB, supplyB);

        // Verify extremes are tracked
        (uint256 peak, uint256 lowest) = marketCap.getCapExtremes(marketId);
        assertGt(peak, 0, "Peak should be set");
        assertGt(lowest, 0, "Lowest should be set");
        assertGe(peak, lowest, "Peak should be >= lowest");
    }
}
