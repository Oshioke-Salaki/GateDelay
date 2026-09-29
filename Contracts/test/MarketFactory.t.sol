// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "market-foundation/MarketFactory.sol";
import "market-foundation/PositionToken.sol";

contract MarketFactoryTest is Test {
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline
    );

    PositionToken internal positionToken;
    MarketFactory internal factory;

    address internal alice = address(0xA11CE);
    address internal validToken = address(0xC011A7);

    function setUp() public {
        // Predict the factory deployment address so PositionToken can restrict
        // authorisation calls to the MarketFactory instance.
        uint256 factoryNonce = vm.getNonce(address(this)) + 1;
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));
    }

    function test_constructor_revertsWithZeroPositionToken() public {
        vm.expectRevert(MarketFactory.ZeroPositionToken.selector);
        new MarketFactory(address(0));
    }

    function test_constructor_revertsWithInvalidPositionToken() public {
        vm.expectRevert(MarketFactory.InvalidPositionToken.selector);
        new MarketFactory(address(1));
        // Predict the factory address so PositionToken can restrict authorisation
        // to the factory before either contract is deployed.
        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        positionToken = new PositionToken(predictedFactory); // nonce
        factory = new MarketFactory(address(positionToken)); // nonce + 1
    }

    // =========================================================================
    // Unit tests — task 3.3
    // =========================================================================

    // --- Revert: ZeroCollateralToken (Req 1.3) ---
    function test_createMarket_revertsZeroCollateralToken() public {
        vm.expectRevert(MarketFactory.ZeroCollateralToken.selector);
        factory.createMarket(address(0), block.timestamp + 1 days, 1 ether, "ipfs://meta");
    }

    // --- Revert: InvalidDeadline — equal to block.timestamp (Req 1.2) ---
    function test_createMarket_revertsInvalidDeadline_equal() public {
        vm.expectRevert(MarketFactory.InvalidDeadline.selector);
        factory.createMarket(validToken, block.timestamp, 1 ether, "ipfs://meta");
    }

    // --- Revert: InvalidDeadline — less than block.timestamp (Req 1.2) ---
    function test_createMarket_revertsInvalidDeadline_past() public {
        vm.warp(1000);
        vm.expectRevert(MarketFactory.InvalidDeadline.selector);
        factory.createMarket(validToken, 999, 1 ether, "ipfs://meta");
    }

    // --- Revert: ZeroMinLiquidity (Req 1.4) ---
    function test_createMarket_revertsZeroMinLiquidity() public {
        vm.expectRevert(MarketFactory.ZeroMinLiquidity.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 0, "ipfs://meta");
    }

    // --- Revert: EmptyMetadataURI (Req 1.5) ---
    function test_createMarket_revertsEmptyMetadataURI() public {
        vm.expectRevert(MarketFactory.EmptyMetadataURI.selector);
        factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "");
    }

    // --- Successful creation: returns non-zero address (Req 1.1) ---
    function test_createMarket_returnsNonZeroAddress() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        assertTrue(market != address(0));
        assertEq(factory.marketCount(), 1);
        assertEq(factory.marketAt(0), market);
        assertTrue(positionToken.isAuthorised(market));
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

    // --- Registry: getCreator returns caller (Req 1.7, 1.9) ---
    function test_createMarket_registersCreator() public {
        vm.prank(alice);
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        assertEq(factory.getCreator(market), alice);
    }

    // --- Registry: getCreator returns zero for unregistered (Req 1.10) ---
    function test_getCreator_returnsZeroForUnregistered() public {
        assertEq(factory.getCreator(address(0xDEAD)), address(0));
    }

    // --- Initial status is OPEN (Req 1.8) ---
    function test_createMarket_initialStatusIsOpen() public {
        address market = factory.createMarket(validToken, block.timestamp + 1 days, 1 ether, "ipfs://meta");
        MarketFactory.MarketInfo memory info = factory.getMarketInfo(market);
        assertEq(uint256(info.status), uint256(MarketFactory.MarketStatus.OPEN));
    }

    // --- MarketCreated event fields (Req 1.6) ---
    function test_createMarket_emitsMarketCreated() public {
        uint256 deadline = block.timestamp + 1 days;

        // Predict the market address that will be generated
        // keccak256(abi.encodePacked(address(this), block.timestamp, 0))
        address expectedMarket =
            address(uint160(uint256(keccak256(abi.encodePacked(address(this), block.timestamp, uint256(0))))));

        vm.expectEmit(true, true, true, true);
        emit MarketCreated(expectedMarket, address(this), validToken, deadline);
        factory.createMarket(validToken, deadline, 1 ether, "ipfs://meta");
    }

    // --- getMarketInfo returns correct fields ---
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
        assertEq(uint256(info.status), uint256(MarketFactory.MarketStatus.OPEN));
    }

    // =========================================================================
    // #968 – Deterministic market IDs and duplicate flight markets
    // =========================================================================

    function test_deterministicMarketId_matchesKeccakComputation() public {
        uint256 deadline = block.timestamp + 1 days;

        // Pre-compute expected address: keccak256(sender, timestamp, listIndex=0)
        address expected = address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(address(this), block.timestamp, uint256(0)))
                )
            )
        );

        address market = factory.createMarket(validToken, deadline, 1 ether, "ipfs://FL001");
        assertEq(market, expected);
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

    // =========================================================================
    // Property-based fuzz tests — task 3.2
    // =========================================================================

    // Feature: prediction-market-contracts, Property 1: Valid market creation and registry round-trip
    // Validates: Requirements 1.1, 1.7
    function testFuzz_createMarket_validParams(
        address collateralToken,
        uint32 deadlineOffset,
        uint128 minLiquidity,
        string calldata metadataURI
    ) public {
        vm.assume(collateralToken != address(0));
        vm.assume(deadlineOffset > 0);
        vm.assume(minLiquidity > 0);
        vm.assume(bytes(metadataURI).length > 0);

        uint256 deadline = block.timestamp + uint256(deadlineOffset);

        vm.prank(alice);
        address market = factory.createMarket(collateralToken, deadline, uint256(minLiquidity), metadataURI);

        assertTrue(market != address(0), "market address must be non-zero");
        assertEq(factory.getCreator(market), alice, "creator must be the caller");
    }
}
