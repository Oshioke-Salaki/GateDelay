// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MarketWrap} from "../contracts/MarketWrap.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MarketWrapTest is Test {
    MarketWrap internal wrapContract;
    MockToken internal token;

    address internal controller = makeAddr("controller");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant MARKET_1 = 1;
    uint256 internal constant MARKET_2 = 2;

    function setUp() public {
        wrapContract = new MarketWrap(controller);
        token = new MockToken();

        token.mint(alice, 1_000 ether);
        token.mint(bob, 1_000 ether);

        vm.prank(alice);
        token.approve(address(wrapContract), type(uint256).max);

        vm.prank(bob);
        token.approve(address(wrapContract), type(uint256).max);
    }

    function _configureMarket(uint256 marketId, uint256 wrapLimit, uint256 userWrapLimit) internal {
        vm.prank(controller);
        wrapContract.configureMarket(marketId, address(token), wrapLimit, userWrapLimit);
    }

    // ---------------------------------------------------------------
    // Access control
    // ---------------------------------------------------------------

    function test_RevertWhen_ConfigureMarketCalledByNonController() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__NotController.selector, alice)
        );
        wrapContract.configureMarket(MARKET_1, address(token), 0, 0);
    }

    function test_RevertWhen_UpdateWrapLimitsCalledByNonController() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__NotController.selector, alice)
        );
        wrapContract.updateWrapLimits(MARKET_1, 100 ether, 10 ether);
    }

    // ---------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------

    function test_ConfigureMarket_SetsConfigAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit MarketWrap.MarketConfigured(MARKET_1, address(token), 500 ether, 100 ether);

        _configureMarket(MARKET_1, 500 ether, 100 ether);

        MarketWrap.MarketWrapConfig memory cfg = wrapContract.getMarketConfig(MARKET_1);
        assertEq(cfg.token, address(token));
        assertEq(cfg.wrapLimit, 500 ether);
        assertEq(cfg.userWrapLimit, 100 ether);
        assertTrue(cfg.active);
        assertTrue(wrapContract.isMarketActive(MARKET_1));
    }

    function test_RevertWhen_ConfiguringMarketTwice() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__MarketAlreadyConfigured.selector, MARKET_1)
        );
        wrapContract.configureMarket(MARKET_1, address(token), 0, 0);
    }

    function test_RevertWhen_ConfiguringWithZeroAddressToken() public {
        vm.prank(controller);
        vm.expectRevert(MarketWrap.MarketWrap__InvalidToken.selector);
        wrapContract.configureMarket(MARKET_1, address(0), 0, 0);
    }

    function test_UpdateWrapLimits_UpdatesConfigAndEmitsEvent() public {
        _configureMarket(MARKET_1, 100 ether, 10 ether);

        vm.expectEmit(true, false, false, true);
        emit MarketWrap.WrapLimitUpdated(MARKET_1, 200 ether, 20 ether);

        vm.prank(controller);
        wrapContract.updateWrapLimits(MARKET_1, 200 ether, 20 ether);

        MarketWrap.MarketWrapConfig memory cfg = wrapContract.getMarketConfig(MARKET_1);
        assertEq(cfg.wrapLimit, 200 ether);
        assertEq(cfg.userWrapLimit, 20 ether);
    }

    function test_RevertWhen_UpdatingLimitsOnInactiveMarket() public {
        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__MarketNotActive.selector, MARKET_1)
        );
        wrapContract.updateWrapLimits(MARKET_1, 1 ether, 1 ether);
    }

    // ---------------------------------------------------------------
    // wrap()
    // ---------------------------------------------------------------

    function test_RevertWhen_WrappingOnInactiveMarket() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__MarketNotActive.selector, MARKET_1)
        );
        wrapContract.wrap(MARKET_1, 10 ether);
    }

    function test_RevertWhen_WrappingZeroAmount() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        vm.expectRevert(MarketWrap.MarketWrap__ZeroAmount.selector);
        wrapContract.wrap(MARKET_1, 0);
    }

    function test_Wrap_TransfersTokensAndUpdatesBalances() public {
        _configureMarket(MARKET_1, 0, 0);

        uint256 aliceBalanceBefore = token.balanceOf(alice);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        assertEq(token.balanceOf(alice), aliceBalanceBefore - 50 ether);
        assertEq(token.balanceOf(address(wrapContract)), 50 ether);
        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 50 ether);
        assertEq(wrapContract.totalWrapped(MARKET_1), 50 ether);
    }

    function test_Wrap_EmitsEvent() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.expectEmit(true, true, false, true);
        emit MarketWrap.Wrapped(MARKET_1, alice, 50 ether, 50 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);
    }

    function test_Wrap_TracksPositionCountersAndHistory() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 30 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 20 ether);

        MarketWrap.WrapPosition memory pos = wrapContract.getPosition(MARKET_1, alice);
        assertEq(pos.wrappedBalance, 50 ether);
        assertEq(pos.totalWrapped, 50 ether);
        assertEq(pos.wrapCount, 2);
        assertEq(pos.totalUnwrapped, 0);
        assertEq(pos.unwrapCount, 0);

        assertEq(wrapContract.getWrapOperationCount(MARKET_1), 2);

        MarketWrap.WrapRecord[] memory hist = wrapContract.getWrapHistory(MARKET_1);
        assertEq(hist.length, 2);
        assertTrue(hist[0].isWrap);
        assertTrue(hist[1].isWrap);
        assertEq(hist[0].amount, 30 ether);
        assertEq(hist[1].amount, 20 ether);
    }

    function test_Wrap_IndependentAcrossMarkets() public {
        _configureMarket(MARKET_1, 0, 0);
        _configureMarket(MARKET_2, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 10 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_2, 5 ether);

        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 10 ether);
        assertEq(wrapContract.wrappedBalanceOf(MARKET_2, alice), 5 ether);
        assertEq(wrapContract.totalWrapped(MARKET_1), 10 ether);
        assertEq(wrapContract.totalWrapped(MARKET_2), 5 ether);
    }

    // ---------------------------------------------------------------
    // wrap() limits
    // ---------------------------------------------------------------

    function test_RevertWhen_WrapExceedsMarketLimit() public {
        _configureMarket(MARKET_1, 100 ether, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 80 ether);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketWrap.MarketWrap__MarketLimitExceeded.selector,
                30 ether,
                20 ether
            )
        );
        wrapContract.wrap(MARKET_1, 30 ether);
    }

    function test_Wrap_SucceedsExactlyAtMarketLimit() public {
        _configureMarket(MARKET_1, 100 ether, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 100 ether);

        assertEq(wrapContract.totalWrapped(MARKET_1), 100 ether);
        assertEq(wrapContract.remainingMarketCapacity(MARKET_1), 0);
    }

    function test_RevertWhen_WrapExceedsUserLimit() public {
        _configureMarket(MARKET_1, 0, 50 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 40 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketWrap.MarketWrap__UserLimitExceeded.selector,
                20 ether,
                10 ether
            )
        );
        wrapContract.wrap(MARKET_1, 20 ether);
    }

    function test_UserLimit_DoesNotAffectOtherUsers() public {
        _configureMarket(MARKET_1, 0, 50 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        // Bob has his own independent allowance under the same per-user cap.
        vm.prank(bob);
        wrapContract.wrap(MARKET_1, 50 ether);

        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 50 ether);
        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, bob), 50 ether);
    }

    function test_ZeroLimit_MeansUnlimited() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 900 ether);

        assertEq(wrapContract.remainingMarketCapacity(MARKET_1), type(uint256).max);
        assertEq(wrapContract.remainingUserCapacity(MARKET_1, alice), type(uint256).max);
    }

    // ---------------------------------------------------------------
    // unwrap()
    // ---------------------------------------------------------------

    function test_RevertWhen_UnwrappingOnInactiveMarket() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketWrap.MarketWrap__MarketNotActive.selector, MARKET_1)
        );
        wrapContract.unwrap(MARKET_1, 10 ether);
    }

    function test_RevertWhen_UnwrappingZeroAmount() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        vm.expectRevert(MarketWrap.MarketWrap__ZeroAmount.selector);
        wrapContract.unwrap(MARKET_1, 0);
    }

    function test_RevertWhen_UnwrappingMoreThanWrappedBalance() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 10 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketWrap.MarketWrap__InsufficientWrappedBalance.selector,
                20 ether,
                10 ether
            )
        );
        wrapContract.unwrap(MARKET_1, 20 ether);
    }

    function test_Unwrap_ReturnsTokensAndUpdatesBalances() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        uint256 aliceBalanceBeforeUnwrap = token.balanceOf(alice);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 30 ether);

        assertEq(token.balanceOf(alice), aliceBalanceBeforeUnwrap + 30 ether);
        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 20 ether);
        assertEq(wrapContract.totalWrapped(MARKET_1), 20 ether);
    }

    function test_Unwrap_EmitsEvent() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        vm.expectEmit(true, true, false, true);
        emit MarketWrap.Unwrapped(MARKET_1, alice, 30 ether, 20 ether);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 30 ether);
    }

    function test_Unwrap_FreesUpMarketAndUserCapacity() public {
        _configureMarket(MARKET_1, 100 ether, 60 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 60 ether);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 60 ether);

        assertEq(wrapContract.remainingMarketCapacity(MARKET_1), 100 ether);
        assertEq(wrapContract.remainingUserCapacity(MARKET_1, alice), 60 ether);

        // Capacity freed up should allow wrapping again up to the limit.
        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 60 ether);
        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 60 ether);
    }

    function test_Unwrap_TracksPositionCounters() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 10 ether);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 5 ether);

        MarketWrap.WrapPosition memory pos = wrapContract.getPosition(MARKET_1, alice);
        assertEq(pos.totalUnwrapped, 15 ether);
        assertEq(pos.unwrapCount, 2);
        assertEq(pos.wrappedBalance, 35 ether);

        assertEq(wrapContract.getWrapOperationCount(MARKET_1), 3); // 1 wrap + 2 unwraps
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function test_RemainingMarketCapacity_ReflectsCurrentUsage() public {
        _configureMarket(MARKET_1, 100 ether, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 40 ether);

        assertEq(wrapContract.remainingMarketCapacity(MARKET_1), 60 ether);
    }

    function test_RemainingUserCapacity_ReflectsCurrentUsage() public {
        _configureMarket(MARKET_1, 0, 50 ether);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 20 ether);

        assertEq(wrapContract.remainingUserCapacity(MARKET_1, alice), 30 ether);
        // Untouched user still has full capacity.
        assertEq(wrapContract.remainingUserCapacity(MARKET_1, bob), 50 ether);
    }

    function test_GetWrapHistory_OrdersWrapsAndUnwrapsChronologically() public {
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, 50 ether);

        vm.warp(block.timestamp + 1 hours);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, 10 ether);

        MarketWrap.WrapRecord[] memory hist = wrapContract.getWrapHistory(MARKET_1);
        assertEq(hist.length, 2);
        assertTrue(hist[0].isWrap);
        assertFalse(hist[1].isWrap);
        assertTrue(hist[1].timestamp > hist[0].timestamp);
    }

    // ---------------------------------------------------------------
    // Fuzz tests
    // ---------------------------------------------------------------

    function testFuzz_WrapThenUnwrapReturnsExactAmount(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 1_000 ether);
        _configureMarket(MARKET_1, 0, 0);

        vm.prank(alice);
        wrapContract.wrap(MARKET_1, amount);

        vm.prank(alice);
        wrapContract.unwrap(MARKET_1, amount);

        assertEq(wrapContract.wrappedBalanceOf(MARKET_1, alice), 0);
        assertEq(wrapContract.totalWrapped(MARKET_1), 0);
        assertEq(token.balanceOf(address(wrapContract)), 0);
    }

    function testFuzz_NeverExceedsMarketLimit(uint96 limit, uint96 attempt) public {
        vm.assume(limit > 0 && limit <= 1_000 ether);
        vm.assume(attempt > 0 && attempt <= 1_000 ether);
        _configureMarket(MARKET_1, limit, 0);

        if (attempt > limit) {
            vm.prank(alice);
            vm.expectRevert();
            wrapContract.wrap(MARKET_1, attempt);
        } else {
            vm.prank(alice);
            wrapContract.wrap(MARKET_1, attempt);
            assertLe(wrapContract.totalWrapped(MARKET_1), limit);
        }
    }
}
