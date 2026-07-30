// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MarketYield} from "../contracts/MarketYield.sol";

contract MarketYieldTest is Test {
    MarketYield internal yieldContract;

    address internal controller = makeAddr("controller");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant MARKET_1 = 1;
    uint256 internal constant MARKET_2 = 2;

    function setUp() public {
        yieldContract = new MarketYield(controller);
        vm.deal(controller, 1000 ether);
        vm.deal(address(yieldContract), 0);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _setShares(uint256 marketId, address participant, uint256 shares) internal {
        vm.prank(controller);
        yieldContract.recordShares(marketId, participant, shares);
    }

    function _deposit(uint256 marketId, MarketYield.YieldType yType, uint256 amount) internal {
        vm.prank(controller);
        yieldContract.depositYield{value: amount}(marketId, yType);
    }

    // ---------------------------------------------------------------
    // Access control
    // ---------------------------------------------------------------

    function test_RevertWhen_RecordSharesCalledByNonController() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketYield.MarketYield__NotController.selector, alice)
        );
        yieldContract.recordShares(MARKET_1, alice, 100);
    }

    function test_RevertWhen_DepositYieldCalledByNonController() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketYield.MarketYield__NotController.selector, alice)
        );
        yieldContract.depositYield{value: 1 ether}(MARKET_1, MarketYield.YieldType.Fixed);
    }

    // ---------------------------------------------------------------
    // recordShares
    // ---------------------------------------------------------------

    function test_RecordShares_SetsInitialShares() public {
        _setShares(MARKET_1, alice, 100 ether);

        MarketYield.ParticipantPosition memory pos = yieldContract.getPosition(MARKET_1, alice);
        assertEq(pos.shares, 100 ether);
        assertEq(yieldContract.totalShares(MARKET_1), 100 ether);
    }

    function test_RecordShares_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit MarketYield.SharesUpdated(MARKET_1, alice, 50 ether);

        _setShares(MARKET_1, alice, 50 ether);
    }

    function test_RecordShares_UpdatesTotalSharesOnIncrease() public {
        _setShares(MARKET_1, alice, 100 ether);
        _setShares(MARKET_1, bob, 50 ether);
        assertEq(yieldContract.totalShares(MARKET_1), 150 ether);

        _setShares(MARKET_1, alice, 200 ether);
        assertEq(yieldContract.totalShares(MARKET_1), 250 ether);
    }

    function test_RecordShares_UpdatesTotalSharesOnDecrease() public {
        _setShares(MARKET_1, alice, 100 ether);
        _setShares(MARKET_1, bob, 50 ether);

        _setShares(MARKET_1, alice, 20 ether);
        assertEq(yieldContract.totalShares(MARKET_1), 70 ether);
    }

    function test_RecordShares_ToZero_RemovesParticipantWeight() public {
        _setShares(MARKET_1, alice, 100 ether);
        _setShares(MARKET_1, bob, 100 ether);

        _setShares(MARKET_1, alice, 0);
        assertEq(yieldContract.totalShares(MARKET_1), 100 ether);
    }

    function test_RecordShares_SettlesPendingYieldBeforeChangingShares() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        // Alice has 10 ether of claimable yield pending; changing her shares
        // should checkpoint that amount into owedUnclaimed rather than losing it.
        _setShares(MARKET_1, alice, 50 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, alice), 10 ether);

        MarketYield.ParticipantPosition memory pos = yieldContract.getPosition(MARKET_1, alice);
        assertEq(pos.owedUnclaimed, 10 ether);
        assertEq(pos.shares, 50 ether);
    }

    function test_RecordShares_IndependentAcrossMarkets() public {
        _setShares(MARKET_1, alice, 100 ether);
        _setShares(MARKET_2, alice, 1 ether);

        assertEq(yieldContract.totalShares(MARKET_1), 100 ether);
        assertEq(yieldContract.totalShares(MARKET_2), 1 ether);
    }

    // ---------------------------------------------------------------
    // depositYield
    // ---------------------------------------------------------------

    function test_RevertWhen_DepositYieldWithZeroValue() public {
        _setShares(MARKET_1, alice, 100 ether);

        vm.prank(controller);
        vm.expectRevert(MarketYield.MarketYield__ZeroAmount.selector);
        yieldContract.depositYield{value: 0}(MARKET_1, MarketYield.YieldType.Fixed);
    }

    function test_RevertWhen_DepositYieldWithNoShareholders() public {
        vm.prank(controller);
        vm.expectRevert(MarketYield.MarketYield__NoShareholders.selector);
        yieldContract.depositYield{value: 1 ether}(MARKET_1, MarketYield.YieldType.Fixed);
    }

    function test_DepositYield_UpdatesAggregateState() public {
        _setShares(MARKET_1, alice, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Variable, 5 ether);

        MarketYield.MarketYieldState memory state = yieldContract.getMarketYieldState(MARKET_1);
        assertEq(state.totalYieldDistributed, 5 ether);
        assertEq(state.distributionCount, 1);
        assertEq(state.lastDistributionTimestamp, block.timestamp);
        assertEq(yieldContract.totalYieldDistributed(MARKET_1), 5 ether);
    }

    function test_DepositYield_TracksAmountByType() public {
        _setShares(MARKET_1, alice, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 3 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Bonus, 2 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 1 ether);

        assertEq(
            yieldContract.yieldDistributedByType(MARKET_1, MarketYield.YieldType.Fixed),
            4 ether
        );
        assertEq(
            yieldContract.yieldDistributedByType(MARKET_1, MarketYield.YieldType.Bonus),
            2 ether
        );
        assertEq(
            yieldContract.yieldDistributedByType(MARKET_1, MarketYield.YieldType.Variable),
            0
        );
    }

    function test_DepositYield_AppendsDistributionRecord() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 4 ether);

        assertEq(yieldContract.getDistributionCount(MARKET_1), 1);

        MarketYield.DistributionRecord[] memory hist = yieldContract.getDistributionHistory(MARKET_1);
        assertEq(hist.length, 1);
        assertEq(hist[0].marketId, MARKET_1);
        assertEq(uint256(hist[0].yieldType), uint256(MarketYield.YieldType.Fixed));
        assertEq(hist[0].amount, 4 ether);
        assertEq(hist[0].totalSharesAtDistribution, 100 ether);
        assertEq(hist[0].timestamp, block.timestamp);
    }

    function test_DepositYield_EmitsEvent() public {
        _setShares(MARKET_1, alice, 100 ether);

        vm.expectEmit(true, true, false, true);
        emit MarketYield.YieldDeposited(MARKET_1, MarketYield.YieldType.Bonus, 7 ether, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Bonus, 7 ether);
    }

    function test_DepositYield_MultipleDepositsAccumulateIndex() public {
        _setShares(MARKET_1, alice, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, alice), 20 ether);
    }

    // ---------------------------------------------------------------
    // claimableYield / claimYield - proportional distribution
    // ---------------------------------------------------------------

    function test_ClaimableYield_SplitsProportionallyAcrossParticipants() public {
        _setShares(MARKET_1, alice, 75 ether);
        _setShares(MARKET_1, bob, 25 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 100 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, alice), 75 ether);
        assertEq(yieldContract.claimableYield(MARKET_1, bob), 25 ether);
    }

    function test_ClaimableYield_ZeroForParticipantWithNoShares() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, carol), 0);
    }

    function test_ClaimableYield_NewParticipantDoesNotRetroactivelyEarn() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        // Bob joins after the deposit; he should not earn yield distributed before he had shares.
        _setShares(MARKET_1, bob, 100 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, bob), 0);
        assertEq(yieldContract.claimableYield(MARKET_1, alice), 10 ether);
    }

    function test_RevertWhen_ClaimYieldWithNothingToClaim() public {
        _setShares(MARKET_1, alice, 100 ether);

        vm.prank(alice);
        vm.expectRevert(MarketYield.MarketYield__NothingToClaim.selector);
        yieldContract.claimYield(MARKET_1);
    }

    function test_ClaimYield_TransfersFundsAndUpdatesPosition() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        uint256 balanceBefore = alice.balance;

        vm.prank(alice);
        uint256 claimed = yieldContract.claimYield(MARKET_1);

        assertEq(claimed, 10 ether);
        assertEq(alice.balance, balanceBefore + 10 ether);
        assertEq(yieldContract.claimableYield(MARKET_1, alice), 0);

        MarketYield.ParticipantPosition memory pos = yieldContract.getPosition(MARKET_1, alice);
        assertEq(pos.claimedTotal, 10 ether);
        assertEq(pos.owedUnclaimed, 0);
    }

    function test_ClaimYield_EmitsEvent() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        vm.expectEmit(true, true, false, true);
        emit MarketYield.YieldClaimed(MARKET_1, alice, 10 ether);

        vm.prank(alice);
        yieldContract.claimYield(MARKET_1);
    }

    function test_ClaimYield_OnlyClaimsOwnShareNotOthers() public {
        _setShares(MARKET_1, alice, 50 ether);
        _setShares(MARKET_1, bob, 50 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 20 ether);

        vm.prank(alice);
        yieldContract.claimYield(MARKET_1);

        assertEq(yieldContract.claimableYield(MARKET_1, bob), 10 ether);
    }

    function test_ClaimYield_AccruesAgainAfterFreshDeposit() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        vm.prank(alice);
        yieldContract.claimYield(MARKET_1);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 5 ether);
        assertEq(yieldContract.claimableYield(MARKET_1, alice), 5 ether);

        vm.prank(alice);
        uint256 secondClaim = yieldContract.claimYield(MARKET_1);
        assertEq(secondClaim, 5 ether);

        MarketYield.ParticipantPosition memory pos = yieldContract.getPosition(MARKET_1, alice);
        assertEq(pos.claimedTotal, 15 ether);
    }

    function test_RevertWhen_ClaimYieldWithInsufficientContractBalance() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        // Forcibly reduce the contract's ETH balance below its accounted
        // liabilities to simulate a shortfall (e.g. funds swept elsewhere).
        vm.deal(address(yieldContract), 1 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketYield.MarketYield__InsufficientFunds.selector,
                10 ether,
                1 ether
            )
        );
        yieldContract.claimYield(MARKET_1);
    }

    // ---------------------------------------------------------------
    // Multiple markets isolation
    // ---------------------------------------------------------------

    function test_Markets_YieldIsolatedBetweenMarkets() public {
        _setShares(MARKET_1, alice, 100 ether);
        _setShares(MARKET_2, alice, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        assertEq(yieldContract.claimableYield(MARKET_1, alice), 10 ether);
        assertEq(yieldContract.claimableYield(MARKET_2, alice), 0);
    }

    // ---------------------------------------------------------------
    // effectiveAnnualRate
    // ---------------------------------------------------------------

    function test_EffectiveAnnualRate_ZeroWhenNoShares() public {
        assertEq(yieldContract.effectiveAnnualRate(MARKET_1), 0);
    }

    function test_EffectiveAnnualRate_ZeroWhenNoDistributions() public {
        _setShares(MARKET_1, alice, 100 ether);
        assertEq(yieldContract.effectiveAnnualRate(MARKET_1), 0);
    }

    function test_EffectiveAnnualRate_ZeroWhenSameBlockAsFirstDistribution() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        // elapsed == 0 since no time has passed since the first distribution
        assertEq(yieldContract.effectiveAnnualRate(MARKET_1), 0);
    }

    function test_EffectiveAnnualRate_AnnualizesOverElapsedTime() public {
        _setShares(MARKET_1, alice, 100 ether);
        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 10 ether);

        // Move forward 30 days; yieldPerShare so far is 0.1 (10/100).
        vm.warp(block.timestamp + 30 days);

        uint256 rate = yieldContract.effectiveAnnualRate(MARKET_1);

        // yieldPerShare (0.1) annualized over 30 days -> 0.1 * (365/30) ≈ 1.2167
        uint256 expected = (10 ether * 1e18 / 100 ether) * (365 days * 1e18 / 30 days) / 1e18;
        assertApproxEqRel(rate, expected, 1e12); // tight tolerance for rounding
    }

    // ---------------------------------------------------------------
    // View / getter sanity
    // ---------------------------------------------------------------

    function test_GetDistributionHistory_ReturnsAllRecordsInOrder() public {
        _setShares(MARKET_1, alice, 100 ether);

        _deposit(MARKET_1, MarketYield.YieldType.Fixed, 1 ether);
        vm.warp(block.timestamp + 1 days);
        _deposit(MARKET_1, MarketYield.YieldType.Variable, 2 ether);

        MarketYield.DistributionRecord[] memory hist = yieldContract.getDistributionHistory(MARKET_1);
        assertEq(hist.length, 2);
        assertEq(uint256(hist[0].yieldType), uint256(MarketYield.YieldType.Fixed));
        assertEq(uint256(hist[1].yieldType), uint256(MarketYield.YieldType.Variable));
        assertTrue(hist[1].timestamp > hist[0].timestamp);
    }

    function test_ReceiveFunction_AcceptsPlainTransfers() public {
        vm.deal(address(this), 1 ether);
        (bool ok, ) = payable(address(yieldContract)).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(yieldContract).balance, 1 ether);
    }

    // ---------------------------------------------------------------
    // Fuzz tests
    // ---------------------------------------------------------------

    function testFuzz_ProportionalSplitAlwaysSumsToDeposit(
        uint96 sharesA,
        uint96 sharesB,
        uint96 depositAmount
    ) public {
        vm.assume(sharesA > 0 && sharesB > 0);
        vm.assume(uint256(sharesA) + uint256(sharesB) < type(uint128).max);
        vm.assume(depositAmount > 0 && depositAmount < 1000 ether);

        vm.deal(controller, uint256(depositAmount) + 1 ether);

        _setShares(MARKET_1, alice, sharesA);
        _setShares(MARKET_1, bob, sharesB);

        vm.prank(controller);
        yieldContract.depositYield{value: depositAmount}(MARKET_1, MarketYield.YieldType.Fixed);

        uint256 aliceClaim = yieldContract.claimableYield(MARKET_1, alice);
        uint256 bobClaim = yieldContract.claimableYield(MARKET_1, bob);

        // Due to integer division/rounding, the sum should be <= the deposit
        // and never exceed it (no value fabricated out of thin air).
        assertLe(aliceClaim + bobClaim, depositAmount);
    }

    function testFuzz_RecordSharesNeverUnderflowsTotal(
        uint96 initialShares,
        uint96 updatedShares
    ) public {
        _setShares(MARKET_1, alice, initialShares);
        _setShares(MARKET_1, alice, updatedShares);

        assertEq(yieldContract.totalShares(MARKET_1), updatedShares);
    }
}
