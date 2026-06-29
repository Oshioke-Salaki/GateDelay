// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PriceOracle.sol";

contract PriceOracleTest is Test {
    PriceOracle internal oracle;

    bytes32 constant ETH_USD  = keccak256("ETH/USD");
    bytes32 constant BTC_USD  = keccak256("BTC/USD");
    bytes32 constant FALLBACK = keccak256("ETH/USD/FALLBACK");

    uint256 constant MAX_STALENESS = 1 hours;

    address internal updater = address(0xFEED);

    function setUp() public {
        oracle = new PriceOracle();
        oracle.registerFeed(ETH_USD,  "ETH/USD",          MAX_STALENESS);
        oracle.registerFeed(BTC_USD,  "BTC/USD",          MAX_STALENESS);
        oracle.registerFeed(FALLBACK, "ETH/USD Fallback", MAX_STALENESS);

        oracle.setUpdater(updater, true);
    }

    // ── Registration ───────────────────────────────────────────────────────────

    function test_registerFeed_storesMetadata() public {
        PriceOracle.FeedData memory f = oracle.getFeedInfo(ETH_USD);
        assertEq(f.description, "ETH/USD");
        assertEq(f.maxStaleness, MAX_STALENESS);
        assertTrue(f.active);
    }

    function test_registerFeed_revertsOnDuplicate() public {
        vm.expectRevert(PriceOracle.FeedAlreadyRegistered.selector);
        oracle.registerFeed(ETH_USD, "ETH/USD", MAX_STALENESS);
    }

    function test_deactivateFeed_marksInactive() public {
        oracle.deactivateFeed(ETH_USD);
        PriceOracle.FeedData memory f = oracle.getFeedInfo(ETH_USD);
        assertFalse(f.active);
    }

    function test_deactivateFeed_revertsUnknownFeed() public {
        vm.expectRevert(PriceOracle.FeedNotRegistered.selector);
        oracle.deactivateFeed(keccak256("UNKNOWN"));
    }

    // ── Price updates ──────────────────────────────────────────────────────────

    function test_updatePrice_storesPrice() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        (int256 price, uint256 updatedAt) = oracle.getRawPrice(ETH_USD);
        assertEq(price, 2000e18);
        assertEq(updatedAt, block.timestamp);
    }

    function test_updatePrice_revertsNegativePrice() public {
        vm.expectRevert(PriceOracle.InvalidPrice.selector);
        oracle.updatePrice(ETH_USD, -1);
    }

    function test_updatePrice_revertsZeroPrice() public {
        vm.expectRevert(PriceOracle.InvalidPrice.selector);
        oracle.updatePrice(ETH_USD, 0);
    }

    function test_updatePrice_byAuthorizedUpdater() public {
        vm.prank(updater);
        oracle.updatePrice(ETH_USD, 1800e18);
        (int256 price,) = oracle.getRawPrice(ETH_USD);
        assertEq(price, 1800e18);
    }

    function test_updatePrice_revertsUnauthorized() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(PriceOracle.NotAuthorizedUpdater.selector);
        oracle.updatePrice(ETH_USD, 1000e18);
    }

    // ── Price queries ──────────────────────────────────────────────────────────

    function test_getPrice_returnsFreshPrice() public {
        oracle.updatePrice(ETH_USD, 2500e18);
        (int256 price, uint256 ts) = oracle.getPrice(ETH_USD);
        assertEq(price, 2500e18);
        assertEq(ts, block.timestamp);
    }

    function test_getPrice_revertsOnStalePrice() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        vm.expectRevert(PriceOracle.NoValidPrice.selector);
        oracle.getPrice(ETH_USD);
    }

    function test_getPrice_usesFallbackWhenPrimaryStale() public {
        oracle.setFallback(ETH_USD, FALLBACK);
        oracle.updatePrice(ETH_USD, 2000e18);
        oracle.updatePrice(FALLBACK, 1999e18);

        // Stale the primary
        vm.warp(block.timestamp + MAX_STALENESS + 1);

        // Update fallback to be fresh
        oracle.updatePrice(FALLBACK, 1999e18);

        (int256 price,) = oracle.getPrice(ETH_USD);
        assertEq(price, 1999e18);
    }

    function test_getPrice_revertsWhenBothStale() public {
        oracle.setFallback(ETH_USD, FALLBACK);
        oracle.updatePrice(ETH_USD, 2000e18);
        oracle.updatePrice(FALLBACK, 1999e18);

        vm.warp(block.timestamp + MAX_STALENESS + 1);

        vm.expectRevert(PriceOracle.NoValidPrice.selector);
        oracle.getPrice(ETH_USD);
    }

    function test_getPrice_revertsUnregisteredFeed() public {
        vm.expectRevert(PriceOracle.FeedNotRegistered.selector);
        oracle.getPrice(keccak256("UNKNOWN"));
    }

    // ── Health check ───────────────────────────────────────────────────────────

    function test_isFeedHealthy_trueWhenFresh() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        assertTrue(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenStale() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenNeverUpdated() public {
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenDeactivated() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        oracle.deactivateFeed(ETH_USD);
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    // ── Fuzz ───────────────────────────────────────────────────────────────────

    function testFuzz_updateAndGetPrice(int128 rawPrice) public {
        vm.assume(rawPrice > 0);
        oracle.updatePrice(ETH_USD, int256(rawPrice));
        (int256 price,) = oracle.getPrice(ETH_USD);
        assertEq(price, int256(rawPrice));
    }
}
