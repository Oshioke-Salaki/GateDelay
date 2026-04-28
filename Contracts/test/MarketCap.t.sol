// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketCap.sol";

contract MarketCapTest is Test {
    MarketCap internal marketCap;

    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    // Test constants (18 decimals)
    uint256 constant PRICE_1 = 1e18;           // 1.0
    uint256 constant PRICE_2 = 2e18;           // 2.0
    uint256 constant PRICE_HALF = 5e17;        // 0.5
    uint256 constant SUPPLY_1000 = 1000e18;    // 1000 tokens
    uint256 constant SUPPLY_500 = 500e18;      // 500 tokens
    uint256 constant CAP_LIMIT = 5000e18;      // 5000 cap limit

    // Events
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

    function setUp() public {
        marketCap = new MarketCap();
    }

    // =========================================================================
    // Unit tests - Calculate Market Cap
    // =========================================================================

    function test_calculateMarketCap_success() public {
        uint256 marketId = 1;
        uint256 expectedCap = PRICE_1 * SUPPLY_1000 / 1e18;

        uint256 cap = marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        assertEq(cap, expectedCap, "Cap should equal price * supply");
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
        
        // First calculation
        uint256 cap1 = marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        // Second calculation with higher price
        uint256 cap2 = marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);
        
        assertTrue(cap2 > cap1, "Second cap should be higher");
        
        (uint256 currentCap, uint256 previousCap,,,, ) = marketCap.getMarketCap(marketId);
        assertEq(currentCap, cap2, "Current cap should match second calculation");
        assertEq(previousCap, cap1, "Previous cap should match first calculation");
    }

    // =========================================================================
    // Unit tests - Cap Limits
    // =========================================================================

    function test_setCapLimit_success() public {
        uint256 marketId = 1;
        
        // Initialize market
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);
        
        // Set cap limit
        vm.expectEmit(true, false, false, true);
        emit CapLimitSet(marketId, CAP_LIMIT);
        
        marketCap.setCapLimit(marketId, CAP_LIMIT);
        
        (,, uint256 capLimit,,, ) = marketCap.getMarketCap(marketId);
        assertEq(capLimit, CAP_LIMIT, "Cap limit should be set");
    }

    function test_setCapLimit_revertsNonOwner() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);
        
        vm.prank(alice);
        vm.expectRevert();
        marketCap.setCapLimit(marketId, CAP_LIMIT);
    }

    function test_setCapLimit_revertsMarketNotFound() public {
        vm.expectRevert(MarketCap.MarketNotFound.selector);
        marketCap.setCapLimit(999, CAP_LIMIT);
    }

    function test_calculateMarketCap_revertsCapLimitExceeded() public {
        uint256 marketId = 1;
        
        // Initialize with low cap
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);
        
        // Set cap limit
        marketCap.setCapLimit(marketId, CAP_LIMIT);
        
        // Try to exceed limit
        vm.expectRevert(MarketCap.CapLimitExceeded.selector);
        marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000 * 10);
    }

    function test_capLimit_allowsWithinLimit() public {
        uint256 marketId = 1;
        
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_500);
        marketCap.setCapLimit(marketId, CAP_LIMIT);
        
        // Should succeed as it's within limit
        uint256 cap = marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);
        assertTrue(cap <= CAP_LIMIT, "Cap should be within limit");
    }

    // =========================================================================
    // Unit tests - Update Market Cap
    // =========================================================================

    function test_updateMarketCap_success() public {
        uint256 marketId = 1;
        
        // Initialize market
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        // Update
        vm.expectEmit(true, false, false, true);
        emit MarketCapUpdated(marketId, PRICE_2 * SUPPLY_500 / 1e18, PRICE_2, SUPPLY_500);
        
        marketCap.updateMarketCap(marketId, PRICE_2, SUPPLY_500);
        
        (uint256 currentCap,,,, uint256 price, ) = marketCap.getMarketCap(marketId);
        assertEq(price, PRICE_2, "Price should be updated");
        assertEq(currentCap, PRICE_2 * SUPPLY_500 / 1e18, "Cap should be updated");
    }

    function test_updateMarketCap_revertsMarketNotFound() public {
        vm.expectRevert(MarketCap.MarketNotFound.selector);
        marketCap.updateMarketCap(999, PRICE_1, SUPPLY_1000);
    }

    function test_updateMarketCap_revertsZeroPrice() public {
        uint256 marketId = 1;
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        vm.expectRevert(MarketCap.ZeroPrice.selector);
        marketCap.updateMarketCap(marketId, 0, SUPPLY_1000);
    }

    // =========================================================================
    // Unit tests - Queries
    // =========================================================================

    function test_getMarketCap_returnsCorrectData() public {
        uint256 marketId = 1;
        uint256 expectedCap = PRICE_1 * SUPPLY_1000 / 1e18;
        
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        (
            uint256 currentCap,
            uint256 previousCap,
            uint256 capLimit,
            uint256 totalSupply,
            uint256 price,
            uint256 lastUpdateTime
        ) = marketCap.getMarketCap(marketId);
        
        assertEq(currentCap, expectedCap, "Current cap should match");
        assertEq(previousCap, 0, "Previous cap should be 0 initially");
        assertEq(capLimit, 0, "Cap limit should be 0 by default");
        assertEq(totalSupply, SUPPLY_1000, "Supply should match");
        assertEq(price, PRICE_1, "Price should match");
        assertEq(lastUpdateTime, block.timestamp, "Timestamp should match");
    }

    function test_getCapChange_increase() public {
        uint256 marketId = 1;
        
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);
        
        (uint256 change, bool isIncrease) = marketCap.getCapChange(marketId);
        
        assertTrue(isIncrease, "Should be an increase");
        assertEq(change, SUPPLY_1000, "Change should equal supply (price doubled)");
    }

    function test_getCapChange_decrease() public {
        uint256 marketId = 1;
        
        marketCap.calculateMarketCap(marketId, PRICE_2, SUPPLY_1000);
        marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        
        (uint256 change, bool isIncrease) = marketCap.getCapChange(marketId);
        
        assertFalse(isIncrease, "Should be a decrease");
        assertEq(change, SUPPLY_1000, "Change should equal supply (price halved)");
    }

    function test_getAllMarketIds() public {
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(2, PRICE_2, SUPPLY_500);
        marketCap.calculateMarketCap(3, PRICE_HALF, SUPPLY_1000);
        
        uint256[] memory ids = marketCap.getAllMarketIds();
        
        assertEq(ids.length, 3, "Should have 3 markets");
        assertEq(ids[0], 1, "First market ID should be 1");
        assertEq(ids[1], 2, "Second market ID should be 2");
        assertEq(ids[2], 3, "Third market ID should be 3");
    }

    function test_marketExists() public {
        assertFalse(marketCap.marketExists(1), "Market should not exist initially");
        
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        
        assertTrue(marketCap.marketExists(1), "Market should exist after calculation");
        assertFalse(marketCap.marketExists(2), "Market 2 should not exist");
    }

    function test_getMarketCount() public {
        assertEq(marketCap.getMarketCount(), 0, "Should start with 0 markets");
        
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        assertEq(marketCap.getMarketCount(), 1, "Should have 1 market");
        
        marketCap.calculateMarketCap(2, PRICE_2, SUPPLY_500);
        assertEq(marketCap.getMarketCount(), 2, "Should have 2 markets");
    }

    function test_calculateCap_pureFunction() public {
        uint256 cap = marketCap.calculateCap(PRICE_2, SUPPLY_1000);
        uint256 expectedCap = PRICE_2 * SUPPLY_1000 / 1e18;
        
        assertEq(cap, expectedCap, "Pure calculation should work");
    }

    // =========================================================================
    // Property-based fuzz tests
    // =========================================================================

    function testFuzz_calculateMarketCap_validParams(
        uint256 marketId,
        uint256 price,
        uint256 supply
    ) public {
        vm.assume(marketId > 0 && marketId < type(uint128).max);
        vm.assume(price > 0 && price < type(uint128).max);
        vm.assume(supply > 0 && supply < type(uint128).max);
        
        uint256 cap = marketCap.calculateMarketCap(marketId, price, supply);
        
        assertTrue(cap > 0, "Cap should be positive");
        assertTrue(marketCap.marketExists(marketId), "Market should exist");
    }

    function testFuzz_capLimit_enforcement(
        uint256 marketId,
        uint256 price,
        uint256 supply,
        uint256 limit
    ) public {
        vm.assume(marketId > 0 && marketId < type(uint64).max);
        vm.assume(price > 0 && price < 1e24);
        vm.assume(supply > 0 && supply < 1e24);
        vm.assume(limit > 0 && limit < type(uint128).max);
        
        // Calculate initial cap
        uint256 cap = marketCap.calculateMarketCap(marketId, price, supply);
        
        if (cap < limit) {
            // Set limit above current cap
            marketCap.setCapLimit(marketId, limit);
            
            // Should succeed
            marketCap.calculateMarketCap(marketId, price, supply);
        }
    }

    function testFuzz_calculateCap_pure(
        uint256 price,
        uint256 supply
    ) public {
        vm.assume(price > 0 && price < type(uint128).max);
        vm.assume(supply > 0 && supply < type(uint128).max);
        
        uint256 cap = marketCap.calculateCap(price, supply);
        assertTrue(cap > 0, "Cap should be positive");
    }

    // =========================================================================
    // Integration tests
    // =========================================================================

    function test_integration_fullWorkflow() public {
        uint256 marketId = 1;
        
        // Step 1: Calculate initial cap
        uint256 cap1 = marketCap.calculateMarketCap(marketId, PRICE_1, SUPPLY_1000);
        assertEq(cap1, SUPPLY_1000, "Initial cap should be 1000");
        
        // Step 2: Set cap limit
        marketCap.setCapLimit(marketId, CAP_LIMIT);
        
        // Step 3: Update within limit
        marketCap.updateMarketCap(marketId, PRICE_2, SUPPLY_1000);
        (uint256 currentCap,,,,,) = marketCap.getMarketCap(marketId);
        assertEq(currentCap, PRICE_2 * SUPPLY_1000 / 1e18, "Cap should be updated");
        
        // Step 4: Check change tracking
        (uint256 change, bool isIncrease) = marketCap.getCapChange(marketId);
        assertTrue(isIncrease, "Should show increase");
        assertGt(change, 0, "Change should be positive");
        
        // Step 5: Verify market exists
        assertTrue(marketCap.marketExists(marketId), "Market should exist");
        assertEq(marketCap.getMarketCount(), 1, "Should have 1 market");
    }

    function test_integration_multipleMarkets() public {
        // Create multiple markets
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        marketCap.calculateMarketCap(2, PRICE_2, SUPPLY_500);
        marketCap.calculateMarketCap(3, PRICE_HALF, SUPPLY_1000);
        
        // Verify all exist
        assertEq(marketCap.getMarketCount(), 3, "Should have 3 markets");
        
        uint256[] memory ids = marketCap.getAllMarketIds();
        assertEq(ids.length, 3, "Should return 3 IDs");
        
        // Update each market
        marketCap.updateMarketCap(1, PRICE_2, SUPPLY_1000);
        marketCap.updateMarketCap(2, PRICE_1, SUPPLY_500);
        marketCap.updateMarketCap(3, PRICE_1, SUPPLY_1000);
        
        // Verify updates
        (uint256 cap1,,,,,) = marketCap.getMarketCap(1);
        (uint256 cap2,,,,,) = marketCap.getMarketCap(2);
        (uint256 cap3,,,,,) = marketCap.getMarketCap(3);
        
        assertGt(cap1, 0, "Market 1 cap should be positive");
        assertGt(cap2, 0, "Market 2 cap should be positive");
        assertGt(cap3, 0, "Market 3 cap should be positive");
    }
}
