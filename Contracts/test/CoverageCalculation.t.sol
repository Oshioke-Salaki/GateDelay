// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CoverageCalculation.sol";

contract CoverageCalculationTest is Test {
    CoverageCalculation coverage;
    address admin;
    address alice;
    address bob;
    address market;
    address market2;

    function setUp() public {
        admin = makeAddr("admin");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        market = makeAddr("market");
        market2 = makeAddr("market2");

        vm.prank(admin);
        coverage = new CoverageCalculation(admin);
    }
    // Coverage Configuration Tests
    // -------------------------------------------------------------------------

    function test_configureCoverageType() public {
        vm.prank(admin);
        coverage.configureCoverageType(
            CoverageCalculation.CoverageType.BASIC,
            200 ether,
            600 ether,
            7_500
        );

        CoverageCalculation.CoverageParams memory params = coverage.getCoverageConfig(
            CoverageCalculation.CoverageType.BASIC
        );

        assertEq(params.baseCoverage, 200 ether);
        assertEq(params.maxCoverage, 600 ether);
        assertEq(params.riskMultiplier, 7_500);
        assertTrue(params.active);
    }

    function test_configureCoverageType_revertsNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        coverage.configureCoverageType(
            CoverageCalculation.CoverageType.BASIC,
            200 ether,
            600 ether,
            7_500
        );
    }

    function test_configureCoverageType_revertsInvalidAmount() public {
        vm.prank(admin);
        vm.expectRevert(CoverageCalculation.InvalidCoverageAmount.selector);
        coverage.configureCoverageType(
            CoverageCalculation.CoverageType.BASIC,
            600 ether,
            200 ether,
            7_500
        );
    }

    function test_configureCoverageType_revertsInvalidMultiplier() public {
        vm.prank(admin);
        vm.expectRevert(CoverageCalculation.InvalidMultiplier.selector);
        coverage.configureCoverageType(
            CoverageCalculation.CoverageType.BASIC,
            100 ether,
            500 ether,
            15_000
        );
    }

    // -------------------------------------------------------------------------
    // Coverage Calculation Tests
    // -------------------------------------------------------------------------

    function test_calculateCoverage_basicTier_lowRisk() public {
        // BASIC tier: 100 ether base, 70% multiplier
        CoverageCalculation.CoverageResult memory calc =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.BASIC, 0);

        assertEq(calc.baseCoverage, 100 ether);
        assertEq(calc.riskAdjustment, 0); // 0 risk score
        assertEq(calc.finalCoverage, 100 ether);
    }

    function test_calculateCoverage_basicTier_highRisk() public {
        // BASIC tier with 50% risk
        CoverageCalculation.CoverageResult memory calc =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.BASIC, 5_000);

        assertEq(calc.baseCoverage, 100 ether);
        // riskAdjustment = 100 * 7000 * 5000 / (10000 * 10000) = 35 ether
        assertEq(calc.riskAdjustment, 35 ether);
        assertEq(calc.finalCoverage, 135 ether);
    }

    function test_calculateCoverage_allTiers() public {
        CoverageCalculation.CoverageResult memory basic =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.BASIC, 5_000);
        CoverageCalculation.CoverageResult memory standard =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.STANDARD, 5_000);
        CoverageCalculation.CoverageResult memory premium =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.PREMIUM, 5_000);
        CoverageCalculation.CoverageResult memory platinum =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.PLATINUM, 5_000);

        assertTrue(basic.finalCoverage < standard.finalCoverage);
        assertTrue(standard.finalCoverage < premium.finalCoverage);
        assertTrue(premium.finalCoverage < platinum.finalCoverage);
    }

    function test_calculateCoverage_capAtMax() public {
        // Try to get a very high coverage with high risk
        CoverageCalculation.CoverageResult memory calc =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.BASIC, 10_000); // 100% risk

        // Should be capped at max (500 ether for BASIC)
        assertEq(calc.finalCoverage, 500 ether);
    }

    // -------------------------------------------------------------------------
    // Allocation Tests
    // -------------------------------------------------------------------------

    function test_allocateCoverage() public {
        uint256 allocatedAmount = coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        assertGt(allocatedAmount, 0);

        CoverageCalculation.CoverageAllocation memory allocation = coverage.getAllocation(alice, market);
        assertEq(allocation.user, alice);
        assertEq(allocation.market, market);
        assertEq(allocation.allocatedAmount, allocatedAmount);
        assertEq(allocation.utilizationAmount, 0);
        assertTrue(allocation.active);
    }

    function test_allocateCoverage_multiplePairs() public {
        uint256 amount1 = coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        uint256 amount2 = coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        uint256 total = coverage.getTotalAllocated(alice);
        assertEq(total, amount1 + amount2);
    }

    function test_allocateCoverage_revertsInvalidUser() public {
        vm.expectRevert(CoverageCalculation.InvalidUser.selector);
        coverage.allocateCoverage(
            address(0),
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );
    }

    function test_allocateCoverage_revertsInvalidMarket() public {
        vm.expectRevert(CoverageCalculation.InvalidMarket.selector);
        coverage.allocateCoverage(
            alice,
            address(0),
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );
    }

    function test_allocateCoverage_revertsInvalidRiskScore() public {
        vm.expectRevert(CoverageCalculation.InvalidRiskScore.selector);
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            10_001
        );
    }

    // -------------------------------------------------------------------------
    // Utilization Tests
    // -------------------------------------------------------------------------

    function test_updateUtilization() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        coverage.updateUtilization(alice, market, 200 ether);

        CoverageCalculation.CoverageAllocation memory allocation = coverage.getAllocation(alice, market);
        assertEq(allocation.utilizationAmount, 200 ether);
        assertEq(allocation.remainingCapacity, allocation.allocatedAmount - 200 ether);
    }

    function test_updateUtilization_revertsExceedsLimit() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        vm.expectRevert(CoverageCalculation.CoverageLimitExceeded.selector);
        coverage.updateUtilization(alice, market, 1000 ether); // Exceeds allocated
    }

    function test_getTotalUtilization() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        coverage.updateUtilization(alice, market, 50 ether);
        coverage.updateUtilization(alice, market2, 100 ether);

        uint256 total = coverage.getTotalUtilization(alice);
        assertEq(total, 150 ether);
    }

    // -------------------------------------------------------------------------
    // Risk Score Tests
    // -------------------------------------------------------------------------

    function test_updateRiskScore() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            3_000
        );

        coverage.updateRiskScore(alice, market, 7_000);

        CoverageCalculation.CoverageAllocation memory allocation = coverage.getAllocation(alice, market);
        assertEq(allocation.riskScore, 7_000);
    }

    function test_updateRiskScore_recalculatesCoverage() public {
        uint256 allocated1 = coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            3_000
        );

        coverage.updateRiskScore(alice, market, 7_000);

        CoverageCalculation.CoverageAllocation memory allocation = coverage.getAllocation(alice, market);
        // Coverage should increase with higher risk score
        assertGt(allocation.allocatedAmount, allocated1);
    }

    function test_updateRiskScore_revertsInvalidScore() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        vm.expectRevert(CoverageCalculation.InvalidRiskScore.selector);
        coverage.updateRiskScore(alice, market, 10_001);
    }

    // -------------------------------------------------------------------------
    // Query Tests
    // -------------------------------------------------------------------------

    function test_getUserMarkets() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        address[] memory markets = coverage.getUserMarkets(alice);
        assertEq(markets.length, 2);
        assertEq(markets[0], market);
        assertEq(markets[1], market2);
    }

    function test_getMarketUsers() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        coverage.allocateCoverage(
            bob,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        address[] memory users = coverage.getMarketUsers(market);
        assertEq(users.length, 2);
        assertEq(users[0], alice);
        assertEq(users[1], bob);
    }

    function test_isCoverageAvailable() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        bool available = coverage.isCoverageAvailable(alice, market, 100 ether);
        assertTrue(available);
    }

    function test_isCoverageAvailable_exceedsLimit() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        bool available = coverage.isCoverageAvailable(alice, market, 1000 ether);
        assertFalse(available);
    }

    function test_getTotalRemainingCapacity() public {
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        coverage.updateUtilization(alice, market, 50 ether);
        coverage.updateUtilization(alice, market2, 100 ether);

        uint256 remaining = coverage.getTotalRemainingCapacity(alice);
        uint256 allocated = coverage.getTotalAllocated(alice);
        uint256 utilized = coverage.getTotalUtilization(alice);

        assertEq(remaining, allocated - utilized);
    }

    function test_getPortfolioUtilization() public {
        uint256 allocated1 = coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        uint256 allocated2 = coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        coverage.updateUtilization(alice, market, allocated1 / 2);
        coverage.updateUtilization(alice, market2, allocated2 / 2);

        uint256 utilization = coverage.getPortfolioUtilization(alice);

        // Should be 50% (5000 bps)
        assertEq(utilization, 5_000);
    }

    function test_getBaseCoverage() public {
        uint256 baseCoverage = coverage.getBaseCoverage(CoverageCalculation.CoverageType.PREMIUM);
        assertEq(baseCoverage, 2500 ether);
    }

    // -------------------------------------------------------------------------
    // Admin Tests
    // -------------------------------------------------------------------------

    function test_updateAdmin() public {
        vm.prank(admin);
        coverage.updateAdmin(bob);

        assertEq(coverage.admin(), bob);
    }

    function test_updateAdmin_revertsNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        coverage.updateAdmin(bob);
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    function test_fullCoverageWorkflow() public {
        // 1. Allocate coverage
        uint256 allocated = coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.PREMIUM,
            4_000
        );

        assertGt(allocated, 0);

        // 2. Check availability
        bool available = coverage.isCoverageAvailable(alice, market, allocated / 2);
        assertTrue(available);

        // 3. Update utilization
        coverage.updateUtilization(alice, market, allocated / 2);

        // 4. Update risk
        coverage.updateRiskScore(alice, market, 6_000);

        // 5. Query everything
        CoverageCalculation.CoverageAllocation memory allocation = coverage.getAllocation(alice, market);
        assertEq(allocation.utilizationAmount, allocated / 2);
        assertEq(allocation.riskScore, 6_000);
    }

    function test_multiUserPortfolio() public {
        // Alice
        coverage.allocateCoverage(
            alice,
            market,
            CoverageCalculation.CoverageType.BASIC,
            5_000
        );

        coverage.allocateCoverage(
            alice,
            market2,
            CoverageCalculation.CoverageType.STANDARD,
            5_000
        );

        // Bob
        coverage.allocateCoverage(
            bob,
            market,
            CoverageCalculation.CoverageType.PREMIUM,
            5_000
        );

        // Verify allocations
        assertEq(coverage.getUserMarkets(alice).length, 2);
        assertEq(coverage.getUserMarkets(bob).length, 1);
        assertEq(coverage.getMarketUsers(market).length, 2);
        assertEq(coverage.getMarketUsers(market2).length, 1);

        // Verify totals
        uint256 aliceTotalAllocated = coverage.getTotalAllocated(alice);
        uint256 bobTotalAllocated = coverage.getTotalAllocated(bob);
        assertGt(aliceTotalAllocated, 0);
        assertGt(bobTotalAllocated, 0);
    }

    function testFuzz_calculateCoverage(uint256 riskScore) public {
        vm.assume(riskScore <= 10_000);

        CoverageCalculation.CoverageResult memory calc =
            coverage.calculateCoverage(CoverageCalculation.CoverageType.STANDARD, riskScore);

        assertGe(calc.finalCoverage, calc.baseCoverage);
        assertLe(calc.finalCoverage, coverage.getCoverageConfig(
            CoverageCalculation.CoverageType.STANDARD
        ).maxCoverage);
    }
}
