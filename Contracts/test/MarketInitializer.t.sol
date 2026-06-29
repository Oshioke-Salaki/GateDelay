// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketInitializer.sol";

contract MarketInitializerTest is Test {
    MarketInitializer initializer;
    address market = address(0x1);
    address collateralToken = address(0x2);
    address creator = address(0x3);
    uint256 resolutionDeadline;
    uint256 minLiquidity = 1000e18;
    string metadataURI = "ipfs://QmTest";

    function setUp() public {
        initializer = new MarketInitializer();
        resolutionDeadline = block.timestamp + 30 days;
    }

    function _getValidParams()
        internal
        view
        returns (MarketInitializer.MarketParameters memory)
    {
        return MarketInitializer.MarketParameters({
            collateralToken: collateralToken,
            resolutionDeadline: resolutionDeadline,
            minLiquidity: minLiquidity,
            metadataURI: metadataURI,
            initialLiquidity: 5000e18
        });
    }

    function test_InitializeMarket() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        assertTrue(initializer.isInitialized(market));
        assertEq(
            uint256(initializer.getMarketStatus(market)),
            uint256(MarketInitializer.MarketStatus.INITIALIZED)
        );
    }

    function test_CannotReinitializeMarket() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        vm.prank(creator);
        vm.expectRevert(MarketInitializer.AlreadyInitialized.selector);
        initializer.initializeMarket(market, params);
    }

    function test_CannotInitializeWithZeroCollateral() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();
        params.collateralToken = address(0);

        vm.prank(creator);
        vm.expectRevert(MarketInitializer.ZeroCollateralToken.selector);
        initializer.initializeMarket(market, params);
    }

    function test_CannotInitializeWithInvalidDeadline() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();
        params.resolutionDeadline = block.timestamp - 1;

        vm.prank(creator);
        vm.expectRevert(MarketInitializer.InvalidDeadline.selector);
        initializer.initializeMarket(market, params);
    }

    function test_CannotInitializeWithZeroMinLiquidity() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();
        params.minLiquidity = 0;

        vm.prank(creator);
        vm.expectRevert(MarketInitializer.ZeroMinLiquidity.selector);
        initializer.initializeMarket(market, params);
    }

    function test_CannotInitializeWithEmptyMetadataURI() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();
        params.metadataURI = "";

        vm.prank(creator);
        vm.expectRevert(MarketInitializer.EmptyMetadataURI.selector);
        initializer.initializeMarket(market, params);
    }

    function test_ActivateMarket() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        vm.prank(creator);
        initializer.activateMarket(market);

        assertEq(
            uint256(initializer.getMarketStatus(market)),
            uint256(MarketInitializer.MarketStatus.ACTIVE)
        );
    }

    function test_SetMarketLiquidity() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        uint256 liquidity = 10000e18;
        initializer.setMarketLiquidity(market, liquidity);

        MarketInitializer.MarketState memory state = initializer.getMarketState(market);
        assertEq(state.totalLiquidity, liquidity);
    }

    function test_GetMarketParameters() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        MarketInitializer.MarketParameters memory retrieved =
            initializer.getMarketParameters(market);
        assertEq(retrieved.collateralToken, collateralToken);
        assertEq(retrieved.resolutionDeadline, resolutionDeadline);
        assertEq(retrieved.minLiquidity, minLiquidity);
    }

    function test_GetInitializationTimestamp() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        uint256 timestamp = initializer.getInitializationTimestamp(market);
        assertEq(timestamp, block.timestamp);
    }

    function test_GetInitializedMarkets() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        address[] memory markets = initializer.getInitializedMarkets();
        assertEq(markets.length, 1);
        assertEq(markets[0], market);
    }

    function test_ValidateParameters() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();
        assertTrue(initializer.validateParameters(params));
    }

    function test_GetInitializedMarketCount() public {
        MarketInitializer.MarketParameters memory params = _getValidParams();

        vm.prank(creator);
        initializer.initializeMarket(market, params);

        assertEq(initializer.getInitializedMarketCount(), 1);
    }
}
