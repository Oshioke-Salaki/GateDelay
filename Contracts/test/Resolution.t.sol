// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Resolution.sol";
import "../src/PositionToken.sol";
import "../src/LiquidityPool.sol";
import "../src/MarketFactory.sol";
import "../src/ERC20Token.sol";

/// @dev Helper: ERC1155 receiver so test contract can hold tokens
contract ERC1155Holder {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}

contract ResolutionTest is Test {
    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    ERC20Token   internal collateral;
    PositionToken internal positionToken;
    LiquidityPool internal pool;
    Resolution   internal resolution;

    // -------------------------------------------------------------------------
    // Actors
    // -------------------------------------------------------------------------
    address internal resolverAddr = address(0xBEEF1);
    address internal adminAddr    = address(0xBEEF2);
    address internal alice        = address(0xA11CE);
    address internal bob          = address(0xB0B);

    // -------------------------------------------------------------------------
    // Market
    // -------------------------------------------------------------------------
    // We use a fixed market address that we control (this test contract acts as the market)
    address internal marketAddr;

    uint256 constant INITIAL_SUPPLY  = 1_000_000;
    uint256 constant DISPUTE_WINDOW  = 1 days;
    uint256 constant DEADLINE_OFFSET = 1 hours; // deadline is 1 hour in the past after warp

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------
    function setUp() public {
        // Deploy collateral
        collateral = new ERC20Token(INITIAL_SUPPLY);

        // Deploy PositionToken — factory = address(this) so test can authorise
        positionToken = new PositionToken(address(this));

        // Use a deterministic market address (this test contract itself acts as the market)
        marketAddr = address(0xDEADBEEF);

        // Authorise marketAddr to mint/burn position tokens
        positionToken.authorise(marketAddr);

        // Deploy LiquidityPool for this market
        pool = new LiquidityPool(address(collateral), marketAddr);

        // Deploy Resolution
        resolution = new Resolution(
            DISPUTE_WINDOW,
            resolverAddr,
            adminAddr,
            address(positionToken)
        );

        // Set resolution on pool
        pool.setResolution(address(resolution));

        // Authorise Resolution contract to burn position tokens
        positionToken.authoriseBurner(address(resolution));

        // Register market in Resolution (deadline = now + 2 hours, we'll warp past it)
        uint256 deadline = block.timestamp + 2 hours;
        resolution.registerMarket(marketAddr, address(pool), deadline);

        // Fund pool with collateral (deposit as this test contract)
        collateral.approve(address(pool), 100_000 ether);
        pool.deposit(100_000 ether);

        // Fund alice and bob with collateral (for future use)
        collateral.transfer(alice, 10_000 ether);
        collateral.transfer(bob,   10_000 ether);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Warp past the resolution deadline and resolve the market
    function _resolveMarket(Resolution.Outcome outcome) internal {
        vm.warp(block.timestamp + 3 hours); // past deadline
        vm.prank(resolverAddr);
        resolution.resolve(marketAddr, outcome, bytes("ipfs://evidence"));
    }

    /// @dev Mint YES tokens to a holder (acting as the authorised market)
    function _mintYes(address to, uint256 amount) internal {
        uint256 id = positionToken.yesId(marketAddr);
        vm.prank(marketAddr);
        positionToken.mint(to, id, amount, "");
    }

    /// @dev Mint NO tokens to a holder
    function _mintNo(address to, uint256 amount) internal {
        uint256 id = positionToken.noId(marketAddr);
        vm.prank(marketAddr);
        positionToken.mint(to, id, amount, "");
    }

    // =========================================================================
    // Property-based fuzz tests
    // =========================================================================

    // Feature: prediction-market-contracts, Property 10: Resolve records outcome and sets RESOLVED status
    // Validates: Requirements 4.1
    function testFuzz_resolve_recordsOutcome(uint8 rawOutcome) public {
        // Bound to YES (1) or NO (2)
        uint8 bounded = uint8(bound(uint256(rawOutcome), 1, 2));
        Resolution.Outcome outcome = Resolution.Outcome(bounded);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolverAddr);
        resolution.resolve(marketAddr, outcome, bytes("data"));

        // Status must be RESOLVED
        assertEq(
            uint256(resolution.getMarketStatus(marketAddr)),
            uint256(MarketFactory.MarketStatus.RESOLVED),
            "status should be RESOLVED"
        );

        // Recorded outcome must match
        Resolution.ResolutionRecord memory rec = resolution.getResolutionRecord(marketAddr);
        assertEq(uint256(rec.outcome), uint256(outcome), "recorded outcome must match submitted outcome");
    }

    // Feature: prediction-market-contracts, Property 11: Non-resolver calling resolve always reverts
    // Validates: Requirements 4.3
    function testFuzz_nonResolver_reverts(address caller) public {
        vm.assume(caller != resolverAddr);
        vm.warp(block.timestamp + 3 hours);
        vm.prank(caller);
        vm.expectRevert(Resolution.NotResolver.selector);
        resolution.resolve(marketAddr, Resolution.Outcome.YES, bytes("data"));
    }

    // Feature: prediction-market-contracts, Property 12: Payout formula correctness
    // Validates: Requirements 4.6
    function testFuzz_claimPayout_formula(uint128 yesAmount, uint128 noAmount) public {
        uint256 yes = bound(uint256(yesAmount), 1, 1_000_000 ether);
        uint256 no  = bound(uint256(noAmount),  1, 1_000_000 ether);

        // Mint YES to alice, NO to bob
        _mintYes(alice, yes);
        _mintNo(bob, no);

        // Resolve YES
        _resolveMarket(Resolution.Outcome.YES);

        // Warp past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalYesSupply  = positionToken.totalSupply(positionToken.yesId(marketAddr));
        uint256 expectedPayout  = (yes * totalCollateral) / totalYesSupply;

        uint256 balanceBefore = collateral.balanceOf(alice);

        vm.prank(alice);
        resolution.claimPayout(marketAddr);

        uint256 balanceAfter = collateral.balanceOf(alice);
        assertEq(balanceAfter - balanceBefore, expectedPayout, "payout must match formula");

        // Winning tokens burned
        assertEq(positionToken.balanceOf(alice, positionToken.yesId(marketAddr)), 0, "winning tokens must be burned");
    }

    // Feature: prediction-market-contracts, Property 13: Total payouts conserve collateral
    // Validates: Requirements 4.8
    function testFuzz_totalPayouts_conservation(uint128 aliceYes, uint128 bobYes) public {
        uint256 aYes = bound(uint256(aliceYes), 1, 500_000 ether);
        uint256 bYes = bound(uint256(bobYes),   1, 500_000 ether);

        _mintYes(alice, aYes);
        _mintYes(bob,   bYes);

        _resolveMarket(Resolution.Outcome.YES);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 totalCollateralBefore = pool.totalLiquidity();

        uint256 aliceBefore = collateral.balanceOf(alice);
        uint256 bobBefore   = collateral.balanceOf(bob);

        vm.prank(alice);
        resolution.claimPayout(marketAddr);

        vm.prank(bob);
        resolution.claimPayout(marketAddr);

        uint256 alicePayout = collateral.balanceOf(alice) - aliceBefore;
        uint256 bobPayout   = collateral.balanceOf(bob)   - bobBefore;

        // Sum of payouts must equal total collateral (within 1 wei rounding)
        assertApproxEqAbs(
            alicePayout + bobPayout,
            totalCollateralBefore,
            1,
            "total payouts must conserve collateral"
        );
    }

    // Feature: prediction-market-contracts, Property 14: Dispute-then-settle round trip
    // Validates: Requirements 4.9, 4.10
    function testFuzz_disputeSettleRoundTrip(uint8 rawFinalOutcome) public {
        uint8 bounded = uint8(bound(uint256(rawFinalOutcome), 1, 2));
        Resolution.Outcome finalOutcome = Resolution.Outcome(bounded);

        // Resolve first
        _resolveMarket(Resolution.Outcome.YES);

        // Dispute within window
        vm.prank(alice);
        resolution.dispute(marketAddr, "ipfs://dispute-evidence");

        assertEq(
            uint256(resolution.getMarketStatus(marketAddr)),
            uint256(MarketFactory.MarketStatus.DISPUTED),
            "status should be DISPUTED after dispute"
        );

        // Admin settles
        vm.prank(adminAddr);
        resolution.settleDispute(marketAddr, finalOutcome);

        assertEq(
            uint256(resolution.getMarketStatus(marketAddr)),
            uint256(MarketFactory.MarketStatus.RESOLVED),
            "status should be RESOLVED after settle"
        );

        Resolution.ResolutionRecord memory rec = resolution.getResolutionRecord(marketAddr);
        assertEq(uint256(rec.outcome), uint256(finalOutcome), "outcome must match final outcome");

        // Dispute window restarted
        assertGt(resolution.getDisputeWindowEnd(marketAddr), block.timestamp, "dispute window must be restarted");
    }

    // Feature: prediction-market-contracts, Property 15: Refund on cancellation returns proportional collateral
    // Validates: Requirements 4.14
    function testFuzz_claimRefund_cancellation(uint128 aliceYes, uint128 bobNo) public {
        uint256 aYes = bound(uint256(aliceYes), 1, 500_000 ether);
        uint256 bNo  = bound(uint256(bobNo),    1, 500_000 ether);

        _mintYes(alice, aYes);
        _mintNo(bob, bNo);

        // Cancel market
        vm.prank(adminAddr);
        resolution.cancelMarket(marketAddr);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalSupply = positionToken.totalSupply(positionToken.yesId(marketAddr))
                            + positionToken.totalSupply(positionToken.noId(marketAddr));

        uint256 expectedAlice = (aYes * totalCollateral) / totalSupply;
        uint256 expectedBob   = (bNo  * totalCollateral) / totalSupply;

        uint256 aliceBefore = collateral.balanceOf(alice);
        uint256 bobBefore   = collateral.balanceOf(bob);

        vm.prank(alice);
        resolution.claimRefund(marketAddr);

        vm.prank(bob);
        resolution.claimRefund(marketAddr);

        assertEq(collateral.balanceOf(alice) - aliceBefore, expectedAlice, "alice refund must match formula");
        assertApproxEqAbs(collateral.balanceOf(bob) - bobBefore, expectedBob, 1, "bob refund must match formula");

        // Tokens burned
        assertEq(positionToken.balanceOf(alice, positionToken.yesId(marketAddr)), 0, "alice YES tokens burned");
        assertEq(positionToken.balanceOf(bob,   positionToken.noId(marketAddr)),  0, "bob NO tokens burned");
    }

    // =========================================================================
    // Unit tests — revert paths
    // =========================================================================

    function test_resolve_revertsNotResolver() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(alice);
        vm.expectRevert(Resolution.NotResolver.selector);
        resolution.resolve(marketAddr, Resolution.Outcome.YES, bytes("data"));
    }

    function test_resolve_revertsDeadlineNotPassed() public {
        // Do NOT warp — deadline is in the future
        vm.prank(resolverAddr);
        vm.expectRevert(Resolution.DeadlineNotPassed.selector);
        resolution.resolve(marketAddr, Resolution.Outcome.YES, bytes("data"));
    }

    function test_resolve_revertsMarketNotOpen() public {
        // Resolve once
        _resolveMarket(Resolution.Outcome.YES);

        // Try to resolve again
        vm.prank(resolverAddr);
        vm.expectRevert(Resolution.MarketNotOpen.selector);
        resolution.resolve(marketAddr, Resolution.Outcome.NO, bytes("data2"));
    }

    function test_resolve_revertsEmptyResolutionData() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolverAddr);
        vm.expectRevert(Resolution.EmptyResolutionData.selector);
        resolution.resolve(marketAddr, Resolution.Outcome.YES, bytes(""));
    }

    function test_dispute_revertsDisputeWindowElapsed() public {
        _resolveMarket(Resolution.Outcome.YES);
        // Warp past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        vm.prank(alice);
        vm.expectRevert(Resolution.DisputeWindowElapsed.selector);
        resolution.dispute(marketAddr, "evidence");
    }

    function test_dispute_revertsMarketNotResolved() public {
        // Market is OPEN, not RESOLVED
        vm.prank(alice);
        vm.expectRevert(Resolution.MarketNotResolved.selector);
        resolution.dispute(marketAddr, "evidence");
    }

    function test_settleDispute_revertsNotAdmin() public {
        _resolveMarket(Resolution.Outcome.YES);
        vm.prank(alice);
        resolution.dispute(marketAddr, "evidence");

        vm.prank(alice);
        vm.expectRevert(Resolution.NotAdmin.selector);
        resolution.settleDispute(marketAddr, Resolution.Outcome.NO);
    }

    function test_settleDispute_revertsMarketNotDisputed() public {
        _resolveMarket(Resolution.Outcome.YES);
        // Market is RESOLVED, not DISPUTED
        vm.prank(adminAddr);
        vm.expectRevert(Resolution.MarketNotDisputed.selector);
        resolution.settleDispute(marketAddr, Resolution.Outcome.NO);
    }

    function test_claimPayout_revertsDisputeWindowActive() public {
        _mintYes(alice, 100 ether);
        _resolveMarket(Resolution.Outcome.YES);
        // Do NOT warp past dispute window

        vm.prank(alice);
        vm.expectRevert(Resolution.DisputeWindowActive.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_claimPayout_revertsNotWinningHolder() public {
        _mintNo(alice, 100 ether); // alice holds NO, but YES wins
        _resolveMarket(Resolution.Outcome.YES);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        vm.prank(alice);
        vm.expectRevert(Resolution.NotWinningHolder.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_claimPayout_revertsMarketNotResolved() public {
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        // Market is OPEN, not RESOLVED
        vm.prank(alice);
        vm.expectRevert(Resolution.MarketNotResolved.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_claimRefund_revertsMarketNotCancelled() public {
        _mintYes(alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(Resolution.MarketNotCancelled.selector);
        resolution.claimRefund(marketAddr);
    }

    function test_cancelMarket_revertsNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(Resolution.NotAdmin.selector);
        resolution.cancelMarket(marketAddr);
    }

    // =========================================================================
    // Unit tests — events
    // =========================================================================

    function test_resolve_emitsMarketResolved() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolverAddr);
        vm.expectEmit(true, false, true, true);
        emit Resolution.MarketResolved(marketAddr, Resolution.Outcome.YES, resolverAddr);
        resolution.resolve(marketAddr, Resolution.Outcome.YES, bytes("data"));
    }

    function test_dispute_emitsDisputeRaised() public {
        _resolveMarket(Resolution.Outcome.YES);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Resolution.DisputeRaised(marketAddr, alice, "ipfs://evidence");
        resolution.dispute(marketAddr, "ipfs://evidence");
    }

    function test_claimPayout_emitsPayoutClaimed() public {
        _mintYes(alice, 100 ether);
        _resolveMarket(Resolution.Outcome.YES);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalYes = positionToken.totalSupply(positionToken.yesId(marketAddr));
        uint256 expectedPayout = (100 ether * totalCollateral) / totalYes;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Resolution.PayoutClaimed(marketAddr, alice, expectedPayout);
        resolution.claimPayout(marketAddr);
    }

    function test_claimRefund_emitsRefundClaimed() public {
        _mintYes(alice, 100 ether);

        vm.prank(adminAddr);
        resolution.cancelMarket(marketAddr);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalSupply = positionToken.totalSupply(positionToken.yesId(marketAddr))
                            + positionToken.totalSupply(positionToken.noId(marketAddr));
        uint256 expectedRefund = (100 ether * totalCollateral) / totalSupply;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Resolution.RefundClaimed(marketAddr, alice, expectedRefund);
        resolution.claimRefund(marketAddr);
    }

    // =========================================================================
    // Unit tests — dispute window boundary
    // =========================================================================

    function test_disputeWindow_exactlyAtExpiry_canDispute() public {
        _resolveMarket(Resolution.Outcome.YES);
        uint256 windowEnd = resolution.getDisputeWindowEnd(marketAddr);

        // Warp to exactly the window end — still within window (<=)
        vm.warp(windowEnd);
        vm.prank(alice);
        resolution.dispute(marketAddr, "evidence");

        assertEq(
            uint256(resolution.getMarketStatus(marketAddr)),
            uint256(MarketFactory.MarketStatus.DISPUTED)
        );
    }

    function test_disputeWindow_oneSecondAfterExpiry_cannotDispute() public {
        _resolveMarket(Resolution.Outcome.YES);
        uint256 windowEnd = resolution.getDisputeWindowEnd(marketAddr);

        vm.warp(windowEnd + 1);
        vm.prank(alice);
        vm.expectRevert(Resolution.DisputeWindowElapsed.selector);
        resolution.dispute(marketAddr, "evidence");
    }

    function test_claimPayout_exactlyAtWindowEnd_reverts() public {
        _mintYes(alice, 100 ether);
        _resolveMarket(Resolution.Outcome.YES);
        uint256 windowEnd = resolution.getDisputeWindowEnd(marketAddr);

        // Exactly at window end — still active (<=)
        vm.warp(windowEnd);
        vm.prank(alice);
        vm.expectRevert(Resolution.DisputeWindowActive.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_claimPayout_oneSecondAfterWindowEnd_succeeds() public {
        _mintYes(alice, 100 ether);
        _resolveMarket(Resolution.Outcome.YES);
        uint256 windowEnd = resolution.getDisputeWindowEnd(marketAddr);

        vm.warp(windowEnd + 1);
        vm.prank(alice);
        resolution.claimPayout(marketAddr); // should not revert
    }

    // =========================================================================
    // Unit tests — full lifecycle
    // =========================================================================

    function test_fullLifecycle_resolveAndClaim() public {
        // Mint YES to alice, NO to bob
        _mintYes(alice, 60 ether);
        _mintNo(bob, 40 ether);

        // Resolve YES
        _resolveMarket(Resolution.Outcome.YES);

        // Warp past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalYes = positionToken.totalSupply(positionToken.yesId(marketAddr));

        uint256 aliceBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        resolution.claimPayout(marketAddr);
        uint256 alicePayout = collateral.balanceOf(alice) - aliceBefore;

        uint256 expectedPayout = (60 ether * totalCollateral) / totalYes;
        assertEq(alicePayout, expectedPayout, "alice payout must match formula");

        // Bob holds NO tokens — cannot claim payout
        vm.prank(bob);
        vm.expectRevert(Resolution.NotWinningHolder.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_fullLifecycle_disputeAndSettle() public {
        _mintYes(alice, 100 ether);

        // Resolve YES
        _resolveMarket(Resolution.Outcome.YES);

        // Bob disputes
        vm.prank(bob);
        resolution.dispute(marketAddr, "ipfs://counter-evidence");

        // Admin settles with NO
        vm.prank(adminAddr);
        resolution.settleDispute(marketAddr, Resolution.Outcome.NO);

        // Warp past new dispute window
        uint256 newWindowEnd = resolution.getDisputeWindowEnd(marketAddr);
        vm.warp(newWindowEnd + 1);

        // Alice holds YES but outcome is now NO — cannot claim
        vm.prank(alice);
        vm.expectRevert(Resolution.NotWinningHolder.selector);
        resolution.claimPayout(marketAddr);
    }

    function test_fullLifecycle_cancelAndRefund() public {
        _mintYes(alice, 60 ether);
        _mintNo(bob, 40 ether);

        vm.prank(adminAddr);
        resolution.cancelMarket(marketAddr);

        uint256 totalCollateral = pool.totalLiquidity();
        uint256 totalSupply = positionToken.totalSupply(positionToken.yesId(marketAddr))
                            + positionToken.totalSupply(positionToken.noId(marketAddr));

        uint256 aliceBefore = collateral.balanceOf(alice);
        uint256 bobBefore   = collateral.balanceOf(bob);

        vm.prank(alice);
        resolution.claimRefund(marketAddr);

        vm.prank(bob);
        resolution.claimRefund(marketAddr);

        uint256 aliceRefund = collateral.balanceOf(alice) - aliceBefore;
        uint256 bobRefund   = collateral.balanceOf(bob)   - bobBefore;

        assertEq(aliceRefund, (60 ether * totalCollateral) / totalSupply, "alice refund");
        assertEq(bobRefund,   (40 ether * totalCollateral) / totalSupply, "bob refund");
    }

    // =========================================================================
    // Unit tests — view functions
    // =========================================================================

    function test_getMarketStatus_initiallyOpen() public {
        assertEq(
            uint256(resolution.getMarketStatus(marketAddr)),
            uint256(MarketFactory.MarketStatus.OPEN)
        );
    }

    function test_getResolutionRecord_afterResolve() public {
        _resolveMarket(Resolution.Outcome.NO);
        Resolution.ResolutionRecord memory rec = resolution.getResolutionRecord(marketAddr);
        assertEq(uint256(rec.outcome), uint256(Resolution.Outcome.NO));
        assertEq(rec.resolver, resolverAddr);
        assertGt(rec.resolvedAt, 0);
    }

    function test_getDisputeWindowEnd_afterResolve() public {
        uint256 before = block.timestamp;
        _resolveMarket(Resolution.Outcome.YES);
        uint256 windowEnd = resolution.getDisputeWindowEnd(marketAddr);
        assertGe(windowEnd, before + DISPUTE_WINDOW);
    }

    function test_poolStatus_updatedOnResolve() public {
        _resolveMarket(Resolution.Outcome.YES);
        assertEq(
            uint256(pool.marketStatus()),
            uint256(MarketFactory.MarketStatus.RESOLVED)
        );
    }

    function test_poolStatus_updatedOnDispute() public {
        _resolveMarket(Resolution.Outcome.YES);
        vm.prank(alice);
        resolution.dispute(marketAddr, "evidence");
        assertEq(
            uint256(pool.marketStatus()),
            uint256(MarketFactory.MarketStatus.DISPUTED)
        );
    }

    function test_poolStatus_updatedOnCancel() public {
        vm.prank(adminAddr);
        resolution.cancelMarket(marketAddr);
        assertEq(
            uint256(pool.marketStatus()),
            uint256(MarketFactory.MarketStatus.CANCELLED)
        );
    }
}
