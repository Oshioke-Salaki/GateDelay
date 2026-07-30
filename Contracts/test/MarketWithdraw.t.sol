// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MarketWithdraw} from "../contracts/MarketWithdraw.sol";

// ─── Mock token ───────────────────────────────────────────────────────────────

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract MarketWithdrawTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address owner  = makeAddr("owner");
    address user1  = makeAddr("user1");
    address user2  = makeAddr("user2");

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockToken     token;
    MarketWithdraw market;

    // ── Defaults ──────────────────────────────────────────────────────────────
    uint256 constant MAX_FRAC     = 10_000; // 100 %
    uint256 constant GLOBAL_LIMIT = 1_000 ether;
    uint256 constant USER_LIMIT   = 500 ether;

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        token  = new MockToken();
        market = new MarketWithdraw(
            owner,
            address(token),
            MAX_FRAC,
            GLOBAL_LIMIT,
            USER_LIMIT
        );

        // Seed users with tokens and approve.
        _seedAndApprove(user1, 10_000 ether);
        _seedAndApprove(user2, 10_000 ether);

        // Both users deposit into the market.
        vm.prank(user1);
        market.deposit(1_000 ether);

        vm.prank(user2);
        market.deposit(1_000 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _seedAndApprove(address user, uint256 amount) internal {
        token.mint(user, amount);
        vm.prank(user);
        token.approve(address(market), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deployment / setup
    // ─────────────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(market.token()), address(token));
        assertEq(market.maxFractionBps(), MAX_FRAC);
        assertEq(market.globalDailyLimit(), GLOBAL_LIMIT);
        assertEq(market.userDailyLimit(), USER_LIMIT);
        assertFalse(market.paused());
    }

    function test_RevertIfZeroToken() public {
        vm.expectRevert(MarketWithdraw.ZeroAddress.selector);
        new MarketWithdraw(owner, address(0), MAX_FRAC, 0, 0);
    }

    function test_RevertIfZeroFraction() public {
        vm.expectRevert(MarketWithdraw.InvalidFraction.selector);
        new MarketWithdraw(owner, address(token), 0, 0, 0);
    }

    function test_RevertIfFractionExceedsMax() public {
        vm.expectRevert(MarketWithdraw.InvalidFraction.selector);
        new MarketWithdraw(owner, address(token), MAX_FRAC + 1, 0, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deposit
    // ─────────────────────────────────────────────────────────────────────────

    function test_DepositCreditsBalance() public {
        assertEq(market.userBalance(user1), 1_000 ether);
    }

    function test_DepositRevertsOnZero() public {
        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.ZeroAmount.selector);
        market.deposit(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Request withdraw – full withdrawal (fraction = MAX_FRAC)
    // ─────────────────────────────────────────────────────────────────────────

    function test_FullWithdrawRequest() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(100 ether, MAX_FRAC);

        MarketWithdraw.WithdrawRequest memory r = market.getRequest(id);
        assertEq(r.id, id);
        assertEq(r.user, user1);
        assertEq(r.requestedAmount, 100 ether);
        assertEq(r.withdrawableAmount, 100 ether);
        assertFalse(r.isPartial);
        assertEq(uint8(r.status), uint8(MarketWithdraw.WithdrawStatus.PENDING));
    }

    function test_RequestDebitsUserBalance() public {
        vm.prank(user1);
        market.requestWithdraw(200 ether, MAX_FRAC);
        // Full withdrawal: balance goes to 0 (refund = 0)
        assertEq(market.userBalance(user1), 800 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Request withdraw – partial withdrawal
    // ─────────────────────────────────────────────────────────────────────────

    function test_PartialWithdrawRequest() public {
        // 50 % of 400 ether = 200 ether
        vm.prank(user1);
        uint256 id = market.requestWithdraw(400 ether, 5_000);

        MarketWithdraw.WithdrawRequest memory r = market.getRequest(id);
        assertEq(r.requestedAmount,   400 ether);
        assertEq(r.withdrawableAmount, 200 ether);
        assertTrue(r.isPartial);
    }

    function test_PartialWithdrawRefundsUndrawnToBalance() public {
        // 50 % of 400 ether: user starts at 1000, requests 400, gets 200 back
        // After: deducted 400, refunded 200 → balance = 600 + 200 = 800
        vm.prank(user1);
        market.requestWithdraw(400 ether, 5_000);
        // requestWithdraw debits requestedAmount then credits (requestedAmount - withdrawable)
        // net debit = withdrawable = 200 ether
        assertEq(market.userBalance(user1), 800 ether);
    }

    function test_RequestRevertsIfInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.InsufficientUserBalance.selector);
        market.requestWithdraw(5_000 ether, MAX_FRAC);
    }

    function test_RequestRevertsWhenPaused() public {
        vm.prank(owner);
        market.setPaused(true);

        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.MarketPaused.selector);
        market.requestWithdraw(100 ether, MAX_FRAC);
    }

    function test_RequestRevertsOnZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.ZeroAmount.selector);
        market.requestWithdraw(0, MAX_FRAC);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Execute withdraw
    // ─────────────────────────────────────────────────────────────────────────

    function test_ExecuteTransfersTokens() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(100 ether, MAX_FRAC);

        uint256 before = token.balanceOf(user1);
        vm.prank(user1);
        market.executeWithdraw(id);

        assertEq(token.balanceOf(user1) - before, 100 ether);
        assertEq(uint8(market.statusOf(id)), uint8(MarketWithdraw.WithdrawStatus.EXECUTED));
    }

    function test_OwnerCanExecuteOnBehalfOfUser() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(50 ether, MAX_FRAC);

        uint256 before = token.balanceOf(user1);
        vm.prank(owner);
        market.executeWithdraw(id);
        assertEq(token.balanceOf(user1) - before, 50 ether);
    }

    function test_ExecuteRevertsIfNotOwnerOfRequest() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(50 ether, MAX_FRAC);

        vm.prank(user2);
        vm.expectRevert(MarketWithdraw.NotRequestOwner.selector);
        market.executeWithdraw(id);
    }

    function test_ExecuteRevertsOnUnknownId() public {
        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.UnknownRequest.selector);
        market.executeWithdraw(999);
    }

    function test_ExecuteRevertsWhenPaused() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(50 ether, MAX_FRAC);

        vm.prank(owner);
        market.setPaused(true);

        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.MarketPaused.selector);
        market.executeWithdraw(id);
    }

    function test_CannotExecuteTwice() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(50 ether, MAX_FRAC);

        vm.prank(user1);
        market.executeWithdraw(id);

        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.RequestNotPending.selector);
        market.executeWithdraw(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Cancel withdraw
    // ─────────────────────────────────────────────────────────────────────────

    function test_CancelRestoresBalance() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(100 ether, MAX_FRAC);
        // After request: balance = 900
        assertEq(market.userBalance(user1), 900 ether);

        vm.prank(user1);
        market.cancelWithdraw(id);
        // After cancel: balance restored to 1000
        assertEq(market.userBalance(user1), 1_000 ether);
        assertEq(uint8(market.statusOf(id)), uint8(MarketWithdraw.WithdrawStatus.CANCELLED));
    }

    function test_CancelPartialWithdrawRestoresBalance() public {
        // Partial: requestedAmount=400, withdrawable=200 → net debit=200
        vm.prank(user1);
        uint256 id = market.requestWithdraw(400 ether, 5_000);
        assertEq(market.userBalance(user1), 800 ether);

        vm.prank(user1);
        market.cancelWithdraw(id);
        // Full restoration: 800 + 200 = 1000
        assertEq(market.userBalance(user1), 1_000 ether);
    }

    function test_CancelRevertsIfNotOwner() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(100 ether, MAX_FRAC);

        vm.prank(user2);
        vm.expectRevert(MarketWithdraw.NotRequestOwner.selector);
        market.cancelWithdraw(id);
    }

    function test_CannotCancelExecuted() public {
        vm.prank(user1);
        uint256 id = market.requestWithdraw(100 ether, MAX_FRAC);

        vm.prank(user1);
        market.executeWithdraw(id);

        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.RequestNotPending.selector);
        market.cancelWithdraw(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Limit tracking
    // ─────────────────────────────────────────────────────────────────────────

    function test_UserDailyLimitEnforced() public {
        // USER_LIMIT = 500 ether; withdraw 500 first, then try 1 more
        vm.prank(user1);
        market.requestWithdraw(500 ether, MAX_FRAC);

        vm.prank(user1);
        vm.expectRevert(MarketWithdraw.ExceedsUserDailyLimit.selector);
        market.requestWithdraw(1 ether, MAX_FRAC);
    }

    function test_GlobalDailyLimitEnforced() public {
        // GLOBAL_LIMIT = 1000; user1 uses 500, user2 tries to use 600
        vm.prank(user1);
        market.requestWithdraw(500 ether, MAX_FRAC);

        vm.prank(user2);
        vm.expectRevert(MarketWithdraw.ExceedsGlobalDailyLimit.selector);
        market.requestWithdraw(600 ether, MAX_FRAC);
    }

    function test_DailyLimitResetsAfterWindow() public {
        vm.prank(user1);
        market.requestWithdraw(500 ether, MAX_FRAC);

        // Advance time 1 day + 1 second
        vm.warp(block.timestamp + 1 days + 1);

        // After window resets, user can withdraw again.
        // Re-deposit so balance is available.
        _seedAndApprove(user1, 500 ether);
        vm.prank(user1);
        market.deposit(500 ether);

        vm.prank(user1);
        uint256 id = market.requestWithdraw(500 ether, MAX_FRAC);
        assertEq(uint8(market.statusOf(id)), uint8(MarketWithdraw.WithdrawStatus.PENDING));
    }

    function test_RemainingUserDailyLimit() public {
        vm.prank(user1);
        market.requestWithdraw(200 ether, MAX_FRAC);
        assertEq(market.remainingUserDailyLimit(user1), 300 ether);
    }

    function test_RemainingGlobalDailyLimit() public {
        vm.prank(user1);
        market.requestWithdraw(300 ether, MAX_FRAC);
        assertEq(market.remainingGlobalDailyLimit(), 700 ether);
    }

    function test_UnlimitedWhenLimitIsZero() public {
        market = new MarketWithdraw(owner, address(token), MAX_FRAC, 0, 0);
        assertEq(market.remainingUserDailyLimit(user1), type(uint256).max);
        assertEq(market.remainingGlobalDailyLimit(), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Preview / queries
    // ─────────────────────────────────────────────────────────────────────────

    function test_PreviewWithdraw_Full() public view {
        uint256 w = market.previewWithdraw(1_000 ether, MAX_FRAC);
        assertEq(w, 1_000 ether);
    }

    function test_PreviewWithdraw_Half() public view {
        uint256 w = market.previewWithdraw(1_000 ether, 5_000);
        assertEq(w, 500 ether);
    }

    function test_PreviewWithdraw_Quarter() public view {
        uint256 w = market.previewWithdraw(1_000 ether, 2_500);
        assertEq(w, 250 ether);
    }

    function test_PreviewRevertsOnZeroFraction() public {
        vm.expectRevert(MarketWithdraw.InvalidFraction.selector);
        market.previewWithdraw(100 ether, 0);
    }

    function test_UserRequestIdsGrowsPerRequest() public {
        vm.prank(user1);
        market.requestWithdraw(100 ether, MAX_FRAC);

        vm.prank(user1);
        market.requestWithdraw(50 ether, MAX_FRAC);

        uint256[] memory ids = market.userRequestIds(user1);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Admin guards
    // ─────────────────────────────────────────────────────────────────────────

    function test_NonOwnerCannotPause() public {
        vm.prank(user1);
        vm.expectRevert();
        market.setPaused(true);
    }

    function test_NonOwnerCannotSetFraction() public {
        vm.prank(user1);
        vm.expectRevert();
        market.setMaxFraction(5_000);
    }

    function test_OwnerCanUpdateLimits() public {
        vm.prank(owner);
        market.setGlobalDailyLimit(2_000 ether);
        assertEq(market.globalDailyLimit(), 2_000 ether);

        vm.prank(owner);
        market.setUserDailyLimit(800 ether);
        assertEq(market.userDailyLimit(), 800 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Fuzz: any valid fraction should produce a withdrawable amount ≤ requested.
    function testFuzz_WithdrawableNeverExceedsRequested(
        uint256 amount,
        uint256 fractionBps
    ) public {
        amount     = bound(amount, 1, 500 ether);   // within USER_LIMIT & balance
        fractionBps = bound(fractionBps, 1, MAX_FRAC);

        // top up balance
        _seedAndApprove(user1, amount);
        vm.prank(user1);
        market.deposit(amount);

        // reset daily window so limits don't interfere
        vm.warp(block.timestamp + 2 days);

        vm.prank(user1);
        uint256 id = market.requestWithdraw(amount, fractionBps);
        MarketWithdraw.WithdrawRequest memory r = market.getRequest(id);
        assertLe(r.withdrawableAmount, r.requestedAmount);
    }
}
