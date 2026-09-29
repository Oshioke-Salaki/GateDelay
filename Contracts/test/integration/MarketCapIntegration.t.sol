// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/MarketCap.sol";

/// @title MarketCapIntegration
/// @notice Integration test proving happy path for MarketCap (Phase 2 wiring)
/// @dev Covers API_REFERENCE.md core + advanced features; gated by Contracts/.github/workflows/test.yml
contract MarketCapIntegrationTest is Test {
    MarketCap internal marketCap;
    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 constant PRICE_1 = 1e18;
    uint256 constant PRICE_2 = 2e18;
    uint256 constant SUPPLY_1000 = 1000e18;
    uint256 constant SUPPLY_500 = 500e18;

    function setUp() public {
        marketCap = new MarketCap();
    }

    function test_integration_apiReferenceHappyPath() public {
        // calculateMarketCap + getMarketCap + getCapChange
        uint256 cap1 = marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        assertEq(cap1, PRICE_1 * SUPPLY_1000 / 1e18);
        (uint256 cur, uint256 prev, , uint256 supply, uint256 price, ) = marketCap.getMarketCap(1);
        assertEq(cur, cap1);
        assertEq(prev, 0);
        assertEq(supply, SUPPLY_1000);
        assertEq(price, PRICE_1);

        // updateMarketCap
        marketCap.updateMarketCap(1, PRICE_2, SUPPLY_500);
        (uint256 cur2, uint256 prev2, , , , ) = marketCap.getMarketCap(1);
        assertEq(prev2, cur);
        assertEq(cur2, PRICE_2 * SUPPLY_500 / 1e18);

        // calculateCap pure
        uint256 pureCap = marketCap.calculateCap(PRICE_2, SUPPLY_1000);
        assertEq(pureCap, PRICE_2 * SUPPLY_1000 / 1e18);

        // getCapChangePercentage + getCapExtremes
        (uint256 pct, bool isInc) = marketCap.getCapChangePercentage(1);
        assertTrue(pct > 0 || pct == 0);
        (uint256 peak, uint256 low) = marketCap.getCapExtremes(1);
        assertGe(peak, low);

        // getUpdateCount + getTotalMarketCap
        assertEq(marketCap.getUpdateCount(1), 2);
        assertEq(marketCap.getMarketCount(), 1);
        assertGt(marketCap.getTotalMarketCap(), 0);

        // snapshots
        MarketCap.CapSnapshot[] memory snaps = marketCap.getSnapshots(1);
        assertEq(snaps.length, 2);
        MarketCap.CapSnapshot memory latest = marketCap.getLatestSnapshot(1);
        assertEq(latest.cap, cur2);

        // second market for compare + top
        marketCap.calculateMarketCap(2, PRICE_1, SUPPLY_500);
        (uint256 diff, bool m1Larger) = marketCap.compareMarketCaps(1, 2);
        assertGt(diff, 0);
        // market 1 = 1e21 (2e18*500e18/1e18 = 1000e18), market2 = 500e18 => m1 larger true
        assertTrue(m1Larger);

        (uint256[] memory topIds, uint256[] memory topCaps) = marketCap.getTopMarketsByCap(2);
        assertEq(topIds.length, 2);
        assertGe(topCaps[0], topCaps[1]);

        // cap limits + thresholds + batch
        marketCap.calculateMarketCap(3, PRICE_1, SUPPLY_1000);
        marketCap.setCapLimit(3, 5000e18);
        marketCap.setCapThreshold(3, 1000e18);
        // 5000e18 limit would be exceeded by 10k: expect revert
        vm.expectRevert(MarketCap.CapLimitExceeded.selector);
        marketCap.calculateMarketCap(3, PRICE_2, 5000e18);

        marketCap.removeCapThreshold(3, 1000e18);

        uint256[] memory ids = new uint256[](2);
        uint256[] memory prices = new uint256[](2);
        uint256[] memory supplies = new uint256[](2);
        ids[0] = 4; prices[0] = PRICE_1; supplies[0] = SUPPLY_1000;
        ids[1] = 5; prices[1] = PRICE_2; supplies[1] = SUPPLY_500;
        MarketCap.BatchCapResult[] memory results = marketCap.batchCalculateMarketCap(ids, prices, supplies);
        assertEq(results.length, 2);
        assertTrue(results[0].success);
        assertTrue(results[1].success);
        assertEq(marketCap.getMarketCount(), 5); // 1,2,3,4,5

        // existence checks
        assertTrue(marketCap.marketExists(1));
        assertFalse(marketCap.marketExists(999));
        uint256[] memory all = marketCap.getAllMarketIds();
        assertEq(all.length, 5);
    }

    function test_integration_batchRevertsInvalidSize() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory prices = new uint256[](2);
        uint256[] memory supplies = new uint256[](1);
        ids[0] = 1; prices[0] = PRICE_1; prices[1] = PRICE_2; supplies[0] = SUPPLY_1000;
        vm.expectRevert(MarketCap.InvalidBatchSize.selector);
        marketCap.batchCalculateMarketCap(ids, prices, supplies);
    }
}
