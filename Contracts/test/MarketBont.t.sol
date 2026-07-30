// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketBond.sol";

/**
 * @title MarketBondTest
 * @notice Foundry test suite for MarketBond.sol.
 *         Covers: issuance, ownership tracking, yield calculation,
 *                 redemption, and all query helpers.
 */
contract MarketBondTest is Test {
    MarketBond internal bond;

    // Actors
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    // Common test parameters
    uint256 internal constant MARKET_ID    = 1;
    uint256 internal constant ANNUAL_RATE  = 0.05e18; // 5 %
    uint256 internal constant PRINCIPAL    = 1 ether;
    uint256 internal constant ONE_YEAR     = 365 days;

    function setUp() public {
        bond = new MarketBond();
        // Fund actors
        vm.deal(alice,   100 ether);
        vm.deal(bob,     100 ether);
        vm.deal(charlie, 100 ether);
        // Seed contract with extra ETH so yield payouts succeed in unit tests
        vm.deal(address(bond), 50 ether);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _issueAliceBond(uint256 maturity) internal returns (uint256 bondId) {
        vm.prank(alice);
        bondId = bond.issueBond{value: PRINCIPAL}(MARKET_ID, ANNUAL_RATE, maturity);
    }

    // =========================================================================
    // 1. Issuance
    // =========================================================================

    function test_issueBond_storesCorrectData() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);

        MarketBond.Bond memory b = bond.getBond(bondId);
        assertEq(b.id,           bondId,       "id");
        assertEq(b.owner,        alice,         "owner");
        assertEq(b.marketId,     MARKET_ID,     "marketId");
        assertEq(b.principal,    PRINCIPAL,     "principal");
        assertEq(b.annualRate,   ANNUAL_RATE,   "annualRate");
        assertEq(b.maturityDate, maturity,      "maturityDate");
        assertFalse(b.redeemed,                 "redeemed flag");
    }

    function test_issueBond_incrementsBondId() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 id1 = _issueAliceBond(maturity);
        uint256 id2 = _issueAliceBond(maturity);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(bond.totalBonds(), 2);
    }

    function test_issueBond_emitsEvent() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit MarketBond.BondIssued(1, alice, MARKET_ID, PRINCIPAL, ANNUAL_RATE, maturity);
        bond.issueBond{value: PRINCIPAL}(MARKET_ID, ANNUAL_RATE, maturity);
    }

    function test_issueBond_revertsOnZeroPrincipal() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        vm.expectRevert(MarketBond.Bond__InvalidPrincipal.selector);
        bond.issueBond{value: 0}(MARKET_ID, ANNUAL_RATE, maturity);
    }

    function test_issueBond_revertsOnZeroRate() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        vm.expectRevert(MarketBond.Bond__InvalidRate.selector);
        bond.issueBond{value: PRINCIPAL}(MARKET_ID, 0, maturity);
    }

    function test_issueBond_revertsOnRateGteOne() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        vm.expectRevert(MarketBond.Bond__InvalidRate.selector);
        bond.issueBond{value: PRINCIPAL}(MARKET_ID, 1e18, maturity); // rate = 100% (= ONE)
    }

    function test_issueBond_revertsOnPastMaturity() public {
        vm.prank(alice);
        vm.expectRevert(MarketBond.Bond__InvalidMaturity.selector);
        bond.issueBond{value: PRINCIPAL}(MARKET_ID, ANNUAL_RATE, block.timestamp);
    }

    // =========================================================================
    // 2. Ownership tracking
    // =========================================================================

    function test_ownershipTracking_singleBond() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        uint256[] memory ids = bond.getBondsByOwner(alice);
        assertEq(ids.length, 1);
        assertEq(ids[0], bondId);
    }

    function test_ownershipTracking_multipleBonds() public {
        uint256 m = block.timestamp + ONE_YEAR;
        _issueAliceBond(m);
        _issueAliceBond(m);
        _issueAliceBond(m);
        uint256[] memory ids = bond.getBondsByOwner(alice);
        assertEq(ids.length, 3);
    }

    function test_transferBond_updatesOwner() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        vm.prank(alice);
        bond.transferBond(bondId, bob);
        assertEq(bond.getBond(bondId).owner, bob);
    }

    function test_transferBond_addsToNewOwnerList() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        vm.prank(alice);
        bond.transferBond(bondId, bob);
        uint256[] memory bobIds = bond.getBondsByOwner(bob);
        assertEq(bobIds.length, 1);
        assertEq(bobIds[0], bondId);
    }

    function test_transferBond_emitsEvent() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit MarketBond.BondTransferred(bondId, alice, bob);
        bond.transferBond(bondId, bob);
    }

    function test_transferBond_revertsIfNotOwner() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MarketBond.Bond__NotOwner.selector, bondId, bob));
        bond.transferBond(bondId, charlie);
    }

    function test_transferBond_revertsZeroAddress() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        vm.prank(alice);
        vm.expectRevert(MarketBond.Bond__InvalidRecipient.selector);
        bond.transferBond(bondId, address(0));
    }

    function test_transferBond_revertsIfRedeemed() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);
        vm.warp(maturity + 1);
        vm.prank(alice);
        bond.redeemBond(bondId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MarketBond.Bond__AlreadyRedeemed.selector, bondId));
        bond.transferBond(bondId, bob);
    }

    // =========================================================================
    // 3. Yield calculation
    // =========================================================================

    function test_yield_atIssuanceIsZero() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        assertEq(bond.calculateYield(bondId), 0);
    }

    function test_yield_halfYear() public {
        uint256 issuedAt = block.timestamp;
        uint256 bondId = _issueAliceBond(issuedAt + ONE_YEAR);

        vm.warp(issuedAt + ONE_YEAR / 2);
        uint256 yield = bond.calculateYield(bondId);

        // Expected: 1 ether × 5% × 0.5 = 0.025 ether
        // Allow ±1 wei rounding
        uint256 expected = 0.025 ether;
        assertApproxEqAbs(yield, expected, 1, "half-year yield");
    }

    function test_yield_fullYear() public {
        uint256 issuedAt = block.timestamp;
        uint256 bondId = _issueAliceBond(issuedAt + ONE_YEAR);

        vm.warp(issuedAt + ONE_YEAR);
        uint256 yield = bond.calculateYield(bondId);

        // Expected: 1 ether × 5% = 0.05 ether
        uint256 expected = 0.05 ether;
        assertApproxEqAbs(yield, expected, 1, "full-year yield");
    }

    function test_yield_capsAtMaturity() public {
        uint256 issuedAt = block.timestamp;
        uint256 bondId = _issueAliceBond(issuedAt + ONE_YEAR);

        // Advance well past maturity
        vm.warp(issuedAt + 2 * ONE_YEAR);
        uint256 yieldPast = bond.calculateYield(bondId);

        vm.warp(issuedAt + ONE_YEAR); // exactly at maturity
        uint256 yieldAtMaturity = bond.calculateYield(bondId);

        assertEq(yieldPast, yieldAtMaturity, "yield should not grow past maturity");
    }

    function test_redemptionValue_equalsPrincipalPlusYield() public {
        uint256 issuedAt = block.timestamp;
        uint256 bondId = _issueAliceBond(issuedAt + ONE_YEAR);

        vm.warp(issuedAt + ONE_YEAR / 2);
        uint256 rv    = bond.redemptionValue(bondId);
        uint256 yield = bond.calculateYield(bondId);
        assertEq(rv, PRINCIPAL + yield);
    }

    // =========================================================================
    // 4. Redemption
    // =========================================================================

    function test_redeemBond_succeeds() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);

        vm.warp(maturity + 1);
        uint256 expectedYield = bond.calculateYield(bondId);
        uint256 expectedTotal = PRINCIPAL + expectedYield;

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        bond.redeemBond(bondId);

        assertApproxEqAbs(alice.balance - balBefore, expectedTotal, 1, "payout");
        assertTrue(bond.isBondRedeemed(bondId));
    }

    function test_redeemBond_emitsEvent() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);
        vm.warp(maturity + 1);

        uint256 yield = bond.calculateYield(bondId);
        uint256 total = PRINCIPAL + yield;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit MarketBond.BondRedeemed(bondId, alice, PRINCIPAL, yield, total);
        bond.redeemBond(bondId);
    }

    function test_redeemBond_revertsIfNotOwner() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);
        vm.warp(maturity + 1);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MarketBond.Bond__NotOwner.selector, bondId, bob));
        bond.redeemBond(bondId);
    }

    function test_redeemBond_revertsBeforeMaturity() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);

        // One second before maturity
        vm.warp(maturity - 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketBond.Bond__NotMatured.selector,
                bondId,
                maturity,
                maturity - 1
            )
        );
        bond.redeemBond(bondId);
    }

    function test_redeemBond_revertsIfAlreadyRedeemed() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);
        vm.warp(maturity + 1);

        vm.startPrank(alice);
        bond.redeemBond(bondId);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBond.Bond__AlreadyRedeemed.selector, bondId)
        );
        bond.redeemBond(bondId);
        vm.stopPrank();
    }

    function test_redeemBond_afterTransfer() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);

        vm.prank(alice);
        bond.transferBond(bondId, bob);

        vm.warp(maturity + 1);
        uint256 balBefore = bob.balance;
        vm.prank(bob);
        bond.redeemBond(bondId);
        assertTrue(bob.balance > balBefore);
    }

    // =========================================================================
    // 5. Queries
    // =========================================================================

    function test_getBondsByMarket() public {
        uint256 m = block.timestamp + ONE_YEAR;
        _issueAliceBond(m);
        _issueAliceBond(m);

        vm.prank(bob);
        bond.issueBond{value: 0.5 ether}(MARKET_ID, ANNUAL_RATE, m);

        uint256[] memory ids = bond.getBondsByMarket(MARKET_ID);
        assertEq(ids.length, 3);
    }

    function test_getBondsByMarket_differentMarkets() public {
        uint256 m = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        bond.issueBond{value: PRINCIPAL}(1, ANNUAL_RATE, m);
        vm.prank(alice);
        bond.issueBond{value: PRINCIPAL}(2, ANNUAL_RATE, m);

        assertEq(bond.getBondsByMarket(1).length, 1);
        assertEq(bond.getBondsByMarket(2).length, 1);
    }

    function test_totalBonds_tracksAllIssuances() public {
        assertEq(bond.totalBonds(), 0);
        _issueAliceBond(block.timestamp + ONE_YEAR);
        assertEq(bond.totalBonds(), 1);
        _issueAliceBond(block.timestamp + ONE_YEAR);
        assertEq(bond.totalBonds(), 2);
    }

    function test_isBondRedeemed_falseBeforeRedemption() public {
        uint256 bondId = _issueAliceBond(block.timestamp + ONE_YEAR);
        assertFalse(bond.isBondRedeemed(bondId));
    }

    function test_isBondRedeemed_trueAfterRedemption() public {
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);
        vm.warp(maturity + 1);
        vm.prank(alice);
        bond.redeemBond(bondId);
        assertTrue(bond.isBondRedeemed(bondId));
    }

    // =========================================================================
    // 6. Fuzz tests
    // =========================================================================

    function testFuzz_yieldNeverExceedsFullYearYield(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 10 * ONE_YEAR); // up to 10 years
        uint256 maturity = block.timestamp + ONE_YEAR;
        uint256 bondId = _issueAliceBond(maturity);

        vm.warp(block.timestamp + elapsed);
        uint256 yield         = bond.calculateYield(bondId);
        uint256 maxYield      = PRINCIPAL * 5 / 100; // 5% of 1 ether
        assertLe(yield, maxYield + 1, "yield must not exceed full-year cap");
    }

    function testFuzz_issueBond_storesPrincipalCorrectly(uint256 amount) public {
        amount = bound(amount, 1, 10 ether);
        uint256 maturity = block.timestamp + ONE_YEAR;
        vm.prank(alice);
        uint256 bondId = bond.issueBond{value: amount}(MARKET_ID, ANNUAL_RATE, maturity);
        assertEq(bond.getBond(bondId).principal, amount);
    }
}
