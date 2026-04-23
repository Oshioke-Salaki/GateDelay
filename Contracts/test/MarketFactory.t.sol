// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/PositionToken.sol";

contract MarketFactoryTest is Test {
    PositionToken internal positionToken;
    MarketFactory internal factory;

    address internal alice = address(0xA11CE);
    address internal validToken = address(0xC011A7);

    function setUp() public {
        // Deploy PositionToken with this test contract as the factory
        // so that MarketFactory (deployed next) can call authorise()
        positionToken = new PositionToken(address(this));

        // Deploy MarketFactory — it will be the one calling positionToken.authorise()
        // But PositionToken only allows its stored factory to call authorise().
        // So we need PositionToken to recognise MarketFactory as the factory.
        // Re-deploy with MarketFactory as factory:
        MarketFactory tempFactory = new MarketFactory(address(positionToken));
        // Re-deploy PositionToken pointing to the real factory
        positionToken = new PositionToken(address(tempFactory));
        factory = new MarketFactory(address(positionToken));

        // factory != positionToken.factory(), so authorise() would revert.
        // We need positionToken.factory() == address(factory).
        // Deploy in correct order:
        positionToken = new PositionToken(address(0)); // placeholder
        // We can't set factory after construction, so deploy factory first with a dummy token,
        // then deploy the real token pointing to factory.
        factory = new MarketFactory(address(1)); // dummy token address
        positionToken = new PositionToken(address(factory));
        // Now redeploy factory with the real positionToken
        factory = new MarketFactory(address(positionToken));
        // positionToken.factory() == old factory address, not the new one.
        // The only clean solution: deploy positionToken with factory address known upfront.
        // Use vm.computeCreateAddress to predict factory address.
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
        address expectedMarket = address(
            uint160(
                uint256(keccak256(abi.encodePacked(address(this), block.timestamp, uint256(0))))
            )
        );

        vm.expectEmit(true, true, true, true);
        emit MarketFactory.MarketCreated(expectedMarket, address(this), validToken, deadline);
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
