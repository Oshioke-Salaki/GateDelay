// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarginCalculator.sol";
import "../src/PositionToken.sol";
import "../src/MarketFactory.sol";

contract MarginCalculatorTest is Test {
    MarginCalculator calculator;
    PositionToken positionToken;
    MarketFactory factory;

    address alice = address(0xA11CE);
    address market = address(0xDEAD);

    function setUp() public {
        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));

        calculator = new MarginCalculator(address(positionToken), address(factory));

        positionToken.authorise(market);
    }

    function test_calculateMarginRequirement() public {
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, 1000, "");

        MarginCalculator.MarginRequirement memory req = calculator.calculateMarginRequirement(alice, market);
        
        // 20% initial margin
        assertEq(req.initialMargin, 200);
        // 15% maintenance margin
        assertEq(req.maintenanceMargin, 150);
        // 10% liquidation margin
        assertEq(req.liquidationMargin, 100);
    }

    function test_depositMargin() public {
        vm.prank(alice);
        calculator.depositMargin(500);

        uint256 deposited = calculator.getDepositedMargin(alice);
        assertEq(deposited, 500);
    }

    function test_withdrawMargin() public {
        vm.startPrank(alice);
        calculator.depositMargin(500);
        calculator.withdrawMargin(200);
        vm.stopPrank();

        uint256 deposited = calculator.getDepositedMargin(alice);
        assertEq(deposited, 300);
    }

    function test_withdrawMargin_revertsInsufficientMargin() public {
        vm.startPrank(alice);
        calculator.depositMargin(100);
        
        vm.expectRevert(MarginCalculator.InsufficientMargin.selector);
        calculator.withdrawMargin(200);
        vm.stopPrank();
    }

    function test_checkMarginCall() public {
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, 1000, "");

        // Deposit insufficient margin
        vm.prank(alice);
        calculator.depositMargin(100);

        calculator.calculateMarginRequirement(alice, market);
        bool needsCall = calculator.checkMarginCall(alice, market);
        
        assertTrue(needsCall);
    }

    function test_hasSufficientMargin() public {
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, 1000, "");

        vm.prank(alice);
        calculator.depositMargin(300);

        calculator.calculateMarginRequirement(alice, market);
        
        bool sufficient = calculator.hasSufficientMargin(
            alice, 
            market, 
            MarginCalculator.MarginType.INITIAL
        );
        assertTrue(sufficient);
    }

    function testFuzz_marginCalculation(uint128 positionSize) public {
        vm.assume(positionSize > 0 && positionSize < type(uint128).max / 2);
        
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, positionSize, "");

        MarginCalculator.MarginRequirement memory req = calculator.calculateMarginRequirement(alice, market);
        
        // Verify margin ratios
        assertEq(req.initialMargin, (positionSize * 2000) / 10000);
        assertEq(req.maintenanceMargin, (positionSize * 1500) / 10000);
        assertEq(req.liquidationMargin, (positionSize * 1000) / 10000);
    }
}
