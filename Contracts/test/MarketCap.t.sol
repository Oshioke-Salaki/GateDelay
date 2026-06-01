// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketCap.sol";

contract MarketCapTest is Test {
    MarketCap internal marketCap;
    address internal owner = address(this);
    address internal alice = address(0xA11CE);

    // Test constants (18 decimals)
    uint256 constant PRICE_1 = 1e18;      // $1.00
    uint256 constant PRICE_2 = 2e18;      // $2.00
    uint256 constant PRICE_HALF = 5e17;   // $0.50
    uint256 constant SUPPLY_1000 = 1000e18;
    uint256 constant SUPPLY_500 = 500e18;
    uint256 constant CAP_LIMIT = 5000e18;

    // Events
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

    function setUp() public {
        marketCap = new MarketCap();
    }

    // =========================================================================
    // Core Tests - Calculate Market Cap
    // =========================================================================

    function test_calculateMarketCap_success() public {
        uint256 marketId = 1;
        uint256 expectedCap = PRICE_1 * SUPPLY_1000 / 1e18;

        uint256 cap = marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        assertEq(cap, expectedCap, "Market cap should be price * supply");
    }

    function test_calculateMarketCap_emitsEvent() public {
        uint256 marketId = 1;
        uint256 expectedCap = PRICE_1 * SUPPLY_1000 / 1e18;

        vm.expectEmit(true, false, false, true);
        emit MarketCapCalculated(marketId, expectedCap, 0, 0, block.timestamp);

        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
    }

    function test_calculateMarketCap_revertsZeroMarketId() public {
        vm.expectRevert(MarketCap.ZeroMarketId.selector);
        marketCap.calculateMarketCap(0, PRICE_1, SUPPLY_1000);
    }

    function test_calculateMarketCap_revertsZeroPrice() public {
        vm.expectRevert(MarketCap.ZeroPrice.selector);
        marketCap.calculateMarketCap(1, 0, SUPPLY_1000);
    }

    function test_calculateMarketCap_revertsZeroSupply() public {
        vm.expectRevert(MarketCap.ZeroSupply.selector);
        marketCap.calculateMarketCap(1, PRICE_1, 0);
    }

    function test_calculateMarketCap_tracksChanges() public {
        uint256 marketId = 1;

        uint256 cap1 = marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        uint256 cap2 = marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);

        (uint256 currentCap, uint256 previousCap,,,,) = marketCap.getMarketCap(marketId);

        assertEq(currentCap, cap2);
        assertEq(previousCap, cap1);
        assertTrue(cap2 > cap1);
    }

    // =========================================================================
    // Cap Limits
    // =========================================================================

    function test_setCapLimit_success() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);

        vm.expectEmit(true, false, false, true);
        emit CapLimitSet(marketId, CAP_LIMIT);

        marketCap.setCapLimit(marketId, CAP_LIMIT);

        (,, uint256 capLimit,,,) = marketCap.getMarketCap(marketId);
        assertEq(capLimit, CAP_LIMIT);
    }

    function test_setCapLimit_revertsNonOwner() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);

        vm.prank(alice);
        vm.expectRevert();
        marketCap.setCapLimit(marketId, CAP_LIMIT);
    }

    function test_calculateMarketCap_revertsCapLimitExceeded() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);
        marketCap.setCapLimit(marketId, CAP_LIMIT);

        vm.expectRevert(MarketCap.CapLimitExceeded.selector);
        marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000 * 10);
    }

    // =========================================================================
    // Update Market Cap
    // =========================================================================

    function test_updateMarketCap_success() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);

        vm.expectEmit(true, false, false, true);
        emit MarketCapUpdated(marketId, PRICE_2 * SUPPLY_500 / 1e18, PRICE_2, SUPPLY_500);

        marketCap.updateMarketCap(marketId, PRICE_2, SUPPLY_500);
    }

    function test_updateMarketCap_revertsMarketNotFound() public {
        vm.expectRevert(MarketCap.MarketNotFound.selector);
        marketCap.updateMarketCap(999, PRICE_1, SUPPLY_1000);
    }

    // =========================================================================
    // Queries
    // =========================================================================

    function test_getMarketCap_returnsCorrectData() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);

        (
            uint256 currentCap,
            uint256 previousCap,
            uint256 capLimit,
            uint256 totalSupply,
            uint256 price,
            uint256 lastUpdateTime
        ) = marketCap.getMarketCap(marketId);

        assertEq(currentCap, PRICE_1 * SUPPLY_1000 / 1e18);
        assertEq(previousCap, 0);
        assertEq(capLimit, 0);
        assertEq(totalSupply, SUPPLY_1000);
        assertEq(price, PRICE_1);
        assertEq(lastUpdateTime, block.timestamp);
    }

    function test_getCapChange() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);

        (uint256 change, bool isIncrease) = marketCap.getCapChange(marketId);

        assertTrue(isIncrease);
        assertGt(change, 0);
    }

    function test_getAllMarketIds() public {
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(2, PRICE_2, SUPPLY_500);

        uint256[] memory ids = marketCap.getAllMarketIds();
        assertEq(ids.length, 2);
    }

    function test_marketExists() public {
        assertFalse(marketCap.marketExists(1));
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        assertTrue(marketCap.marketExists(1));
    }

    function test_calculateCap_pureFunction() public {
        uint256 cap = marketCap.calculateCap(PRICE_2, SUPPLY_1000);
        uint256 expected = PRICE_2 * SUPPLY_1000 / 1e18;
        assertEq(cap, expected);
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_integration_fullWorkflow() public {
        uint256 marketId = 1;

        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        marketCap.setCapLimit(marketId, CAP_LIMIT);
        marketCap.updateMarketCap(marketId, PRICE_2, SUPPLY_1000);

        (uint256 currentCap,,,,,) = marketCap.getMarketCap(marketId);
        assertGt(currentCap, 0);

        (uint256 change, bool isIncrease) = marketCap.getCapChange(marketId);
        assertTrue(isIncrease);
    }

    function test_integration_multipleMarkets() public {
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(2, PRICE_2, SUPPLY_500);
        marketCap.calculateMarketCap(3, PRICE_HALF, SUPPLY_1000);

        assertEq(marketCap.getMarketCount(), 3);
        assertEq(marketCap.getAllMarketIds().length, 3);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_calculateMarketCap_validParams(
        uint256 marketId,
        uint256 price,
        uint256 supply
    ) public {
        vm.assume(marketId > 0 && marketId < type(uint128).max);
        vm.assume(price > 0 && price < 1e24);
        vm.assume(supply > 0 && supply < 1e24);

        uint256 cap = marketCap.calculateMarketCap(marketId, price, supply);
        assertTrue(cap > 0);
        assertTrue(marketCap.marketExists(marketId));
    }
}