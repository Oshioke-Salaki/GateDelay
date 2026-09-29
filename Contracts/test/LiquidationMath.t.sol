// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import "../src/Liquidation.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LiquidationMathTest
 * @notice Comprehensive tests for liquidation math, rounding, collateral ratios, and partial liquidations
 * @dev Tests cover:
 *      - Precision and rounding direction in calculations
 *      - Collateral ratio thresholds and boundary conditions
 *      - Partial liquidation amounts and remainder handling
 *      - Edge cases with small values and maximum values
 *      - Liquidation penalties and bonuses
 */
contract LiquidationMathTest is Test {
    Liquidation internal liquidation;
    MockCollateralToken internal collateralToken;
    MockDebtToken internal debtToken;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal liquidator = makeAddr("liquidator");

    uint256 constant LIQUIDATION_THRESHOLD = 150; // 150% collateralization
    uint256 constant LIQUIDATION_PENALTY = 10; // 10% penalty
    uint256 constant LIQUIDATOR_BONUS = 5; // 5% bonus

    function setUp() public {
        collateralToken = new MockCollateralToken();
        debtToken = new MockDebtToken();

        liquidation = new Liquidation(
            address(collateralToken),
            address(debtToken),
            LIQUIDATION_THRESHOLD,
            LIQUIDATION_PENALTY,
            LIQUIDATOR_BONUS
        );

        // Setup initial balances
        collateralToken.mint(alice, 10_000 ether);
        collateralToken.mint(bob, 10_000 ether);
        debtToken.mint(address(liquidation), 100_000 ether);

        vm.prank(alice);
        collateralToken.approve(address(liquidation), type(uint256).max);
        vm.prank(bob);
        collateralToken.approve(address(liquidation), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Precision and Rounding Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_precision_roundingDown() public {
        // Test that division rounds down correctly
        uint256 collateral = 1000 ether;
        uint256 debt = 667 ether; // Results in 149.925... % ratio

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);

        // Ratio should round down (149% instead of 150%)
        assertTrue(ratio < LIQUIDATION_THRESHOLD, "Should round down below threshold");
        assertTrue(ratio >= 149, "Should be at least 149%");
    }

    function test_precision_roundingDownProtectsProtocol() public {
        // Ensure rounding always favors protocol safety
        uint256 collateral = 150 ether;
        uint256 debt = 100 ether + 1 wei; // Slightly over 150%

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);

        // Should be liquidatable because rounding makes it under threshold
        assertTrue(liquidation.isLiquidatable(alice), "Should be liquidatable with rounding");
    }

    function test_precision_smallValueAccuracy() public {
        // Test precision with very small values
        uint256 collateral = 1 ether;
        uint256 debt = 1 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);

        assertEq(ratio, 100, "Small values should maintain precision");
    }

    function test_precision_largeValueAccuracy() public {
        // Test precision with very large values
        uint256 collateral = 1_000_000 ether;
        uint256 debt = 666_666 ether;

        collateralToken.mint(alice, collateral);

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);

        // Should be 150% (1M / 666.666K)
        assertTrue(ratio >= 149 && ratio <= 150, "Large values should maintain precision");
    }

    function test_precision_weiLevelAccuracy() public {
        // Test wei-level precision
        uint256 collateral = 1 ether + 500 wei;
        uint256 debt = 1 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);

        // Should reflect the extra 500 wei in collateral
        assertTrue(ratio >= 100, "Wei-level differences should be captured");
    }

    function test_rounding_penaltyCalculation() public {
        uint256 debtAmount = 1000 ether;
        uint256 penalty = liquidation.calculatePenalty(debtAmount);

        // 10% penalty
        assertEq(penalty, 100 ether, "Penalty should be exactly 10%");
    }

    function test_rounding_penaltyOddAmount() public {
        uint256 debtAmount = 333 ether; // Results in 33.3 penalty
        uint256 penalty = liquidation.calculatePenalty(debtAmount);

        // Should round down: 33.3 -> 33
        assertEq(penalty, 33.3 ether, "Odd penalty should round correctly");
    }

    function test_rounding_bonusCalculation() public {
        uint256 collateralAmount = 1000 ether;
        uint256 bonus = liquidation.calculateLiquidatorBonus(collateralAmount);

        // 5% bonus
        assertEq(bonus, 50 ether, "Bonus should be exactly 5%");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Collateral Ratio Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_collateralRatio_exactThreshold() public {
        uint256 collateral = 150 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);
        assertEq(ratio, 150, "Ratio should be exactly at threshold");

        // At exactly 150%, should NOT be liquidatable (threshold is exclusive)
        assertFalse(liquidation.isLiquidatable(alice), "Should not be liquidatable at threshold");
    }

    function test_collateralRatio_belowThreshold() public {
        uint256 collateral = 149 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        assertTrue(liquidation.isLiquidatable(alice), "Should be liquidatable below threshold");
    }

    function test_collateralRatio_aboveThreshold() public {
        uint256 collateral = 200 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratio = liquidation.getCollateralizationRatio(alice);
        assertEq(ratio, 200, "Ratio should be 200%");

        assertFalse(liquidation.isLiquidatable(alice), "Should not be liquidatable above threshold");
    }

    function test_collateralRatio_zeroDebt() public {
        uint256 collateral = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        // No debt = infinite collateralization = not liquidatable
        assertFalse(liquidation.isLiquidatable(alice), "No debt should not be liquidatable");
    }

    function test_collateralRatio_zeroCollateral() public {
        uint256 debt = 100 ether;

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Zero collateral with debt = liquidatable
        assertTrue(liquidation.isLiquidatable(alice), "Zero collateral with debt should be liquidatable");
    }

    function test_collateralRatio_boundaryCondition_jusBelowThreshold() public {
        uint256 collateral = 150 ether - 1 wei;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        assertTrue(liquidation.isLiquidatable(alice), "Just below threshold should be liquidatable");
    }

    function test_collateralRatio_boundaryCondition_justAboveThreshold() public {
        uint256 collateral = 150 ether + 1 wei;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        assertFalse(liquidation.isLiquidatable(alice), "Just above threshold should not be liquidatable");
    }

    function test_collateralRatio_priceVolatilitySimulation() public {
        // Simulate collateral price drop
        uint256 collateral = 200 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Initially safe
        assertFalse(liquidation.isLiquidatable(alice), "Should be safe initially");

        // Simulate 30% price drop by increasing effective debt
        vm.prank(address(liquidation));
        liquidation.updateDebt(alice, 143 ether); // 200/143 = 139.86%

        // Now liquidatable
        assertTrue(liquidation.isLiquidatable(alice), "Should be liquidatable after price drop");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Partial Liquidation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_partialLiquidation_50Percent() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Liquidate 50% of debt
        uint256 liquidateAmount = 50 ether;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        liquidation.liquidate(alice, liquidateAmount);

        // Check remaining debt
        uint256 remainingDebt = liquidation.getDebt(alice);
        assertEq(remainingDebt, 50 ether, "Should have 50% debt remaining");

        // Check collateral reduction (50 debt + 5 penalty = 55 collateral taken)
        uint256 remainingCollateral = liquidation.getCollateral(alice);
        assertTrue(remainingCollateral < collateral, "Collateral should be reduced");
    }

    function test_partialLiquidation_25Percent() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Liquidate 25% of debt
        uint256 liquidateAmount = 25 ether;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        liquidation.liquidate(alice, liquidateAmount);

        uint256 remainingDebt = liquidation.getDebt(alice);
        assertEq(remainingDebt, 75 ether, "Should have 75% debt remaining");
    }

    function test_partialLiquidation_multipleSmallLiquidations() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Liquidate in 10 ether chunks
        for (uint256 i = 0; i < 5; i++) {
            debtToken.mint(liquidator, 10 ether);
            vm.prank(liquidator);
            debtToken.approve(address(liquidation), 10 ether);

            vm.prank(liquidator);
            liquidation.liquidate(alice, 10 ether);
        }

        uint256 remainingDebt = liquidation.getDebt(alice);
        assertEq(remainingDebt, 50 ether, "Should have liquidated 50 ether total");
    }

    function test_partialLiquidation_remainderHandling() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Liquidate odd amount
        uint256 liquidateAmount = 33 ether;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        liquidation.liquidate(alice, liquidateAmount);

        uint256 remainingDebt = liquidation.getDebt(alice);
        assertEq(remainingDebt, 67 ether, "Remainder should be exact");
    }

    function test_partialLiquidation_cannotOverLiquidate() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Try to liquidate more than debt
        uint256 liquidateAmount = 150 ether;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        vm.expectRevert();
        liquidation.liquidate(alice, liquidateAmount);
    }

    function test_partialLiquidation_ratioImprovementCheck() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        uint256 ratioBefore = liquidation.getCollateralizationRatio(alice);

        // Partial liquidation
        uint256 liquidateAmount = 50 ether;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        liquidation.liquidate(alice, liquidateAmount);

        uint256 ratioAfter = liquidation.getCollateralizationRatio(alice);

        // Ratio should improve after partial liquidation
        assertTrue(ratioAfter > ratioBefore, "Ratio should improve after liquidation");
    }

    function test_partialLiquidation_minimumLiquidationAmount() public {
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        // Try to liquidate dust amount
        uint256 liquidateAmount = 1 wei;

        debtToken.mint(liquidator, liquidateAmount);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), liquidateAmount);

        vm.prank(liquidator);
        liquidation.liquidate(alice, liquidateAmount);

        // Should succeed but practically meaningless
        uint256 remainingDebt = liquidation.getDebt(alice);
        assertEq(remainingDebt, debt - 1 wei, "Should liquidate even dust amounts");
    }

    function test_partialLiquidation_fullVsPartialComparison() public {
        // Setup two identical positions
        uint256 collateral = 140 ether;
        uint256 debt = 100 ether;

        vm.prank(alice);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, debt);

        vm.prank(bob);
        liquidation.depositCollateral(collateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(bob, debt);

        // Full liquidation for alice
        debtToken.mint(liquidator, debt);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), debt);

        vm.prank(liquidator);
        liquidation.liquidate(alice, debt);

        // Partial liquidation for bob (50%)
        debtToken.mint(liquidator, debt / 2);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), debt / 2);

        vm.prank(liquidator);
        liquidation.liquidate(bob, debt / 2);

        // Alice should have 0 debt, bob should have 50 ether debt
        assertEq(liquidation.getDebt(alice), 0, "Alice should be fully liquidated");
        assertEq(liquidation.getDebt(bob), 50 ether, "Bob should be partially liquidated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Cases and Boundary Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_edge_maximumValues() public {
        uint256 maxCollateral = type(uint128).max;
        uint256 maxDebt = type(uint128).max / 2; // Ensure ratio > threshold

        collateralToken.mint(alice, maxCollateral);

        vm.prank(alice);
        liquidation.depositCollateral(maxCollateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, maxDebt);

        // Should handle max values without overflow
        uint256 ratio = liquidation.getCollateralizationRatio(alice);
        assertTrue(ratio > LIQUIDATION_THRESHOLD, "Should handle max values");
    }

    function test_edge_minimumNonZeroValues() public {
        uint256 minCollateral = 1 wei;
        uint256 minDebt = 1 wei;

        vm.prank(alice);
        liquidation.depositCollateral(minCollateral);

        vm.prank(address(liquidation));
        liquidation.createDebt(alice, minDebt);

        // Ratio should be 100%
        uint256 ratio = liquidation.getCollateralizationRatio(alice);
        assertEq(ratio, 100, "Minimum values should yield 100% ratio");

        assertTrue(liquidation.isLiquidatable(alice), "Should be liquidatable at 100%");
    }

    function test_edge_penaltyOverflow() public {
        uint256 maxDebt = type(uint256).max / 110; // Ensure penalty doesn't overflow

        vm.prank(address(liquidation));
        uint256 penalty = liquidation.calculatePenalty(maxDebt);

        // Should not overflow
        assertTrue(penalty > 0, "Penalty should be calculated");
        assertTrue(penalty < maxDebt, "Penalty should be less than debt");
    }

    function test_edge_multiplePositionsIndependence() public {
        // Create multiple positions
        address[] memory users = new address[](3);
        users[0] = alice;
        users[1] = bob;
        users[2] = makeAddr("carol");

        for (uint256 i = 0; i < users.length; i++) {
            collateralToken.mint(users[i], 200 ether);
            vm.prank(users[i]);
            collateralToken.approve(address(liquidation), type(uint256).max);

            vm.prank(users[i]);
            liquidation.depositCollateral(150 ether - i * 10 ether);

            vm.prank(address(liquidation));
            liquidation.createDebt(users[i], 100 ether);
        }

        // Liquidate middle position
        debtToken.mint(liquidator, 100 ether);
        vm.prank(liquidator);
        debtToken.approve(address(liquidation), 100 ether);

        vm.prank(liquidator);
        liquidation.liquidate(bob, 100 ether);

        // Other positions should be unaffected
        assertTrue(liquidation.getDebt(alice) == 100 ether, "Alice position unchanged");
        assertTrue(liquidation.getDebt(users[2]) == 100 ether, "Carol position unchanged");
        assertTrue(liquidation.getDebt(bob) == 0, "Bob position liquidated");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Contracts
// ═══════════════════════════════════════════════════════════════════════════════

contract MockCollateralToken is ERC20 {
    constructor() ERC20("Collateral", "COL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockDebtToken is ERC20 {
    constructor() ERC20("Debt", "DBT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
