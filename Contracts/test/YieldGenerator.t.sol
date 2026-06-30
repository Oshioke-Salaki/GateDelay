// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {YieldGenerator} from "../contracts/YieldGenerator.sol";

/// @title YieldGenerator.t.sol
/// @notice Comprehensive Foundry tests covering all acceptance criteria
contract YieldGeneratorTest is Test {
    YieldGenerator public generator;

    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");

    // Dummy ERC-20 addresses (no real token needed — principal is just a number)
    address internal tokenA = makeAddr("tokenA");
    address internal tokenB = makeAddr("tokenB");

    uint256 internal constant PRINCIPAL   = 1_000e18;  // 1 000 tokens (UD60x18)
    uint256 internal constant RATE_500BPS = 500;        // 5% APR
    uint256 internal constant RATE_1000BPS= 1_000;      // 10% APR
    uint256 internal constant ONE_YEAR    = 365 days;

    function setUp() public {
        generator = new YieldGenerator();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _registerAliceSource(bool compounding) internal returns (uint256 id) {
        vm.prank(alice);
        id = generator.registerSource(tokenA, PRINCIPAL, RATE_500BPS, compounding);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Source registration (Track yield sources)
    // ─────────────────────────────────────────────────────────────────────────

    function test_RegisterSource_StoresData() public {
        uint256 id = _registerAliceSource(false);

        YieldGenerator.YieldSource memory src = generator.getSource(id);
        assertEq(src.asset,      tokenA,    "asset mismatch");
        assertEq(src.principal,  PRINCIPAL, "principal mismatch");
        assertTrue(src.active,              "should be active");
        assertFalse(src.compounding,        "not compounding");
    }

    function test_RegisterSource_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit YieldGenerator.SourceRegistered(0, alice, tokenA, PRINCIPAL, RATE_500BPS, false);
        _registerAliceSource(false);
    }

    function test_RegisterSource_TracksMultipleSources() public {
        vm.startPrank(alice);
        generator.registerSource(tokenA, PRINCIPAL,   RATE_500BPS,  false);
        generator.registerSource(tokenB, PRINCIPAL*2, RATE_1000BPS, true);
        vm.stopPrank();

        uint256[] memory ids = generator.getUserSources(alice);
        assertEq(ids.length, 2);
    }

    function test_RegisterSource_RevertsOnZeroPrincipal() public {
        vm.prank(alice);
        vm.expectRevert(YieldGenerator.ZeroPrincipal.selector);
        generator.registerSource(tokenA, 0, RATE_500BPS, false);
    }

    function test_RegisterSource_RevertsOnZeroRate() public {
        vm.prank(alice);
        vm.expectRevert(YieldGenerator.ZeroRate.selector);
        generator.registerSource(tokenA, PRINCIPAL, 0, false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Yield generation (Yield is generated)
    // ─────────────────────────────────────────────────────────────────────────

    function test_YieldGenerated_AfterTime() public {
        uint256 id = _registerAliceSource(false);

        vm.warp(block.timestamp + ONE_YEAR);

        uint256 pending = generator.pendingYield(id);
        // 5% of 1000 = ~50 tokens
        assertApproxEqRel(pending, 50e18, 1e15, "~5% yield after 1 year");
    }

    function test_YieldGenerated_LinearWithTime() public {
        uint256 id = _registerAliceSource(false);

        vm.warp(block.timestamp + ONE_YEAR / 2);
        uint256 half = generator.pendingYield(id);

        vm.warp(block.timestamp + ONE_YEAR / 2);
        uint256 full = generator.pendingYield(id);

        assertApproxEqRel(full, half * 2, 1e15, "yield should double over doubled time");
    }

    function test_ZeroYield_BeforeTimeElapse() public {
        uint256 id = _registerAliceSource(false);
        assertEq(generator.pendingYield(id), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Rate calculation (Rates are calculated)
    // ─────────────────────────────────────────────────────────────────────────

    function test_CurrentRateBps_MatchesRegistered() public {
        uint256 id = _registerAliceSource(false);
        uint256 rate = generator.currentRateBps(id);
        // Allow ±1 bps rounding from integer division
        assertApproxEqAbs(rate, RATE_500BPS, 1, "rate should match registration");
    }

    function test_UpdateRate_ChangesYieldAccrual() public {
        uint256 id = _registerAliceSource(false);

        // Accrue half a year at 5%
        vm.warp(block.timestamp + ONE_YEAR / 2);
        vm.prank(alice);
        generator.accrueYield(id);

        // Double the rate
        vm.prank(alice);
        generator.updateRate(id, RATE_1000BPS);

        // Accrue another half year at 10%
        vm.warp(block.timestamp + ONE_YEAR / 2);
        uint256 claimable = generator.claimableYield(id);

        // ~25 (5% × 0.5yr) + ~50 (10% × 0.5yr) = ~75
        assertApproxEqRel(claimable, 75e18, 5e15, "combined yield at two rates");
    }

    function test_UpdateRate_RevertsIfNotOwner() public {
        uint256 id = _registerAliceSource(false);
        vm.prank(bob);
        vm.expectRevert(YieldGenerator.NotSourceOwner.selector);
        generator.updateRate(id, RATE_1000BPS);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Compounding (Compounding works)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Compounding_IncreasesYieldOverTime() public {
        // compounding source
        vm.prank(alice);
        uint256 compId = generator.registerSource(tokenA, PRINCIPAL, RATE_500BPS, true);
        // non-compounding source at same rate
        uint256 plainId = _registerAliceSource(false);

        // Compound at 6-month intervals for 2 years
        for (uint256 i; i < 4; ++i) {
            vm.warp(block.timestamp + ONE_YEAR / 2);
            generator.accrueYield(compId);
            generator.accrueYield(plainId);
        }

        // Compounding source should have higher total (principal grew)
        YieldGenerator.YieldSource memory comp  = generator.getSource(compId);
        YieldGenerator.YieldSource memory plain = generator.getSource(plainId);

        // compounding principal > original
        assertGt(comp.principal, PRINCIPAL, "compounding should grow principal");
        // plain accrued yield accumulated normally, principal unchanged
        assertEq(plain.principal, PRINCIPAL, "plain principal unchanged");
        // compounding total value (principal) > plain total (principal + accruedYield)
        // because compound interest > simple interest
        uint256 compTotal  = comp.principal; // yield already in principal
        uint256 plainTotal = plain.principal + plain.accruedYield;
        assertGt(compTotal, plainTotal, "compounding beats simple over time");
    }

    function test_Compounding_YieldAddedToPrincipal() public {
        vm.prank(alice);
        uint256 id = generator.registerSource(tokenA, PRINCIPAL, RATE_500BPS, true);

        vm.warp(block.timestamp + ONE_YEAR);
        generator.accrueYield(id);

        YieldGenerator.YieldSource memory src = generator.getSource(id);
        assertGt(src.principal, PRINCIPAL, "principal should have grown");
        assertEq(src.accruedYield, 0, "compounding moves yield to principal");
    }

    function test_NonCompounding_YieldInAccruedBucket() public {
        uint256 id = _registerAliceSource(false);

        vm.warp(block.timestamp + ONE_YEAR);
        generator.accrueYield(id);

        YieldGenerator.YieldSource memory src = generator.getSource(id);
        assertGt(src.accruedYield, 0, "accrued yield should be non-zero");
        assertEq(src.principal, PRINCIPAL, "principal should be unchanged");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Harvest (Yield is generated & queries work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_HarvestYield_TransfersAccrued() public {
        uint256 id = _registerAliceSource(false);

        vm.warp(block.timestamp + ONE_YEAR);

        vm.prank(alice);
        uint256 harvested = generator.harvestYield(id);

        assertApproxEqRel(harvested, 50e18, 1e15, "~5% harvested");
        assertEq(generator.getSource(id).accruedYield, 0, "accrued cleared after harvest");
        assertEq(generator.totalHarvested(alice), harvested, "total harvested tracked");
    }

    function test_HarvestYield_RevertsIfNotOwner() public {
        uint256 id = _registerAliceSource(false);
        vm.prank(bob);
        vm.expectRevert(YieldGenerator.NotSourceOwner.selector);
        generator.harvestYield(id);
    }

    function test_HarvestYield_EmitsEvent() public {
        uint256 id = _registerAliceSource(false);
        vm.warp(block.timestamp + ONE_YEAR);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit YieldGenerator.YieldHarvested(id, alice, 0 /* any */);
        generator.harvestYield(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Queries (Queries work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_ClaimableYield_IncludesAccruedAndPending() public {
        uint256 id = _registerAliceSource(false);

        // Let half a year elapse and accrue
        vm.warp(block.timestamp + ONE_YEAR / 2);
        generator.accrueYield(id);

        // Let another half year elapse without accruing
        vm.warp(block.timestamp + ONE_YEAR / 2);

        uint256 claimable = generator.claimableYield(id);
        // Should cover both intervals (~50 total)
        assertApproxEqRel(claimable, 50e18, 1e15, "full year claimable");
    }

    function test_GetUserYieldSummary_AggregatesActiveSources() public {
        vm.startPrank(alice);
        generator.registerSource(tokenA, PRINCIPAL,   RATE_500BPS, false);
        generator.registerSource(tokenB, PRINCIPAL*2, RATE_500BPS, false);
        vm.stopPrank();

        vm.warp(block.timestamp + ONE_YEAR);
        (uint256 totalPrincipal, uint256 totalPending) =
            generator.getUserYieldSummary(alice);

        assertEq(totalPrincipal, PRINCIPAL * 3, "total principal mismatch");
        // ~5% × (1000 + 2000) = 150
        assertApproxEqRel(totalPending, 150e18, 1e15, "~150 total pending");
    }

    function test_GetUserSources_ReturnsBothSources() public {
        vm.startPrank(alice);
        generator.registerSource(tokenA, PRINCIPAL, RATE_500BPS, false);
        generator.registerSource(tokenB, PRINCIPAL, RATE_500BPS, false);
        vm.stopPrank();

        uint256[] memory ids = generator.getUserSources(alice);
        assertEq(ids.length, 2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Deactivation
    // ─────────────────────────────────────────────────────────────────────────

    function test_DeactivateSource_BlocksYield() public {
        uint256 id = _registerAliceSource(false);

        vm.prank(alice);
        generator.deactivateSource(id);

        assertFalse(generator.getSource(id).active);
        assertEq(generator.pendingYield(id), 0, "no yield from inactive source");
    }

    function test_DeactivateSource_RevertsIfNotOwner() public {
        uint256 id = _registerAliceSource(false);
        vm.prank(bob);
        vm.expectRevert(YieldGenerator.NotSourceOwner.selector);
        generator.deactivateSource(id);
    }

    function test_ContractOwner_CanDeactivateAnySource() public {
        uint256 id = _registerAliceSource(false);
        // deployer is owner
        generator.deactivateSource(id);
        assertFalse(generator.getSource(id).active);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_YieldScalesWithPrincipal(uint128 principal) public {
        vm.assume(principal > 1e9 && principal < 1e30);
        vm.prank(alice);
        uint256 id = generator.registerSource(tokenA, uint256(principal), RATE_500BPS, false);

        vm.warp(block.timestamp + ONE_YEAR);
        uint256 pending = generator.pendingYield(id);
        // ~5% of principal
        assertApproxEqRel(pending, uint256(principal) * 5 / 100, 1e15);
    }

    function testFuzz_RateConversionRoundtrip(uint16 rateBps) public {
        vm.assume(rateBps > 0 && rateBps <= 5_000); // 0..50% APR
        vm.prank(alice);
        uint256 id = generator.registerSource(tokenA, PRINCIPAL, rateBps, false);
        uint256 stored = generator.currentRateBps(id);
        assertApproxEqAbs(stored, rateBps, 1, "rate bps roundtrip");
    }
}
