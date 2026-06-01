// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketPayout.sol";

contract MarketPayoutTest is Test {
    MarketPayout payout;
    address admin;
    address resolver;
    address alice;
    address bob;
    address charlie;
    address market1;
    address market2;

    function setUp() public {
        admin = makeAddr("admin");
        resolver = makeAddr("resolver");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        market1 = makeAddr("market1");
        market2 = makeAddr("market2");

        vm.prank(admin);
        payout = new MarketPayout(admin);
    }

    // -------------------------------------------------------------------------
    // Resolution Registration Tests
    // -------------------------------------------------------------------------

    function test_registerResolution() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        MarketPayout.MarketResolution memory resolution = payout.getResolution(
            market1
        );
        assertEq(resolution.market, market1);
        assertEq(
            uint256(resolution.outcome),
            uint256(MarketPayout.Outcome.YES)
        );
        assertEq(resolution.totalCollateral, 1000 ether);
        assertEq(resolution.resolver, resolver);
        assertTrue(resolution.finalized);
    }

    function test_registerResolution_revertsNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(MarketPayout.NotAuthorized.selector);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );
    }

    function test_registerResolution_revertsInvalidMarket() public {
        vm.prank(admin);
        vm.expectRevert(MarketPayout.InvalidMarket.selector);
        payout.registerResolution(
            address(0),
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );
    }

    function test_registerResolution_revertsInvalidOutcome() public {
        vm.prank(admin);
        vm.expectRevert(MarketPayout.InvalidOutcome.selector);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.NONE,
            1000 ether,
            resolver
        );
    }

    function test_registerResolution_revertsZeroCollateral() public {
        vm.prank(admin);
        vm.expectRevert(MarketPayout.InvalidAmount.selector);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            0,
            resolver
        );
    }

    // -------------------------------------------------------------------------
    // Payout Calculation Tests
    // -------------------------------------------------------------------------

    function test_calculatePayout_basicCalculation() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        // Alice has 25 out of 100 winning tokens
        uint256 calculatedPayout = payout.calculatePayout(
            market1,
            alice,
            25 ether,
            100 ether
        );

        // Expected: (25 / 100) * 1000 = 250 ether
        assertEq(calculatedPayout, 250 ether);
    }

    function test_calculatePayout_differentBalances() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.NO,
            5000 ether,
            resolver
        );

        // Bob has 40 out of 200 winning tokens
        uint256 calculatedPayout = payout.calculatePayout(
            market1,
            bob,
            40 ether,
            200 ether
        );

        // Expected: (40 / 200) * 5000 = 1000 ether
        assertEq(calculatedPayout, 1000 ether);
    }

    function test_calculatePayout_revertsNotResolved() public {
        vm.expectRevert(MarketPayout.MarketNotResolved.selector);
        payout.calculatePayout(market1, alice, 10 ether, 100 ether);
    }

    // -------------------------------------------------------------------------
    // Payout Initiation Tests
    // -------------------------------------------------------------------------

    function test_initiatePayout() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(record.recipient, alice);
        assertEq(record.market, market1);
        assertEq(record.amount, 250 ether);
        assertEq(record.claimedAmount, 0);
        assertEq(
            uint256(record.status),
            uint256(MarketPayout.PayoutStatus.PENDING)
        );
    }

    function test_initiatePayout_revertsNotAdmin() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(alice);
        vm.expectRevert(MarketPayout.NotAuthorized.selector);
        payout.initiatePayout(market1, alice, 250 ether);
    }

    function test_initiatePayout_revertsInvalidRecipient() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        vm.expectRevert(MarketPayout.InvalidRecipient.selector);
        payout.initiatePayout(market1, address(0), 250 ether);
    }

    function test_initiatePayout_revertsZeroAmount() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        vm.expectRevert(MarketPayout.InvalidAmount.selector);
        payout.initiatePayout(market1, alice, 0);
    }

    function test_initiateBatchPayouts() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 300 ether;
        amounts[1] = 400 ether;
        amounts[2] = 300 ether;

        vm.prank(admin);
        payout.initiateBatchPayouts(market1, recipients, amounts);

        MarketPayout.PayoutRecord memory record1 = payout.getPayoutRecord(
            market1,
            alice
        );
        MarketPayout.PayoutRecord memory record2 = payout.getPayoutRecord(
            market1,
            bob
        );
        MarketPayout.PayoutRecord memory record3 = payout.getPayoutRecord(
            market1,
            charlie
        );

        assertEq(record1.amount, 300 ether);
        assertEq(record2.amount, 400 ether);
        assertEq(record3.amount, 300 ether);
    }

    function test_initiateBatchPayouts_revertsLengthMismatch() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](3);

        vm.prank(admin);
        vm.expectRevert(MarketPayout.ArrayLengthMismatch.selector);
        payout.initiateBatchPayouts(market1, recipients, amounts);
    }

    // -------------------------------------------------------------------------
    // Payout Distribution Tests
    // -------------------------------------------------------------------------

    function test_distributePayout() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        uint256 pendingBefore = payout.getPendingDistribution(market1);
        assertEq(pendingBefore, 1000 ether);

        vm.prank(admin);
        payout.distributePayout(market1, alice);

        uint256 pendingAfter = payout.getPendingDistribution(market1);
        assertEq(pendingAfter, 750 ether);

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(record.claimedAmount, 250 ether);
        assertEq(
            uint256(record.status),
            uint256(MarketPayout.PayoutStatus.COMPLETE)
        );
    }

    function test_distributePayout_revertsNotPending() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        vm.expectRevert(MarketPayout.PayoutNotPending.selector);
        payout.distributePayout(market1, alice);
    }

    function test_distributePayout_revertsInsufficientFunds() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            100 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 150 ether);

        vm.prank(admin);
        vm.expectRevert(MarketPayout.InsufficientFunds.selector);
        payout.distributePayout(market1, alice);
    }

    function test_distributeBatchPayouts() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 300 ether;
        amounts[1] = 400 ether;
        amounts[2] = 300 ether;

        vm.prank(admin);
        payout.initiateBatchPayouts(market1, recipients, amounts);

        vm.prank(admin);
        payout.distributeBatchPayouts(market1, recipients);

        MarketPayout.PayoutRecord memory record1 = payout.getPayoutRecord(
            market1,
            alice
        );
        MarketPayout.PayoutRecord memory record2 = payout.getPayoutRecord(
            market1,
            bob
        );
        MarketPayout.PayoutRecord memory record3 = payout.getPayoutRecord(
            market1,
            charlie
        );

        assertEq(record1.claimedAmount, 300 ether);
        assertEq(record2.claimedAmount, 400 ether);
        assertEq(record3.claimedAmount, 300 ether);

        assertEq(payout.getPendingDistribution(market1), 0);
    }

    // -------------------------------------------------------------------------
    // Failure Handling Tests
    // -------------------------------------------------------------------------

    function test_markPayoutFailed() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        vm.prank(admin);
        payout.markPayoutFailed(market1, alice, "Transfer failed");

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(
            uint256(record.status),
            uint256(MarketPayout.PayoutStatus.FAILED)
        );
        assertEq(record.failureReason, "Transfer failed");
    }

    function test_retryFailedPayouts() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        vm.prank(admin);
        payout.markPayoutFailed(market1, alice, "Network error");

        address[] memory failedRecipients = new address[](1);
        failedRecipients[0] = alice;

        vm.prank(admin);
        payout.retryFailedPayouts(market1, failedRecipients);

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(
            uint256(record.status),
            uint256(MarketPayout.PayoutStatus.RETRIED)
        );
        assertEq(record.failureReason, "");
    }

    function test_getFailedRecipients() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);
        payout.initiatePayout(market1, bob, 250 ether);

        vm.prank(admin);
        payout.markPayoutFailed(market1, alice, "Error 1");
        payout.markPayoutFailed(market1, bob, "Error 2");

        address[] memory failedRecipients = payout.getFailedRecipients(market1);
        assertEq(failedRecipients.length, 2);
    }

    // -------------------------------------------------------------------------
    // Claim Tests
    // -------------------------------------------------------------------------

    function test_claimPayout() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);
        payout.distributePayout(market1, alice);

        vm.prank(alice);
        payout.claimPayout(market1);

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(record.claimedAmount, 250 ether);
        assertEq(record.claimedAt, block.timestamp);
    }

    function test_claimPayout_revertsNoClaimable() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(alice);
        vm.expectRevert(MarketPayout.NoPayoutAvailable.selector);
        payout.claimPayout(market1);
    }

    // -------------------------------------------------------------------------
    // Query Tests
    // -------------------------------------------------------------------------

    function test_getPayoutRecord() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        MarketPayout.PayoutRecord memory record = payout.getPayoutRecord(
            market1,
            alice
        );
        assertEq(record.recipient, alice);
        assertEq(record.amount, 250 ether);
    }

    function test_getMarketPayouts() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 300 ether;
        amounts[1] = 400 ether;
        amounts[2] = 300 ether;

        vm.prank(admin);
        payout.initiateBatchPayouts(market1, recipients, amounts);

        MarketPayout.PayoutRecord[] memory records = payout.getMarketPayouts(
            market1
        );
        assertEq(records.length, 3);
        assertEq(records[0].recipient, alice);
        assertEq(records[1].recipient, bob);
        assertEq(records[2].recipient, charlie);
    }

    function test_getSettlement() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 300 ether);
        payout.initiatePayout(market1, bob, 400 ether);
        payout.initiatePayout(market1, charlie, 300 ether);

        vm.prank(admin);
        payout.distributePayout(market1, alice);
        payout.distributePayout(market1, bob);
        payout.distributePayout(market1, charlie);

        MarketPayout.Settlement memory settlement = payout.getSettlement(
            market1
        );
        assertEq(settlement.market, market1);
        assertEq(settlement.totalAmount, 1000 ether);
        assertEq(settlement.distributedAmount, 1000 ether);
        assertEq(settlement.winnerCount, 3);
    }

    function test_getMarketRecipients() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);
        payout.initiatePayout(market1, bob, 250 ether);

        address[] memory recipients = payout.getMarketRecipients(market1);
        assertEq(recipients.length, 2);
    }

    function test_hasClaimablePayout() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);

        bool claimable1 = payout.hasClaimablePayout(market1, alice);
        assertFalse(claimable1); // Not yet distributed

        vm.prank(admin);
        payout.distributePayout(market1, alice);

        bool claimable2 = payout.hasClaimablePayout(market1, alice);
        assertTrue(claimable2);
    }

    function test_getClaimableAmount() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);
        payout.distributePayout(market1, alice);

        uint256 claimable = payout.getClaimableAmount(market1, alice);
        assertEq(claimable, 250 ether);
    }

    function test_getPendingDistribution() public {
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        uint256 pending1 = payout.getPendingDistribution(market1);
        assertEq(pending1, 1000 ether);

        vm.prank(admin);
        payout.initiatePayout(market1, alice, 250 ether);
        payout.distributePayout(market1, alice);

        uint256 pending2 = payout.getPendingDistribution(market1);
        assertEq(pending2, 750 ether);
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    function test_fullPayoutWorkflow() public {
        // 1. Register resolution
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        // 2. Initiate payouts
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 600 ether;
        amounts[1] = 400 ether;

        vm.prank(admin);
        payout.initiateBatchPayouts(market1, recipients, amounts);

        // 3. Distribute payouts
        vm.prank(admin);
        payout.distributeBatchPayouts(market1, recipients);

        // 4. Claim payouts
        vm.prank(alice);
        payout.claimPayout(market1);

        vm.prank(bob);
        payout.claimPayout(market1);

        // 5. Verify settlement
        MarketPayout.Settlement memory settlement = payout.getSettlement(
            market1
        );
        assertEq(settlement.distributedAmount, 1000 ether);
        assertEq(
            uint256(settlement.status),
            uint256(MarketPayout.PayoutStatus.COMPLETE)
        );
    }

    function test_partialDistributionWithFailures() public {
        // 1. Register resolution
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            1000 ether,
            resolver
        );

        // 2. Initiate payouts
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = charlie;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 300 ether;
        amounts[1] = 400 ether;
        amounts[2] = 300 ether;

        vm.prank(admin);
        payout.initiateBatchPayouts(market1, recipients, amounts);

        // 3. Distribute some payouts
        vm.prank(admin);
        payout.distributePayout(market1, alice);
        payout.distributePayout(market1, bob);

        // 4. Mark charlie's payout as failed
        payout.markPayoutFailed(market1, charlie, "User address invalid");

        // 5. Verify settlement shows partial distribution
        MarketPayout.Settlement memory settlement = payout.getSettlement(
            market1
        );
        assertEq(settlement.distributedAmount, 700 ether);
        assertEq(settlement.failedAmount, 300 ether);
        assertEq(
            uint256(settlement.status),
            uint256(MarketPayout.PayoutStatus.PARTIAL)
        );
    }

    function test_multiMarketPayouts() public {
        // Register two markets
        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            500 ether,
            resolver
        );
        payout.registerResolution(
            market2,
            MarketPayout.Outcome.NO,
            750 ether,
            resolver
        );

        // Distribute payouts for market1
        vm.prank(admin);
        payout.initiatePayout(market1, alice, 300 ether);
        payout.distributePayout(market1, alice);

        // Distribute payouts for market2
        vm.prank(admin);
        payout.initiatePayout(market2, bob, 500 ether);
        payout.distributePayout(market2, bob);

        // Verify both markets have correct pending amounts
        assertEq(payout.getPendingDistribution(market1), 200 ether);
        assertEq(payout.getPendingDistribution(market2), 250 ether);
    }

    function testFuzz_calculatePayout(
        uint256 balance,
        uint256 supply,
        uint256 collateral
    ) public {
        vm.assume(balance > 0 && balance <= 1e18);
        vm.assume(supply >= balance);
        vm.assume(collateral > 0 && collateral <= 1e18);

        vm.prank(admin);
        payout.registerResolution(
            market1,
            MarketPayout.Outcome.YES,
            collateral,
            resolver
        );

        uint256 calculated = payout.calculatePayout(
            market1,
            alice,
            balance,
            supply
        );

        // Verify calculation: (balance / supply) * collateral
        uint256 expected = (balance * collateral) / supply;
        assertEq(calculated, expected);
    }
}
