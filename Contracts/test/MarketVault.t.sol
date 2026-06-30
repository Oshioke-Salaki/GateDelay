// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2}  from "forge-std/Test.sol";
import {MarketVault}     from "../contracts/MarketVault.sol";
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ERC-20 used as the underlying asset
// ─────────────────────────────────────────────────────────────────────────────
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MCK") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────
contract MarketVaultTest is Test {
    MarketVault internal vault;
    MockERC20   internal token;

    address internal owner   = address(this);
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");

    uint256 internal constant DEPOSIT_1K  = 1_000e18;
    uint256 internal constant DEPOSIT_500 = 500e18;
    uint256 internal constant YIELD_50    = 50e18;
    uint256 internal constant PRECISION   = 1e18;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup helpers
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        token = new MockERC20();
        vault = new MarketVault(address(token), "Vault Share", "vMCK", 0);

        // Fund users
        token.mint(alice, 10_000e18);
        token.mint(bob,   10_000e18);
        token.mint(carol, 10_000e18);
        token.mint(owner, 10_000e18);

        // Approvals
        vm.prank(alice); token.approve(address(vault), type(uint256).max);
        vm.prank(bob);   token.approve(address(vault), type(uint256).max);
        vm.prank(carol); token.approve(address(vault), type(uint256).max);
        token.approve(address(vault), type(uint256).max); // owner
    }

    function _deposit(address user, uint256 assets) internal returns (uint256 shares) {
        vm.prank(user);
        shares = vault.deposit(assets, user);
    }

    function _withdraw(address user, uint256 shares) internal {
        vm.prank(user);
        vault.requestWithdrawal(shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Deposit management (Deposits are managed)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Deposit_MintsShares() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        assertGt(shares, 0, "shares minted");
        assertEq(vault.balanceOf(alice), shares, "alice holds shares");
    }

    function test_Deposit_UpdatesTotalAssets() public {
        _deposit(alice, DEPOSIT_1K);
        assertEq(vault.totalAssets(), DEPOSIT_1K);
    }

    function test_Deposit_UpdatesTotalDeposited() public {
        _deposit(alice, DEPOSIT_1K);
        assertEq(vault.totalDeposited(), DEPOSIT_1K);
        assertEq(vault.userTotalDeposited(alice), DEPOSIT_1K);
    }

    function test_Deposit_RecordsHistory() public {
        _deposit(alice, DEPOSIT_1K);
        _deposit(alice, DEPOSIT_500);
        assertEq(vault.depositCount(alice), 2);

        MarketVault.DepositRecord[] memory history = vault.getDepositHistory(alice);
        assertEq(history[0].assets, DEPOSIT_1K);
        assertEq(history[1].assets, DEPOSIT_500);
    }

    function test_Deposit_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit MarketVault.Deposit(alice, DEPOSIT_1K, 0);
        vault.deposit(DEPOSIT_1K, alice);
    }

    function test_Deposit_RevertsZeroAssets() public {
        vm.prank(alice);
        vm.expectRevert(MarketVault.ZeroAssets.selector);
        vault.deposit(0, alice);
    }

    function test_Deposit_MultipleUsers_IndependentAccounting() public {
        _deposit(alice, DEPOSIT_1K);
        _deposit(bob,   DEPOSIT_500);

        assertEq(vault.userTotalDeposited(alice), DEPOSIT_1K);
        assertEq(vault.userTotalDeposited(bob),   DEPOSIT_500);
        assertEq(vault.totalAssets(), DEPOSIT_1K + DEPOSIT_500);
    }

    function test_Deposit_RevertsWhenPaused() public {
        vault.pause();
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(DEPOSIT_1K, alice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Asset tracking (Assets are tracked)
    // ─────────────────────────────────────────────────────────────────────────

    function test_TotalAssets_IncludesYield() public {
        _deposit(alice, DEPOSIT_1K);
        vault.addYield(YIELD_50);
        assertEq(vault.totalAssets(), DEPOSIT_1K + YIELD_50);
    }

    function test_TotalAssets_DecreasesAfterWithdrawal() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        _withdraw(alice, shares);
        assertEq(vault.totalAssets(), 0);
    }

    function test_TotalYieldAdded_Tracked() public {
        vault.addYield(YIELD_50);
        vault.addYield(YIELD_50);
        assertEq(vault.totalYieldAdded(), YIELD_50 * 2);
    }

    function test_NetAssets_ExcludesEscrow() public {
        // Use delayed vault so escrow kicks in
        MarketVault delayedVault = new MarketVault(
            address(token), "V2", "V2", 1 days
        );
        token.approve(address(delayedVault), type(uint256).max);
        vm.prank(alice);
        token.approve(address(delayedVault), type(uint256).max);

        vm.prank(alice);
        uint256 shares = delayedVault.deposit(DEPOSIT_1K, alice);

        vm.prank(alice);
        delayedVault.requestWithdrawal(shares);

        // netAssets should exclude the escrowed portion
        uint256 net = delayedVault.netAssets();
        assertApproxEqAbs(net, 0, 1, "escrowed funds excluded from net");
    }

    function test_PricePerShare_StartsAtPrecision() public view {
        assertEq(vault.pricePerShare(), PRECISION);
    }

    function test_PricePerShare_IncreasesWithYield() public {
        _deposit(alice, DEPOSIT_1K);
        uint256 ppsBefore = vault.pricePerShare();
        vault.addYield(YIELD_50);
        uint256 ppsAfter  = vault.pricePerShare();
        assertGt(ppsAfter, ppsBefore, "price per share should rise");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Withdrawals (Withdrawals work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Withdrawal_InstantBurnsSharesAndSendsTokens() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        uint256 balBefore = token.balanceOf(alice);

        _withdraw(alice, shares);

        assertEq(vault.balanceOf(alice), 0, "shares burned");
        assertGt(token.balanceOf(alice), balBefore, "tokens returned");
    }

    function test_Withdrawal_UpdatesWithdrawalHistory() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        _withdraw(alice, shares);

        assertEq(vault.withdrawalCount(alice), 1);
        MarketVault.WithdrawalRecord[] memory hist = vault.getWithdrawalHistory(alice);
        assertEq(hist[0].shares, shares);
    }

    function test_Withdrawal_UpdatesTotalWithdrawn() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        _withdraw(alice, shares);
        assertGt(vault.totalWithdrawn(), 0);
        assertGt(vault.userTotalWithdrawn(alice), 0);
    }

    function test_Withdrawal_RevertsInsufficientShares() public {
        _deposit(alice, DEPOSIT_1K);
        vm.prank(alice);
        vm.expectRevert(MarketVault.InsufficientShares.selector);
        vault.requestWithdrawal(999_999e18);
    }

    function test_Withdrawal_RevertsZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(MarketVault.ZeroShares.selector);
        vault.requestWithdrawal(0);
    }

    function test_Withdrawal_Delayed_QueuesRequest() public {
        MarketVault delayedVault = new MarketVault(
            address(token), "V2", "V2", 1 days
        );
        token.approve(address(delayedVault), type(uint256).max);
        vm.prank(alice);
        token.approve(address(delayedVault), type(uint256).max);

        vm.prank(alice);
        uint256 shares = delayedVault.deposit(DEPOSIT_1K, alice);

        vm.prank(alice);
        delayedVault.requestWithdrawal(shares);

        (uint256 pendingShares, uint256 unlocksAt) = delayedVault.pendingWithdrawals(alice);
        assertEq(pendingShares, shares, "shares escrowed");
        assertEq(unlocksAt, block.timestamp + 1 days);
    }

    function test_Withdrawal_Delayed_RevertsBeforeUnlock() public {
        MarketVault delayedVault = new MarketVault(
            address(token), "V2", "V2", 1 days
        );
        token.approve(address(delayedVault), type(uint256).max);
        vm.prank(alice);
        token.approve(address(delayedVault), type(uint256).max);

        vm.prank(alice);
        uint256 shares = delayedVault.deposit(DEPOSIT_1K, alice);
        vm.prank(alice);
        delayedVault.requestWithdrawal(shares);

        vm.prank(alice);
        vm.expectRevert();
        delayedVault.executeWithdrawal();
    }

    function test_Withdrawal_Delayed_ExecutesAfterUnlock() public {
        MarketVault delayedVault = new MarketVault(
            address(token), "V2", "V2", 1 days
        );
        token.approve(address(delayedVault), type(uint256).max);
        vm.prank(alice);
        token.approve(address(delayedVault), type(uint256).max);

        vm.prank(alice);
        uint256 shares = delayedVault.deposit(DEPOSIT_1K, alice);
        vm.prank(alice);
        delayedVault.requestWithdrawal(shares);

        vm.warp(block.timestamp + 1 days + 1);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        delayedVault.executeWithdrawal();

        assertGt(token.balanceOf(alice), balBefore, "tokens received after delay");
    }

    function test_Withdrawal_ProRata_MultipleUsers() public {
        uint256 aliceShares = _deposit(alice, DEPOSIT_1K);
        uint256 bobShares   = _deposit(bob,   DEPOSIT_500);

        // Add yield: total = 1500 + 150 = 1650; alice owns 2/3
        vault.addYield(150e18);

        uint256 aliceBefore = token.balanceOf(alice);
        _withdraw(alice, aliceShares);
        uint256 aliceReceived = token.balanceOf(alice) - aliceBefore;

        // Alice deposited 1000, owns 2/3 of 1650 = 1100
        assertApproxEqRel(aliceReceived, 1_100e18, 1e15, "alice gets pro-rata share");

        uint256 bobBefore = token.balanceOf(bob);
        _withdraw(bob, bobShares);
        uint256 bobReceived = token.balanceOf(bob) - bobBefore;
        assertApproxEqRel(bobReceived, 550e18, 1e15, "bob gets pro-rata share");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Performance calculation (Performance is calculated)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Performance_TotalReturnStartsAtPrecision() public view {
        assertEq(vault.totalReturn(), PRECISION);
    }

    function test_Performance_TotalReturnIncreasesWithYield() public {
        _deposit(alice, DEPOSIT_1K);
        vault.addYield(YIELD_50);
        assertGt(vault.totalReturn(), PRECISION, "positive return after yield");
    }

    function test_Performance_HighWaterMarkUpdatesOnYield() public {
        _deposit(alice, DEPOSIT_1K);
        uint256 hwmBefore = vault.highWaterMark();
        vault.addYield(YIELD_50);
        assertGt(vault.highWaterMark(), hwmBefore, "HWM updated");
    }

    function test_Performance_GainAboveHWM_Zero_WhenNoYield() public view {
        assertEq(vault.gainAboveHighWaterMark(), 0);
    }

    function test_Performance_GainAboveHWM_AfterYield() public {
        _deposit(alice, DEPOSIT_1K);
        vault.addYield(YIELD_50);
        assertGt(vault.gainAboveHighWaterMark(), 0, "gain above HWM");
    }

    function test_Performance_AnnualisedReturn_ZeroAtInception() public view {
        assertEq(vault.annualisedReturn(), 0);
    }

    function test_Performance_AnnualisedReturn_After1Year() public {
        _deposit(alice, DEPOSIT_1K);
        // Add 10% yield
        vault.addYield(100e18);
        // Fast-forward 1 year
        vm.warp(block.timestamp + 365 days);
        uint256 apr = vault.annualisedReturn();
        // Should be approximately 10% = 0.1e18
        assertApproxEqRel(apr, 0.1e18, 5e16, "~10% APR");
    }

    function test_Performance_UserProfit_PositiveAfterYield() public {
        _deposit(alice, DEPOSIT_1K);
        vault.addYield(100e18);
        int256 profit = vault.userProfit(alice);
        assertGt(profit, 0, "user profit positive");
    }

    function test_Performance_UserProfit_ZeroBeforeYield() public {
        _deposit(alice, DEPOSIT_1K);
        int256 profit = vault.userProfit(alice);
        // Slight negative due to minimum shares seed, but near zero
        assertApproxEqAbs(uint256(profit < 0 ? -profit : profit), 0, 1_000, "~zero profit before yield");
    }

    function test_Performance_Snapshot_StoredOnDeposit() public {
        _deposit(alice, DEPOSIT_1K);
        vault.addYield(YIELD_50);
        (uint256 ta, uint256 pps, uint256 ts) = _getSnapshot();
        assertGt(ta, 0);
        assertGt(pps, 0);
        assertEq(ts, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Vault queries (Queries work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Query_PreviewDeposit() public {
        _deposit(alice, DEPOSIT_1K); // seed
        uint256 expected = vault.previewDeposit(DEPOSIT_500);
        uint256 actual   = _deposit(bob, DEPOSIT_500);
        assertApproxEqAbs(expected, actual, 1, "preview matches actual");
    }

    function test_Query_PreviewRedeem() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        uint256 expected = vault.previewRedeem(shares);
        uint256 balBefore = token.balanceOf(alice);
        _withdraw(alice, shares);
        uint256 actual = token.balanceOf(alice) - balBefore;
        assertApproxEqAbs(expected, actual, 1, "preview matches actual");
    }

    function test_Query_MaxWithdraw() public {
        _deposit(alice, DEPOSIT_1K);
        uint256 max = vault.maxWithdraw(alice);
        assertApproxEqRel(max, DEPOSIT_1K, 1e15, "max withdraw ≈ deposited");
    }

    function test_Query_DepositAndWithdrawalCounts() public {
        _deposit(alice, DEPOSIT_1K);
        _deposit(alice, DEPOSIT_500);
        uint256 shares = vault.balanceOf(alice);
        _withdraw(alice, shares / 2);

        assertEq(vault.depositCount(alice),    2);
        assertEq(vault.withdrawalCount(alice), 1);
    }

    function test_Query_TotalDeposited_TotalWithdrawn() public {
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        _deposit(bob,   DEPOSIT_500);
        _withdraw(alice, shares);

        assertEq(vault.totalDeposited(), DEPOSIT_1K + DEPOSIT_500);
        assertGt(vault.totalWithdrawn(), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Admin controls
    // ─────────────────────────────────────────────────────────────────────────

    function test_Admin_SetWithdrawalDelay() public {
        vault.setWithdrawalDelay(2 days);
        assertEq(vault.withdrawalDelay(), 2 days);
    }

    function test_Admin_SetWithdrawalDelay_RejectsOver30Days() public {
        vm.expectRevert(MarketVault.InvalidDelay.selector);
        vault.setWithdrawalDelay(31 days);
    }

    function test_Admin_OnlyOwnerCanAddYield() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.addYield(100e18);
    }

    function test_Admin_PauseBlocksDeposits() public {
        vault.pause();
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(DEPOSIT_1K, alice);
    }

    function test_Admin_UnpauseResumesDeposits() public {
        vault.pause();
        vault.unpause();
        uint256 shares = _deposit(alice, DEPOSIT_1K);
        assertGt(shares, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_Deposit_SharesProportional(uint128 a, uint128 b) public {
        vm.assume(a > 1e9 && b > 1e9 && uint256(a) + uint256(b) < 1e30);

        token.mint(alice, a);
        token.mint(bob, b);
        vm.prank(alice); token.approve(address(vault), type(uint256).max);
        vm.prank(bob);   token.approve(address(vault), type(uint256).max);

        uint256 sharesA = _deposit(alice, a);
        uint256 sharesB = _deposit(bob,   b);

        // shares ratio should track asset ratio within 0.1%
        assertApproxEqRel(
            sharesA * 1e18 / sharesB,
            uint256(a)    * 1e18 / uint256(b),
            1e15
        );
    }

    function testFuzz_WithdrawAll_ReturnsAllAssets(uint128 amount) public {
        vm.assume(amount > 1_001 && amount < 1e30); // > MINIMUM_SHARES
        token.mint(alice, amount);
        vm.prank(alice); token.approve(address(vault), type(uint256).max);

        uint256 balBefore = token.balanceOf(alice);
        uint256 shares    = _deposit(alice, amount);
        _withdraw(alice, shares);
        uint256 balAfter  = token.balanceOf(alice);

        // Should get back very close to what was deposited (minus minimum shares rounding)
        assertApproxEqAbs(balAfter, balBefore, 1_000, "full round-trip");
    }

    function testFuzz_YieldRaisesSharePrice(uint96 yieldAmt) public {
        vm.assume(yieldAmt > 0 && yieldAmt < 1e28);
        token.mint(owner, yieldAmt);
        token.approve(address(vault), type(uint256).max);

        _deposit(alice, DEPOSIT_1K);
        uint256 ppsBefore = vault.pricePerShare();
        vault.addYield(yieldAmt);
        assertGe(vault.pricePerShare(), ppsBefore, "yield never decreases price");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _getSnapshot() internal view returns (uint256 ta, uint256 pps, uint256 ts) {
        MarketVault.PerformanceSnapshot memory s = vault.lastSnapshot();
        ta  = s.totalAssets;
        pps = s.pricePerShare;
        ts  = s.timestamp;
    }
}
