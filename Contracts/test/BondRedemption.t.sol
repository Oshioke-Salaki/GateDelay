// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BondRedemption.sol";

contract BondRedemptionTest is Test {
    BondRedemption internal redemption;

    address internal registrar = makeAddr("registrar");
    address internal alice     = makeAddr("alice");
    address internal bob       = makeAddr("bob");

    uint256 internal constant MARKET_ID   = 1;
    uint256 internal constant RATE        = 0.05e18; // 5%
    uint256 internal constant PRINCIPAL   = 1 ether;
    uint256 internal constant ONE_YEAR    = 365 days;

    function setUp() public {
        redemption = new BondRedemption(registrar);
        vm.deal(registrar, 1000 ether);
        vm.deal(address(redemption), 100 ether); // pre-fund for yield payouts in tests
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _registerAliceBond(uint256 bondId, uint256 maturity) internal {
        vm.prank(registrar);
        redemption.registerBond{value: PRINCIPAL}(
            bondId, alice, MARKET_ID, PRINCIPAL, RATE, maturity
        );
    }

    // =========================================================================
    // 1. Registration
    // =========================================================================

    function test_registerBond_storesCorrectly() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);

        BondRedemption.RedeemableBond memory b = redemption.getBond(1);
        assertEq(b.owner, alice);
        assertEq(b.marketId, MARKET_ID);
        assertEq(b.originalPrincipal, PRINCIPAL);
        assertEq(b.remainingPrincipal, PRINCIPAL);
        assertEq(b.annualRate, RATE);
        assertEq(b.maturityDate, maturity);
        assertFalse(b.fullyRedeemed);
        assertTrue(b.registered);
    }

    function test_registerBond_emitsEvent() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(registrar);
        vm.expectEmit(true, true, true, true);
        emit BondRedemption.BondRegistered(1, alice, MARKET_ID, PRINCIPAL, RATE, maturity);
        redemption.registerBond{value: PRINCIPAL}(1, alice, MARKET_ID, PRINCIPAL, RATE, maturity);
    }

    function test_registerBond_revertsIfNotRegistrar() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BondRedemption.BondRedemption__NotRegistrar.selector, alice)
        );
        redemption.registerBond{value: PRINCIPAL}(
            1, alice, MARKET_ID, PRINCIPAL, RATE, block.timestamp + ONE_YEAR
        );
    }

    function test_registerBond_revertsIfAlreadyRegistered() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);

        vm.prank(registrar);
        vm.expectRevert(
            abi.encodeWithSelector(BondRedemption.BondRedemption__AlreadyRegistered.selector, 1)
        );
        redemption.registerBond{value: PRINCIPAL}(1, alice, MARKET_ID, PRINCIPAL, RATE, maturity);
    }

    function test_registerBond_revertsOnZeroOwner() public {
        vm.prank(registrar);
        vm.expectRevert(BondRedemption.BondRedemption__InvalidOwner.selector);
        redemption.registerBond{value: PRINCIPAL}(
            1, address(0), MARKET_ID, PRINCIPAL, RATE, block.timestamp + ONE_YEAR
        );
    }

    // =========================================================================
    // 2. Redemption value calculation
    // =========================================================================

    function test_calculateAccruedYield_zeroAtRegistration() public {
        _registerAliceBond(1, block.timestamp + ONE_YEAR);
        assertEq(redemption.calculateAccruedYield(1), 0);
    }

    function test_calculateAccruedYield_halfYear() public {
        uint256 start = block.timestamp;
        _registerAliceBond(1, start + ONE_YEAR);

        vm.warp(start + ONE_YEAR / 2);
        uint256 yield = redemption.calculateAccruedYield(1);
        assertApproxEqAbs(yield, 0.025 ether, 1);
    }

    function test_redeemableValue_equalsPrincipalPlusYield() public {
        uint256 start = block.timestamp;
        _registerAliceBond(1, start + ONE_YEAR);
        vm.warp(start + ONE_YEAR);

        uint256 val = redemption.redeemableValue(1);
        uint256 yield = redemption.calculateAccruedYield(1);
        assertEq(val, PRINCIPAL + yield);
    }

    function test_calculateAccruedYield_capsAtMaturity() public {
        uint256 start = block.timestamp;
        _registerAliceBond(1, start + ONE_YEAR);

        vm.warp(start + 2 * ONE_YEAR);
        uint256 yieldFarPast = redemption.calculateAccruedYield(1);

        vm.warp(start + ONE_YEAR);
        uint256 yieldAtMaturity = redemption.calculateAccruedYield(1);

        assertEq(yieldFarPast, yieldAtMaturity);
    }

    // =========================================================================
    // 3. Full redemption
    // =========================================================================

    function test_redeemFull_paysPrincipalPlusYield() public {
        uint256 start = block.timestamp;
        _registerAliceBond(1, start + ONE_YEAR);
        vm.warp(start + ONE_YEAR);

        uint256 expectedYield = redemption.calculateAccruedYield(1);
        uint256 expectedTotal = PRINCIPAL + expectedYield;

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        redemption.redeemFull(1);

        assertApproxEqAbs(alice.balance - balBefore, expectedTotal, 1);
        assertTrue(redemption.isFullyRedeemed(1));
        assertEq(redemption.remainingPrincipal(1), 0);
    }

    function test_redeemFull_revertsIfNotOwner() public {
        _registerAliceBond(1, block.timestamp + ONE_YEAR);
        vm.warp(block.timestamp + ONE_YEAR);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(BondRedemption.BondRedemption__NotOwner.selector, 1, bob)
        );
        redemption.redeemFull(1);
    }

    function test_redeemFull_revertsBeforeMaturity() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);

        vm.warp(maturity - 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BondRedemption.BondRedemption__NotMatured.selector, 1, maturity, maturity - 1
            )
        );
        redemption.redeemFull(1);
    }

    function test_redeemFull_revertsIfAlreadyFullyRedeemed() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.startPrank(alice);
        redemption.redeemFull(1);
        vm.expectRevert(
            abi.encodeWithSelector(BondRedemption.BondRedemption__FullyRedeemed.selector, 1)
        );
        redemption.redeemFull(1);
        vm.stopPrank();
    }

    // =========================================================================
    // 4. Partial redemption
    // =========================================================================

    function test_redeemPartial_reducesRemainingPrincipal() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.prank(alice);
        redemption.redeemPartial(1, 0.4 ether);

        assertEq(redemption.remainingPrincipal(1), 0.6 ether);
        assertFalse(redemption.isFullyRedeemed(1));
    }

    function test_redeemPartial_paysProRataYield() public {
        uint256 start = block.timestamp;
        uint256 maturity = start + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        uint256 totalYieldBeforeRedeem = redemption.calculateAccruedYield(1); // ~0.05 ether
        uint256 expectedSliceYield = totalYieldBeforeRedeem / 2; // redeeming 50% of principal

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        redemption.redeemPartial(1, 0.5 ether);
        uint256 received = alice.balance - balBefore;

        assertApproxEqAbs(received, 0.5 ether + expectedSliceYield, 2);
    }

    function test_redeemPartial_multipleRedemptionsSumToFull() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.startPrank(alice);
        redemption.redeemPartial(1, 0.3 ether);
        redemption.redeemPartial(1, 0.3 ether);
        redemption.redeemPartial(1, 0.4 ether); // exactly exhausts remaining
        vm.stopPrank();

        assertEq(redemption.remainingPrincipal(1), 0);
        assertTrue(redemption.isFullyRedeemed(1));
    }

    function test_redeemPartial_lastSliceMarksFullyRedeemed() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.prank(alice);
        redemption.redeemPartial(1, PRINCIPAL); // partial call but redeems 100%
        assertTrue(redemption.isFullyRedeemed(1));
    }

    function test_redeemPartial_revertsOnZeroAmount() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.prank(alice);
        vm.expectRevert(BondRedemption.BondRedemption__ZeroAmount.selector);
        redemption.redeemPartial(1, 0);
    }

    function test_redeemPartial_revertsIfExceedsRemaining() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BondRedemption.BondRedemption__InvalidAmount.selector, 2 ether, PRINCIPAL
            )
        );
        redemption.redeemPartial(1, 2 ether);
    }

    function test_redeemPartial_revertsIfAlreadyFullyRedeemed() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.startPrank(alice);
        redemption.redeemPartial(1, PRINCIPAL);
        vm.expectRevert(
            abi.encodeWithSelector(BondRedemption.BondRedemption__FullyRedeemed.selector, 1)
        );
        redemption.redeemPartial(1, 0.1 ether);
        vm.stopPrank();
    }

    function test_redeemPartial_accrualResetsAfterEachRedemption() public {
        uint256 start = block.timestamp;
        uint256 maturity = start + ONE_YEAR;
        _registerAliceBond(1, maturity);

        // Warp to maturity, redeem half
        vm.warp(maturity);
        vm.prank(alice);
        redemption.redeemPartial(1, 0.5 ether);

        // Immediately after partial redemption, accrued yield on the
        // remaining principal should reset to (near) zero since accrualStart
        // was just updated and we're already at/after maturity cap.
        uint256 yieldRightAfter = redemption.calculateAccruedYield(1);
        assertEq(yieldRightAfter, 0);
    }

    // =========================================================================
    // 5. History tracking
    // =========================================================================

    function test_history_recordsEachRedemption() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.startPrank(alice);
        redemption.redeemPartial(1, 0.3 ether);
        redemption.redeemPartial(1, 0.7 ether);
        vm.stopPrank();

        assertEq(redemption.getRedemptionCount(1), 2);
        BondRedemption.RedemptionRecord[] memory hist = redemption.getRedemptionHistory(1);
        assertEq(hist[0].principalRedeemed, 0.3 ether);
        assertEq(hist[1].principalRedeemed, 0.7 ether);
        assertTrue(hist[1].wasFullRedemption);
        assertFalse(hist[0].wasFullRedemption);
    }

    function test_history_recordHasCorrectRedeemerAndTimestamp() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity + 100);

        vm.prank(alice);
        redemption.redeemFull(1);

        BondRedemption.RedemptionRecord memory rec = redemption.getRedemptionRecord(1, 0);
        assertEq(rec.redeemer, alice);
        assertEq(rec.timestamp, maturity + 100);
    }

    function test_history_emptyForUnredeemedBond() public {
        _registerAliceBond(1, block.timestamp + ONE_YEAR);
        assertEq(redemption.getRedemptionCount(1), 0);
    }

    function test_globalTotals_trackAcrossBonds() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);

        vm.prank(registrar);
        redemption.registerBond{value: 2 ether}(2, bob, MARKET_ID, 2 ether, RATE, maturity);

        vm.warp(maturity);
        vm.prank(alice);
        redemption.redeemFull(1);
        vm.prank(bob);
        redemption.redeemFull(2);

        assertEq(redemption.totalPrincipalRedeemed(), PRINCIPAL + 2 ether);
        assertTrue(redemption.totalYieldPaid() > 0);
    }

    // =========================================================================
    // 6. Queries
    // =========================================================================

    function test_getBondsRedeemedBy_tracksRedeemer() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.prank(alice);
        redemption.redeemFull(1);

        uint256[] memory ids = redemption.getBondsRedeemedBy(alice);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_remainingPrincipal_decreasesWithPartials() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        assertEq(redemption.remainingPrincipal(1), PRINCIPAL);
        vm.prank(alice);
        redemption.redeemPartial(1, 0.25 ether);
        assertEq(redemption.remainingPrincipal(1), 0.75 ether);
    }

    function test_isFullyRedeemed_falseInitially() public {
        _registerAliceBond(1, block.timestamp + ONE_YEAR);
        assertFalse(redemption.isFullyRedeemed(1));
    }

    // =========================================================================
    // 7. Fuzz
    // =========================================================================

    function testFuzz_partialRedemptionsNeverExceedOriginalPrincipal(uint256 slice1, uint256 slice2)
        public
    {
        slice1 = bound(slice1, 0.01 ether, 0.5 ether);
        slice2 = bound(slice2, 0.01 ether, PRINCIPAL - slice1);

        uint256 maturity = block.timestamp + ONE_YEAR;
        _registerAliceBond(1, maturity);
        vm.warp(maturity);

        vm.startPrank(alice);
        redemption.redeemPartial(1, slice1);
        redemption.redeemPartial(1, slice2);
        vm.stopPrank();

        assertEq(redemption.remainingPrincipal(1), PRINCIPAL - slice1 - slice2);
    }
}