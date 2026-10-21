// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/PositionToken.sol";
import "../src/ERC20Token.sol";
import "../src/PredictionMarket.sol";

contract MarketFactoryTest is Test {
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline
    );
    event MarketActivated(address indexed market, uint256 liquidity);

    PositionToken internal positionToken;
    MarketFactory internal factory;
    ERC20Token internal collateral;

    address internal alice = address(0xA11CE);
    address internal validToken;

    function setUp() public {
        uint256 factoryNonce = vm.getNonce(address(this)) + 1;
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));
        collateral = new ERC20Token(0);
        validToken = address(collateral);
        factory.setSupportedCollateral(validToken, true);
    }

    function test_constructor_revertsWithZeroPositionToken() public {
        vm.expectRevert(MarketFactory.ZeroPositionToken.selector);
        new MarketFactory(address(0));
    }

    function test_constructor_revertsWithInvalidPositionToken() public {
        vm.expectRevert(MarketFactory.InvalidPositionToken.selector);
        new MarketFactory(address(1));
    }

    function test_createMarket_revertsZeroCollateralToken() public {
        vm.expectRevert(MarketFactory.ZeroCollateralToken.selector);
        factory.createMarket(address(0), block.timestamp + 1 days, 1 ether, "ipfs://meta");
    }

    function test_createMarket_revertsInvalidDeadline_equal() public {
        vm.expectRevert(MarketFactory.InvalidDeadline.selector);
        factory.createMarket(validToken, block.timestamp, 1 ether, "ipfs://meta");
    }

    function test_createMarket_revertsInvalidDeadline_past() public {
        vm.warp(1000);
        vm.expectRevert(MarketFactory.InvalidDeadline.selector);
        factory.createMarket(validToken, 999, 1 ether, "ipfs://meta");
    }

    function test_createMarket_revertsZeroMinLiquidity() public {
        vm.expectRevert(MarketFactory.ZeroMinLiquidity.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 0, "ipfs://meta");
    }

    function test_createMarket_revertsEmptyMetadataURI() public {
        vm.expectRevert(MarketFactory.EmptyMetadataURI.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "");
    }

    function test_createMarket_revertsEOACollateral() public {
        address eoa = address(0xBEEF);
        vm.expectRevert(MarketFactory.InvalidCollateralToken.selector);
        factory.setSupportedCollateral(eoa, true);
    }

    function test_createMarket_revertsUnsupportedCollateral() public {
        ERC20Token other = new ERC20Token(0);
        vm.expectRevert(MarketFactory.UnsupportedCollateral.selector);
        factory.createMarket(address(other), block.timestamp + 1 days, 1 ether, "ipfs://meta");
    }

    function test_createMarket_revertsNonTokenContract() public {
        vm.expectRevert(MarketFactory.InvalidCollateralToken.selector);
        factory.setSupportedCollateral(address(factory), true);
    }

    function test_createMarket_returnsNonZeroAddress() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        assertTrue(market != address(0));
        assertEq(factory.marketCount(), 1);
        assertEq(factory.marketAt(0), market);
        assertTrue(positionToken.isAuthorised(market));
        assertTrue(market.code.length > 0);
    }

    function test_constructor_revertsForZeroPositionToken() public {
        vm.expectRevert(MarketFactory.ZeroPositionToken.selector);
        new MarketFactory(address(0));
    }

    function test_createMarket_registersAndAuthorisesMarket() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        address[] memory markets = factory.getMarkets();

        assertEq(factory.getMarketCount(), 1);
        assertEq(factory.getMarketAt(0), market);
        assertEq(markets.length, 1);
        assertEq(markets[0], market);
        assertTrue(factory.isRegisteredMarket(market));
        assertTrue(positionToken.isAuthorised(market));
    }

    function test_createMarket_registersCreator() public {
        vm.prank(alice);
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        assertEq(factory.getCreator(market), alice);
    }

    function test_getCreator_returnsZeroForUnregistered() public {
        assertEq(factory.getCreator(address(0xDEAD)), address(0));
    }

    function test_createMarket_initialStatusIsPending() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        MarketFactory.MarketInfo memory info = factory.getMarketInfo(market);
        assertEq(uint256(info.status), uint256(MarketFactory.MarketStatus.PENDING));
        assertEq(uint256(PredictionMarket(payable(market)).state()), uint256(PredictionMarket.MarketState.PENDING));
    }

    function test_createMarket_emitsMarketCreated() public {
        uint256 timestamp = 1000000;
        vm.warp(timestamp);

        uint256 deadline = timestamp + 1 days;
        address predicted =
            factory.computeMarketAddress(address(this), timestamp, 0, validToken, deadline, 1 ether, "ipfs://meta");

        vm.expectEmit(true, true, true, true);
        emit MarketCreated(predicted, address(this), validToken, deadline);
        factory.createMarket(validToken, deadline, 1 ether, "ipfs://meta");
    }

    function test_getMarketInfo_correctFields() public {
        uint256 deadline = block.timestamp + 2 days;
        uint256 minLiq = 5 ether;
        string memory uri = "ipfs://QmTest";

        vm.prank(alice);
        address market = factory.createMarket(validToken, deadline, minLiq, uri);

        MarketFactory.MarketInfo memory info = factory.getMarketInfo(market);
        assertEq(info.creator, alice);
        assertEq(info.collateralToken, validToken);
        assertEq(info.resolutionDeadline, deadline);
        assertEq(info.minLiquidity, minLiq);
        assertEq(info.metadataURI, uri);
        assertEq(uint256(info.status), uint256(MarketFactory.MarketStatus.PENDING));
    }

    function test_deterministicMarketId_differentListIndexYieldsDifferentAddress() public {
        uint256 deadline = block.timestamp + 1 days;

        address m1 = factory.createMarket(validToken, deadline, 1 ether, "ipfs://FL001");
        address m2 = factory.createMarket(validToken, deadline, 1 ether, "ipfs://FL001");

        assertTrue(m1 != m2, "two markets from same sender must have different IDs");
        assertEq(factory.marketCount(), 2);
        assertTrue(factory.isRegisteredMarket(m1));
        assertTrue(factory.isRegisteredMarket(m2));
    }

    function test_duplicateFlightMarket_sameUriProducesTwoDistinctMarkets() public {
        uint256 deadline = block.timestamp + 1 days;
        string memory flightURI = "ipfs://AA101_JFK_LAX_20260101";

        address mA = factory.createMarket(validToken, deadline, 1 ether, flightURI);
        address mB = factory.createMarket(validToken, deadline, 1 ether, flightURI);

        assertTrue(mA != mB, "duplicate-flight markets must get distinct addresses");
        assertEq(factory.getMarketInfo(mA).metadataURI, flightURI);
        assertEq(factory.getMarketInfo(mB).metadataURI, flightURI);
        assertEq(factory.marketCount(), 2);
    }

    function test_invalidFlightData_zeroCollateralTokenReverts() public {
        vm.expectRevert(MarketFactory.ZeroCollateralToken.selector);
        factory.createMarket(address(0), block.timestamp + 1 days, 1 ether, "ipfs://FL");
    }

    function test_invalidFlightData_pastDeadlineReverts() public {
        vm.warp(5000);
        vm.expectRevert(MarketFactory.InvalidDeadline.selector);
        factory.createMarket(validToken, 4999, 1 ether, "ipfs://FL");
    }

    function test_invalidFlightData_zeroMinLiquidityReverts() public {
        vm.expectRevert(MarketFactory.ZeroMinLiquidity.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 0, "ipfs://FL");
    }

    function test_invalidFlightData_emptyMetadataURIReverts() public {
        vm.expectRevert(MarketFactory.EmptyMetadataURI.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "");
    }

    function test_repeatedCreation_eachMarketIsUnique() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(alice);
        address m1 = factory.createMarket(validToken, deadline, 1 ether, "ipfs://M1");
        vm.prank(alice);
        address m2 = factory.createMarket(validToken, deadline, 1 ether, "ipfs://M2");
        vm.prank(alice);
        address m3 = factory.createMarket(validToken, deadline, 1 ether, "ipfs://M3");

        assertTrue(m1 != m2);
        assertTrue(m2 != m3);
        assertTrue(m1 != m3);
        assertEq(factory.marketCount(), 3);
        assertEq(factory.getCreator(m1), alice);
        assertEq(factory.getCreator(m2), alice);
        assertEq(factory.getCreator(m3), alice);
    }

    function test_createMarket_deploysActualContract() public {
        uint256 deadline = block.timestamp + 1 days;
        address market = factory.createMarket(validToken, deadline, 1 ether, "ipfs://test");
        assertTrue(market.code.length > 0, "Market contract should be deployed");
    }

    function test_computeMarketAddress() public {
        uint256 timestamp = 1000000;
        vm.warp(timestamp);

        uint256 deadline = timestamp + 1 days;
        uint256 minLiq = 1 ether;
        string memory uri = "ipfs://test";

        address predicted =
            factory.computeMarketAddress(address(this), timestamp, 0, validToken, deadline, minLiq, uri);
        address market = factory.createMarket(validToken, deadline, minLiq, uri);
        assertEq(market, predicted);
    }

    function testFuzz_createMarket_validParams(uint32 deadlineOffset, uint128 minLiquidity) public {
        vm.assume(deadlineOffset > 0);
        vm.assume(minLiquidity > 0);

        uint256 deadline = block.timestamp + uint256(deadlineOffset);
        string memory metadataURI = "ipfs://fuzz";

        vm.prank(alice);
        address market = factory.createMarket(validToken, deadline, uint256(minLiquidity), metadataURI);

        assertTrue(market != address(0), "market address must be non-zero");
        assertEq(factory.getCreator(market), alice, "creator must be the caller");
        assertTrue(market.code.length > 0, "market contract must be deployed");
    }

    function test_createMarket_revertsMetadataTooLong() public {
        bytes memory oversized = new bytes(factory.MAX_METADATA_URI_LENGTH() + 1);
        bytes memory prefix = bytes("ipfs://");
        for (uint256 i = 0; i < prefix.length; ++i) {
            oversized[i] = prefix[i];
        }
        for (uint256 i = prefix.length; i < oversized.length; ++i) {
            oversized[i] = "a";
        }
        vm.expectRevert(MarketFactory.MetadataURITooLong.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, string(oversized));
    }

    function test_createMarket_revertsUnsupportedMetadataScheme() public {
        vm.expectRevert(MarketFactory.UnsupportedMetadataScheme.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "http://example.com/meta");
    }

    function test_createMarket_acceptsHttpsAndArSchemes() public {
        address m1 = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "https://example.com/meta.json");
        address m2 = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ar://txid");
        assertTrue(m1 != address(0));
        assertTrue(m2 != address(0));
    }

    function test_createMarket_acceptsMaxLengthIpfsUri() public {
        bytes memory uri = new bytes(factory.MAX_METADATA_URI_LENGTH());
        bytes memory prefix = bytes("ipfs://");
        for (uint256 i = 0; i < prefix.length; ++i) {
            uri[i] = prefix[i];
        }
        for (uint256 i = prefix.length; i < uri.length; ++i) {
            uri[i] = "b";
        }
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, string(uri));
        assertTrue(market != address(0));
    }


    function test_activateMarket_revertsWithoutLiquidity() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        vm.expectRevert(MarketFactory.InsufficientLiquidity.selector);
        factory.activateMarket(market);
    }

    function test_activateMarket_revertsBelowThreshold() public {
        uint256 minLiq = 1 ether;
        address market = factory.createMarket(validToken, block.timestamp + 1 days, minLiq, "ipfs://meta");
        collateral.mint(address(this), minLiq - 1);
        collateral.approve(market, minLiq - 1);
        PredictionMarket(payable(market)).addLiquidity(minLiq - 1);
        vm.expectRevert(MarketFactory.InsufficientLiquidity.selector);
        factory.activateMarket(market);
    }

    function test_activateMarket_opensWhenFundedAndBlocksTradingBefore() public {
        uint256 minLiq = 1 ether;
        address market = factory.createMarket(validToken, block.timestamp + 1 days, minLiq, "ipfs://meta");
        PredictionMarket pm = PredictionMarket(payable(market));

        vm.expectRevert(PredictionMarket.InvalidMarketState.selector);
        pm.mintPosition(1, 1);

        collateral.mint(address(this), minLiq);
        collateral.approve(market, minLiq);
        pm.addLiquidity(minLiq);

        vm.expectEmit(true, false, false, true);
        emit MarketActivated(market, minLiq);
        factory.activateMarket(market);

        MarketFactory.MarketInfo memory info = factory.getMarketInfo(market);
        assertEq(uint256(info.status), uint256(MarketFactory.MarketStatus.OPEN));
        assertEq(uint256(pm.state()), uint256(PredictionMarket.MarketState.OPEN));

        vm.expectRevert(MarketFactory.InvalidMarketStatus.selector);
        factory.activateMarket(market);
    }

}
