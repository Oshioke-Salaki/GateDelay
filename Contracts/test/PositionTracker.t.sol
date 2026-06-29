// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PositionTracker.sol";
import "../src/PositionToken.sol";
import "../src/MarketFactory.sol";

contract PositionTrackerTest is Test {
    PositionTracker tracker;
    PositionToken positionToken;
    MarketFactory factory;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address market1 = address(0xDEAD);
    address market2 = address(0xBEEF);

    function setUp() public {
        // Deploy with predicted factory address
        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));

        tracker = new PositionTracker(address(positionToken), address(factory));

        // Authorize markets
        positionToken.authorise(market1);
        positionToken.authorise(market2);
    }

    function test_updatePosition() public {
        // Mint tokens to alice
        uint256 yesId = positionToken.yesId(market1);
        vm.prank(market1);
        positionToken.mint(alice, yesId, 100, "");

        // Update position
        tracker.updatePosition(alice, market1);

        PositionTracker.Position memory pos = tracker.getPosition(alice, market1);
        assertEq(pos.yesBalance, 100);
        assertEq(pos.noBalance, 0);
        assertEq(pos.totalValue, 100);
    }

    function test_getUserMarkets() public {
        uint256 yesId1 = positionToken.yesId(market1);
        uint256 yesId2 = positionToken.yesId(market2);

        vm.prank(market1);
        positionToken.mint(alice, yesId1, 50, "");
        
        vm.prank(market2);
        positionToken.mint(alice, yesId2, 75, "");

        tracker.updatePosition(alice, market1);
        tracker.updatePosition(alice, market2);

        address[] memory markets = tracker.getUserMarkets(alice);
        assertEq(markets.length, 2);
        assertEq(markets[0], market1);
        assertEq(markets[1], market2);
    }

    function test_getTotalValue() public {
        uint256 yesId1 = positionToken.yesId(market1);
        uint256 noId2 = positionToken.noId(market2);

        vm.prank(market1);
        positionToken.mint(alice, yesId1, 100, "");
        
        vm.prank(market2);
        positionToken.mint(alice, noId2, 200, "");

        tracker.updatePosition(alice, market1);
        tracker.updatePosition(alice, market2);

        uint256 totalValue = tracker.getTotalValue(alice);
        assertEq(totalValue, 300);
    }

    function testFuzz_calculatePositionValue(uint128 yesAmount, uint128 noAmount) public {
        vm.assume(yesAmount > 0 && noAmount > 0);
        
        uint256 yesId = positionToken.yesId(market1);
        uint256 noId = positionToken.noId(market1);

        vm.prank(market1);
        positionToken.mint(alice, yesId, yesAmount, "");
        
        vm.prank(market1);
        positionToken.mint(alice, noId, noAmount, "");

        uint256 value = tracker.calculatePositionValue(alice, market1);
        assertEq(value, uint256(yesAmount) + uint256(noAmount));
    }
}
