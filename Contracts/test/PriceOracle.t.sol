// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PriceOracle.sol";

contract PriceOracleTest is Test {
    event UpdaterSet(bytes32 indexed feedId, address indexed updater, bool approved);

    PriceOracle internal oracle;

    bytes32 constant ETH_USD  = keccak256("ETH/USD");
    bytes32 constant BTC_USD  = keccak256("BTC/USD");
    bytes32 constant FALLBACK = keccak256("ETH/USD/FALLBACK");
    bytes32 constant ETH_ASSET = keccak256("ETH");
    bytes32 constant BTC_ASSET = keccak256("BTC");
    bytes32 constant USD_ASSET = keccak256("USD");
    bytes32 constant ETH_USD_EIGHT_DECIMALS = keccak256("ETH/USD/8");

    uint256 constant MAX_STALENESS = 1 hours;

    address internal updater = address(0xFEED);

    function setUp() public {
        oracle = new PriceOracle();
        oracle.registerFeed(ETH_USD, "ETH/USD", MAX_STALENESS, ETH_ASSET, USD_ASSET, 18);
        oracle.registerFeed(BTC_USD, "BTC/USD", MAX_STALENESS, BTC_ASSET, USD_ASSET, 18);
        oracle.registerFeed(FALLBACK, "ETH/USD Fallback", MAX_STALENESS, ETH_ASSET, USD_ASSET, 18);

        oracle.setUpdater(ETH_USD, updater, true);
    }

    // ── Registration ───────────────────────────────────────────────────────────

    function test_registerFeed_storesMetadata() public {
        PriceOracle.FeedData memory f = oracle.getFeedInfo(ETH_USD);
        assertEq(f.description, "ETH/USD");
        assertEq(f.baseAsset, ETH_ASSET);
        assertEq(f.quoteAsset, USD_ASSET);
        assertEq(uint256(f.decimals), 18);
        assertEq(f.maxStaleness, MAX_STALENESS);
        assertTrue(f.active);
    }

    function test_registerFeed_initializesObservationState() public view {
        PriceOracle.FeedData memory feed = oracle.getFeedInfo(ETH_USD);
        assertEq(feed.price, 0);
        assertEq(feed.updatedAt, 0);
        assertEq(feed.roundId, 0);
        assertEq(feed.receivedAt, 0);
    }

    function test_registerFeedWithMetadata_revertsOnZeroFeedId() public {
        vm.expectRevert(PriceOracle.ZeroFeedId.selector);
        oracle.registerFeed(bytes32(0), "Reserved", MAX_STALENESS, ETH_ASSET, USD_ASSET, 18);
    }

    function test_updatePrice_compatibilityOverloadAdvancesRound() public {
        oracle.updatePrice(ETH_USD, 2000e18);
        vm.warp(block.timestamp + 1);
        oracle.updatePrice(ETH_USD, 2100e18);
        PriceOracle.FeedData memory feed = oracle.getFeedInfo(ETH_USD);
        assertEq(feed.roundId, 2);
        assertEq(feed.updatedAt, block.timestamp);
        assertEq(feed.receivedAt, block.timestamp);
        assertEq(feed.price, 2100e18);
    }

    function test_setFallback_revertsForDifferentAsset() public {
        vm.expectRevert(PriceOracle.IncompatibleFallback.selector);
        oracle.setFallback(ETH_USD, BTC_USD);
    }

    function test_setFallback_revertsForDifferentDecimals() public {
        oracle.registerFeed(
            ETH_USD_EIGHT_DECIMALS,
            "ETH/USD (8 decimals)",
            MAX_STALENESS,
            ETH_ASSET,
            USD_ASSET,
            8
        );

        vm.expectRevert(PriceOracle.IncompatibleFallback.selector);
        oracle.setFallback(ETH_USD, ETH_USD_EIGHT_DECIMALS);
    }

    function test_setFallback_revertsWhenMetadataIsMissing() public {
        bytes32 legacyFeed = keccak256("LEGACY");
        oracle.registerFeed(legacyFeed, "Legacy", MAX_STALENESS);

        vm.expectRevert(PriceOracle.FeedMetadataMissing.selector);
        oracle.setFallback(ETH_USD, legacyFeed);
    }

    function test_registerFeedWithMetadata_revertsOnZeroAssetIdentity() public {
        vm.expectRevert(PriceOracle.InvalidFeedMetadata.selector);
        oracle.registerFeed(
            keccak256("INVALID"),
            "Invalid",
            MAX_STALENESS,
            bytes32(0),
            USD_ASSET,
            18
        );
    }

    function test_registerFeed_revertsOnDuplicate() public {
        vm.expectRevert(PriceOracle.FeedAlreadyRegistered.selector);
        oracle.registerFeed(ETH_USD, "ETH/USD", MAX_STALENESS);
    }

    function test_registerFeed_revertsOnZeroFeedId() public {
        vm.expectRevert(PriceOracle.ZeroFeedId.selector);
        oracle.registerFeed(bytes32(0), "Reserved zero feed", MAX_STALENESS);
    }

    function test_setFallback_revertsWhenFallbackFeedIdIsZero() public {
        vm.expectRevert(PriceOracle.ZeroFeedId.selector);
        oracle.setFallback(ETH_USD, bytes32(0));
    }

    function test_setFallback_revertsWhenPrimaryFeedIdIsZero() public {
        vm.expectRevert(PriceOracle.ZeroFeedId.selector);
        oracle.setFallback(bytes32(0), ETH_USD);
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
        _updatePrice(ETH_USD, 2000e18, 1);
        (int256 price, uint256 updatedAt) = oracle.getRawPrice(ETH_USD);
        assertEq(price, 2000e18);
        assertEq(updatedAt, block.timestamp);

        PriceOracle.FeedData memory f = oracle.getFeedInfo(ETH_USD);
        assertEq(f.roundId, 1);
        assertEq(f.receivedAt, block.timestamp);
    }

    function test_updatePrice_revertsNegativePrice() public {
        vm.expectRevert(PriceOracle.InvalidPrice.selector);
        _updatePrice(ETH_USD, -1, 1);
    }

    function test_updatePrice_revertsZeroPrice() public {
        vm.expectRevert(PriceOracle.InvalidPrice.selector);
        _updatePrice(ETH_USD, 0, 1);
    }

    function test_updatePrice_byAuthorizedUpdater() public {
        vm.prank(updater);
        oracle.updatePrice(ETH_USD, 1800e18, block.timestamp, 1);
        (int256 price,) = oracle.getRawPrice(ETH_USD);
        assertEq(price, 1800e18);
    }

    function test_isUpdater_permissionsAreFeedScoped() public view {
        assertTrue(oracle.isUpdater(ETH_USD, updater));
        assertFalse(oracle.isUpdater(BTC_USD, updater));
    }

    function test_updatePrice_updaterCannotUpdateOtherFeed() public {
        vm.prank(updater);
        vm.expectRevert(PriceOracle.NotAuthorizedUpdater.selector);
        oracle.updatePrice(BTC_USD, 1800e18);
    }

    function test_updatePrice_revokedUpdaterCannotUpdateFeed() public {
        oracle.setUpdater(ETH_USD, updater, false);

        vm.prank(updater);
        vm.expectRevert(PriceOracle.NotAuthorizedUpdater.selector);
        oracle.updatePrice(ETH_USD, 1800e18);
    }

    function test_updatePrice_ownerCanUpdateAnyFeedAsEmergencyAuthority() public {
        oracle.updatePrice(BTC_USD, 1800e18);
        (int256 price,) = oracle.getRawPrice(BTC_USD);
        assertEq(price, 1800e18);
    }

    function test_setUpdater_emitsFeedScopedPermissionEvent() public {
        vm.expectEmit(true, true, false, true);
        emit UpdaterSet(ETH_USD, updater, false);
        oracle.setUpdater(ETH_USD, updater, false);
    }

    function test_setUpdater_revertsForZeroAddress() public {
        vm.expectRevert(PriceOracle.ZeroAddress.selector);
        oracle.setUpdater(ETH_USD, address(0), true);
    }

    function test_updatePrice_revertsUnauthorized() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(PriceOracle.NotAuthorizedUpdater.selector);
        oracle.updatePrice(ETH_USD, 1000e18, block.timestamp, 1);
    }

    function test_updatePrice_revertsOldObservationAfterLaterPush() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        vm.warp(block.timestamp + MAX_STALENESS + 1);

        vm.expectRevert(PriceOracle.SourceTimestampNotIncreasing.selector);
        oracle.updatePrice(ETH_USD, 2100e18, block.timestamp - MAX_STALENESS - 1, 2);
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    function test_updatePrice_revertsRepeatedRound() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        vm.warp(block.timestamp + 1);

        vm.expectRevert(PriceOracle.RoundIdNotIncreasing.selector);
        oracle.updatePrice(ETH_USD, 2100e18, block.timestamp, 1);
    }

    function test_updatePrice_revertsFutureSourceTimestamp() public {
        vm.expectRevert(PriceOracle.FutureTimestamp.selector);
        oracle.updatePrice(ETH_USD, 2000e18, block.timestamp + 1, 1);
    }

    function test_updatePrice_revertsZeroSourceTimestamp() public {
        vm.expectRevert(PriceOracle.InvalidTimestamp.selector);
        oracle.updatePrice(ETH_USD, 2000e18, 0, 1);
    }

    function test_updatePrice_acceptsFreshMonotonicObservation() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        vm.warp(block.timestamp + 1);

        _updatePrice(ETH_USD, 2100e18, 2);

        (int256 price, uint256 updatedAt) = oracle.getPrice(ETH_USD);
        assertEq(price, 2100e18);
        assertEq(updatedAt, block.timestamp);
    }

    // ── Price queries ──────────────────────────────────────────────────────────

    function test_getPrice_returnsFreshPrice() public {
        _updatePrice(ETH_USD, 2500e18, 1);
        (int256 price, uint256 ts) = oracle.getPrice(ETH_USD);
        assertEq(price, 2500e18);
        assertEq(ts, block.timestamp);
    }

    function test_getPrice_revertsOnStalePrice() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        vm.expectRevert(PriceOracle.NoValidPrice.selector);
        oracle.getPrice(ETH_USD);
    }

    function test_getPrice_usesFallbackWhenPrimaryStale() public {
        oracle.setFallback(ETH_USD, FALLBACK);
        _updatePrice(ETH_USD, 2000e18, 1);
        _updatePrice(FALLBACK, 1999e18, 1);

        // Stale the primary
        vm.warp(block.timestamp + MAX_STALENESS + 1);

        // Update fallback to be fresh
        _updatePrice(FALLBACK, 1999e18, 2);

        (int256 price,) = oracle.getPrice(ETH_USD);
        assertEq(price, 1999e18);
    }

    function test_getPrice_revertsWhenBothStale() public {
        oracle.setFallback(ETH_USD, FALLBACK);
        _updatePrice(ETH_USD, 2000e18, 1);
        _updatePrice(FALLBACK, 1999e18, 1);

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
        _updatePrice(ETH_USD, 2000e18, 1);
        assertTrue(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenStale() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenNeverUpdated() public {
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    function test_isFeedHealthy_falseWhenDeactivated() public {
        _updatePrice(ETH_USD, 2000e18, 1);
        oracle.deactivateFeed(ETH_USD);
        assertFalse(oracle.isFeedHealthy(ETH_USD));
    }

    // ── Fuzz ───────────────────────────────────────────────────────────────────

    function testFuzz_updateAndGetPrice(int128 rawPrice) public {
        vm.assume(rawPrice > 0);
        _updatePrice(ETH_USD, int256(rawPrice), 1);
        (int256 price,) = oracle.getPrice(ETH_USD);
        assertEq(price, int256(rawPrice));
    }

    function _updatePrice(bytes32 feedId, int256 price, uint80 roundId) private {
        oracle.updatePrice(feedId, price, block.timestamp, roundId);
    }
}
