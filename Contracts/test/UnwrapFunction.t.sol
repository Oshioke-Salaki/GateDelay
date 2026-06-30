// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UnwrapFunction} from "../contracts/UnwrapFunction.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract UnwrapFunctionTest is Test {
    UnwrapFunction internal unwrapContract;
    MockToken internal token;

    address internal controller = makeAddr("controller");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant MARKET_1 = 1;
    uint256 internal constant MARKET_2 = 2;

    function setUp() public {
        unwrapContract = new UnwrapFunction(controller);
        token = new MockToken();

        // Fund the contract itself, since in production the wrap side would have
        // deposited the underlying here before crediting a wrapped balance.
        token.mint(address(unwrapContract), 10_000 ether);
    }

    function _configureMarket(
        uint256 marketId,
        uint256 maxPerTx,
        uint256 maxPerPeriod,
        uint256 periodDuration
    ) internal {
        vm.prank(controller);
        unwrapContract.configureMarket(marketId, address(token), maxPerTx, maxPerPeriod, periodDuration);
    }

    function _credit(uint256 marketId, address participant, uint256 amount) internal {
        vm.prank(controller);
        unwrapContract.creditWrappedBalance(marketId, participant, amount);
    }

    // ---------------------------------------------------------------
    // Access control
    // ---------------------------------------------------------------

    function test_RevertWhen_ConfigureMarketCalledByNonController() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__NotController.selector, alice)
        );
        unwrapContract.configureMarket(MARKET_1, address(token), 0, 0, 0);
    }

    function test_RevertWhen_CreditWrappedBalanceCalledByNonController() public {
        _configureMarket(MARKET_1, 0, 0, 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__NotController.selector, alice)
        );
        unwrapContract.creditWrappedBalance(MARKET_1, alice, 10 ether);
    }

    function test_RevertWhen_UpdateUnwrapLimitsCalledByNonController() public {
        _configureMarket(MARKET_1, 0, 0, 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__NotController.selector, alice)
        );
        unwrapContract.updateUnwrapLimits(MARKET_1, 1 ether, 1 ether, 1 days);
    }

    // ---------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------

    function test_ConfigureMarket_SetsConfigAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit UnwrapFunction.MarketConfigured(MARKET_1, address(token), 50 ether, 100 ether, 1 days);

        _configureMarket(MARKET_1, 50 ether, 100 ether, 1 days);

        UnwrapFunction.MarketUnwrapConfig memory cfg = unwrapContract.getMarketConfig(MARKET_1);
        assertEq(cfg.token, address(token));
        assertEq(cfg.maxUnwrapPerTx, 50 ether);
        assertEq(cfg.maxUnwrapPerPeriod, 100 ether);
        assertEq(cfg.periodDuration, 1 days);
        assertTrue(cfg.active);
        assertTrue(unwrapContract.isMarketActive(MARKET_1));
    }

    function test_RevertWhen_ConfiguringMarketTwice() public {
        _configureMarket(MARKET_1, 0, 0, 0);

        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__MarketAlreadyConfigured.selector, MARKET_1)
        );
        unwrapContract.configureMarket(MARKET_1, address(token), 0, 0, 0);
    }

    function test_RevertWhen_ConfiguringWithZeroAddressToken() public {
        vm.prank(controller);
        vm.expectRevert(UnwrapFunction.UnwrapFunction__InvalidToken.selector);
        unwrapContract.configureMarket(MARKET_1, address(0), 0, 0, 0);
    }

    function test_UpdateUnwrapLimits_UpdatesConfigAndEmitsEvent() public {
        _configureMarket(MARKET_1, 10 ether, 20 ether, 1 days);

        vm.expectEmit(true, false, false, true);
        emit UnwrapFunction.UnwrapLimitsUpdated(MARKET_1, 30 ether, 60 ether, 7 days);

        vm.prank(controller);
        unwrapContract.updateUnwrapLimits(MARKET_1, 30 ether, 60 ether, 7 days);

        UnwrapFunction.MarketUnwrapConfig memory cfg = unwrapContract.getMarketConfig(MARKET_1);
        assertEq(cfg.maxUnwrapPerTx, 30 ether);
        assertEq(cfg.maxUnwrapPerPeriod, 60 ether);
        assertEq(cfg.periodDuration, 7 days);
    }

    function test_RevertWhen_UpdatingLimitsOnInactiveMarket() public {
        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__MarketNotActive.selector, MARKET_1)
        );
        unwrapContract.updateUnwrapLimits(MARKET_1, 1 ether, 1 ether, 1 days);
    }

    // ---------------------------------------------------------------
    // creditWrappedBalance()
    // ---------------------------------------------------------------

    function test_RevertWhen_CreditingOnInactiveMarket() public {
        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__MarketNotActive.selector, MARKET_1)
        );
        unwrapContract.creditWrappedBalance(MARKET_1, alice, 10 ether);
    }

    function test_RevertWhen_CreditingZeroAmount() public {
        _configureMarket(MARKET_1, 0, 0, 0);

        vm.prank(controller);
        vm.expectRevert(UnwrapFunction.UnwrapFunction__ZeroAmount.selector);
        unwrapContract.creditWrappedBalance(MARKET_1, alice, 0);
    }

    function test_CreditWrappedBalance_AccumulatesAndEmitsEvent() public {
        _configureMarket(MARKET_1, 0, 0, 0);

        vm.expectEmit(true, true, false, true);
        emit UnwrapFunction.WrappedBalanceCredited(MARKET_1, alice, 40 ether, 40 ether);

        _credit(MARKET_1, alice, 40 ether);
        _credit(MARKET_1, alice, 10 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 50 ether);
    }

    // ---------------------------------------------------------------
    // unwrap() - basic + partial
    // ---------------------------------------------------------------

    function test_RevertWhen_UnwrappingOnInactiveMarket() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(UnwrapFunction.UnwrapFunction__MarketNotActive.selector, MARKET_1)
        );
        unwrapContract.unwrap(MARKET_1, 10 ether);
    }

    function test_RevertWhen_UnwrappingZeroAmount() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 10 ether);

        vm.prank(alice);
        vm.expectRevert(UnwrapFunction.UnwrapFunction__ZeroAmount.selector);
        unwrapContract.unwrap(MARKET_1, 0);
    }

    function test_RevertWhen_UnwrappingMoreThanWrappedBalance() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 10 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnwrapFunction.UnwrapFunction__InsufficientWrappedBalance.selector,
                20 ether,
                10 ether
            )
        );
        unwrapContract.unwrap(MARKET_1, 20 ether);
    }

    function test_Unwrap_FullAmount_TransfersTokensAndZeroesBalance() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 50 ether);

        uint256 aliceBalanceBefore = token.balanceOf(alice);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 50 ether);

        assertEq(token.balanceOf(alice), aliceBalanceBefore + 50 ether);
        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 0);
    }

    function test_Unwrap_PartialAmount_LeavesRemainingBalance() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 50 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 30 ether);
        assertEq(token.balanceOf(alice), 20 ether);
    }

    function test_Unwrap_MarksPartialFlagCorrectly() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 50 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether); // partial

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 30 ether); // exactly drains remaining balance, not partial

        UnwrapFunction.UnwrapRecord[] memory hist = unwrapContract.getUnwrapHistory(MARKET_1);
        assertTrue(hist[0].wasPartial);
        assertFalse(hist[1].wasPartial);
    }

    function test_Unwrap_MultiplePartialUnwrapsAccumulateCorrectly() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 100 ether);

        vm.startPrank(alice);
        unwrapContract.unwrap(MARKET_1, 10 ether);
        unwrapContract.unwrap(MARKET_1, 25 ether);
        unwrapContract.unwrap(MARKET_1, 5 ether);
        vm.stopPrank();

        UnwrapFunction.UnwrapPosition memory pos = unwrapContract.getPosition(MARKET_1, alice);
        assertEq(pos.totalUnwrapped, 40 ether);
        assertEq(pos.wrappedBalance, 60 ether);
        assertEq(pos.unwrapCount, 3);
        assertEq(token.balanceOf(alice), 40 ether);
    }

    function test_Unwrap_EmitsEvent() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 50 ether);

        vm.expectEmit(true, true, false, true);
        emit UnwrapFunction.Unwrapped(MARKET_1, alice, 20 ether, 30 ether, true);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether);
    }

    function test_Unwrap_IndependentAcrossMarkets() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _configureMarket(MARKET_2, 0, 0, 0);
        _credit(MARKET_1, alice, 10 ether);
        _credit(MARKET_2, alice, 5 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 10 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 0);
        assertEq(unwrapContract.wrappedBalanceOf(MARKET_2, alice), 5 ether);
    }

    // ---------------------------------------------------------------
    // Per-transaction limit
    // ---------------------------------------------------------------

    function test_RevertWhen_UnwrapExceedsPerTxLimit() public {
        _configureMarket(MARKET_1, 20 ether, 0, 0);
        _credit(MARKET_1, alice, 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnwrapFunction.UnwrapFunction__ExceedsPerTxLimit.selector,
                25 ether,
                20 ether
            )
        );
        unwrapContract.unwrap(MARKET_1, 25 ether);
    }

    function test_Unwrap_SucceedsExactlyAtPerTxLimit() public {
        _configureMarket(MARKET_1, 20 ether, 0, 0);
        _credit(MARKET_1, alice, 100 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 80 ether);
    }

    function test_PerTxLimit_AllowsMultipleSeparateUnwraps() public {
        _configureMarket(MARKET_1, 20 ether, 0, 0);
        _credit(MARKET_1, alice, 100 ether);

        vm.startPrank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether);
        unwrapContract.unwrap(MARKET_1, 20 ether);
        vm.stopPrank();

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 60 ether);
    }

    // ---------------------------------------------------------------
    // Per-period limit
    // ---------------------------------------------------------------

    function test_RevertWhen_UnwrapExceedsPeriodLimit() public {
        _configureMarket(MARKET_1, 0, 50 ether, 1 days);
        _credit(MARKET_1, alice, 200 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 30 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnwrapFunction.UnwrapFunction__ExceedsPeriodLimit.selector,
                30 ether,
                20 ether
            )
        );
        unwrapContract.unwrap(MARKET_1, 30 ether);
    }

    function test_PeriodLimit_ResetsAfterPeriodElapses() public {
        _configureMarket(MARKET_1, 0, 50 ether, 1 days);
        _credit(MARKET_1, alice, 200 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 50 ether);

        vm.warp(block.timestamp + 1 days + 1);

        // Should succeed again now that the period has rolled over.
        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 50 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 100 ether);
    }

    function test_PeriodLimit_IsPerParticipantNotGlobal() public {
        _configureMarket(MARKET_1, 0, 50 ether, 1 days);
        _credit(MARKET_1, alice, 100 ether);
        _credit(MARKET_1, bob, 100 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 50 ether);

        // Bob's own period allowance is untouched by Alice's usage.
        vm.prank(bob);
        unwrapContract.unwrap(MARKET_1, 50 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 50 ether);
        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, bob), 50 ether);
    }

    function test_RemainingPeriodCapacity_ReflectsUsageWithinWindow() public {
        _configureMarket(MARKET_1, 0, 50 ether, 1 days);
        _credit(MARKET_1, alice, 100 ether);

        assertEq(unwrapContract.remainingPeriodCapacity(MARKET_1, alice), 50 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 20 ether);

        assertEq(unwrapContract.remainingPeriodCapacity(MARKET_1, alice), 30 ether);
    }

    function test_RemainingPeriodCapacity_ResetsViewAfterWindowElapses() public {
        _configureMarket(MARKET_1, 0, 50 ether, 1 days);
        _credit(MARKET_1, alice, 100 ether);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 40 ether);

        vm.warp(block.timestamp + 1 days + 1);

        assertEq(unwrapContract.remainingPeriodCapacity(MARKET_1, alice), 50 ether);
    }

    function test_ZeroPeriodLimit_MeansUnlimited() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 1000 ether);

        assertEq(unwrapContract.remainingPeriodCapacity(MARKET_1, alice), type(uint256).max);

        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 900 ether);

        assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), 100 ether);
    }

    function test_CombinedPerTxAndPeriodLimits_BothEnforced() public {
        _configureMarket(MARKET_1, 15 ether, 25 ether, 1 days);
        _credit(MARKET_1, alice, 100 ether);

        // Within per-tx limit, but would still fit period limit.
        vm.prank(alice);
        unwrapContract.unwrap(MARKET_1, 15 ether);

        // Next unwrap of 15 would exceed remaining period capacity (10 left), even
        // though it's within the per-tx cap.
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnwrapFunction.UnwrapFunction__ExceedsPeriodLimit.selector,
                15 ether,
                10 ether
            )
        );
        unwrapContract.unwrap(MARKET_1, 15 ether);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function test_MaxSingleUnwrap_ReflectsConfig() public {
        _configureMarket(MARKET_1, 30 ether, 0, 0);
        assertEq(unwrapContract.maxSingleUnwrap(MARKET_1), 30 ether);

        _configureMarket(MARKET_2, 0, 0, 0);
        assertEq(unwrapContract.maxSingleUnwrap(MARKET_2), type(uint256).max);
    }

    function test_GetUnwrapHistory_RecordsInOrderWithRemainingBalance() public {
        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, 100 ether);

        vm.startPrank(alice);
        unwrapContract.unwrap(MARKET_1, 30 ether);
        unwrapContract.unwrap(MARKET_1, 20 ether);
        vm.stopPrank();

        UnwrapFunction.UnwrapRecord[] memory hist = unwrapContract.getUnwrapHistory(MARKET_1);
        assertEq(hist.length, 2);
        assertEq(hist[0].amount, 30 ether);
        assertEq(hist[0].remainingBalance, 70 ether);
        assertEq(hist[1].amount, 20 ether);
        assertEq(hist[1].remainingBalance, 50 ether);
        assertEq(unwrapContract.getUnwrapOperationCount(MARKET_1), 2);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_UnwrapNeverExceedsCreditedBalance(uint96 credited, uint96 attempt) public {
        vm.assume(credited > 0 && credited <= 5_000 ether);
        vm.assume(attempt > 0 && attempt <= 5_000 ether);

        _configureMarket(MARKET_1, 0, 0, 0);
        _credit(MARKET_1, alice, credited);

        if (attempt > credited) {
            vm.prank(alice);
            vm.expectRevert();
            unwrapContract.unwrap(MARKET_1, attempt);
        } else {
            vm.prank(alice);
            unwrapContract.unwrap(MARKET_1, attempt);
            assertEq(unwrapContract.wrappedBalanceOf(MARKET_1, alice), credited - attempt);
        }
    }

    function testFuzz_PerTxLimitNeverExceeded(uint96 limit, uint96 attempt) public {
        vm.assume(limit > 0 && limit <= 1_000 ether);
        vm.assume(attempt > 0 && attempt <= 1_000 ether);

        _configureMarket(MARKET_1, limit, 0, 0);
        _credit(MARKET_1, alice, 1_000 ether);

        if (attempt > limit) {
            vm.prank(alice);
            vm.expectRevert();
            unwrapContract.unwrap(MARKET_1, attempt);
        } else {
            vm.prank(alice);
            unwrapContract.unwrap(MARKET_1, attempt);
        }
    }
}
