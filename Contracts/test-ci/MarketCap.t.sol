// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketCap.sol";

contract MarketCapTest is Test {
    MarketCap internal marketCap;
    address internal owner = address(this);
    address internal alice = address(0xA11CE);

    uint256 constant PRICE_1 = 1e18;
    uint256 constant PRICE_2 = 2e18;
    uint256 constant PRICE_HALF = 5e17;
    uint256 constant SUPPLY_1000 = 1000e18;
    uint256 constant SUPPLY_500 = 500e18;
    uint256 constant CAP_LIMIT = 5000e18;

    event MarketCapCalculated(
        uint256 indexed marketId,
        uint256 currentCap,
        uint256 previousCap,
        uint256 change,
        uint256 timestamp
    );

    event MarketCapUpdated(uint256 indexed marketId, uint256 newCap, uint256 price, uint256 supply);

    event CapLimitSet(uint256 indexed marketId, uint256 capLimit);

    function setUp() public {
        marketCap = new MarketCap();
    }

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

    function test_marketExists() public {
        assertFalse(marketCap.marketExists(1));
        marketCap.calculateMarketCap(1, PRICE_1, SUPPLY_1000);
        assertTrue(marketCap.marketExists(1));
    }
}
