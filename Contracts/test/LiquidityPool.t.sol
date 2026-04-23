// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LiquidityPool.sol";
import "../src/ERC20Token.sol";
import "../src/MarketFactory.sol";

contract LiquidityPoolTest is Test {
    ERC20Token internal collateral;
    LiquidityPool internal pool;

    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);
    address internal marketAddr = address(0xDEAD);

    uint256 constant INITIAL_SUPPLY = 1_000_000;

    function setUp() public {
        // Deploy collateral token — minted to this test contract
        collateral = new ERC20Token(INITIAL_SUPPLY);

        // Deploy pool
        pool = new LiquidityPool(address(collateral), marketAddr);

        // Fund alice and bob
        collateral.transfer(alice, 100_000 ether);
        collateral.transfer(bob,   100_000 ether);
    }

    // =========================================================================
    // Helper
    // =========================================================================

    function _approveAndDeposit(address user, uint256 amount) internal {
        vm.startPrank(user);
        collateral.approve(address(pool), amount);
        pool.deposit(amount);
        vm.stopPrank();
    }

    // =========================================================================
    // Property-based fuzz tests
    // =========================================================================

    // Feature: prediction-market-contracts, Property 7: Deposit-withdraw round trip
    // Validates: Requirements 3.1, 3.4
    function testFuzz_depositWithdrawRoundTrip(uint128 depositAmount) public {
        // Bound to alice's available balance (100_000 ether from setUp)
        uint256 amount = bound(uint256(depositAmount), 1, 100_000 ether);

        uint256 balanceBefore = collateral.balanceOf(alice);

        vm.startPrank(alice);
        collateral.approve(address(pool), amount);
        pool.deposit(amount);

        uint256 lpBalance = pool.lpBalanceOf(alice);
        pool.withdraw(lpBalance);
        vm.stopPrank();

        uint256 balanceAfter = collateral.balanceOf(alice);

        // Allow at most 1 wei rounding loss
        assertApproxEqAbs(balanceAfter, balanceBefore, 1, "round trip should return original collateral within 1 wei");
    }

    // Feature: prediction-market-contracts, Property 8: Pool metrics internal consistency
    // Validates: Requirements 3.6
    function testFuzz_poolMetricsConsistency(uint128 amount1, uint128 amount2) public {
        vm.assume(amount1 > 0);
        vm.assume(amount2 > 0);
        // Ensure alice and bob have enough
        vm.assume(uint256(amount1) <= 100_000 ether);
        vm.assume(uint256(amount2) <= 100_000 ether);

        _approveAndDeposit(alice, uint256(amount1));
        _approveAndDeposit(bob,   uint256(amount2));

        LiquidityPool.PoolMetrics memory metrics = pool.getPoolMetrics();

        uint256 aliceLp = pool.lpBalanceOf(alice);
        uint256 bobLp   = pool.lpBalanceOf(bob);
        uint256 sumLp   = aliceLp + bobLp;

        assertEq(metrics.totalLPSupply, sumLp, "totalLPSupply must equal sum of all LP balances");
    }

    // Feature: prediction-market-contracts, Property 9: Deposit rejected when market is finalised
    // Validates: Requirements 3.8
    function testFuzz_deposit_rejectsFinalisedMarket(uint128 depositAmount) public {
        vm.assume(depositAmount > 0);
        vm.assume(uint256(depositAmount) <= 100_000 ether);

        // Test RESOLVED status
        pool.setMarketStatus(MarketFactory.MarketStatus.RESOLVED);

        vm.startPrank(alice);
        collateral.approve(address(pool), uint256(depositAmount));
        vm.expectRevert(LiquidityPool.MarketFinalised.selector);
        pool.deposit(uint256(depositAmount));
        vm.stopPrank();

        // Test CANCELLED status
        pool.setMarketStatus(MarketFactory.MarketStatus.CANCELLED);

        vm.startPrank(alice);
        collateral.approve(address(pool), uint256(depositAmount));
        vm.expectRevert(LiquidityPool.MarketFinalised.selector);
        pool.deposit(uint256(depositAmount));
        vm.stopPrank();
    }

    // =========================================================================
    // Unit tests
    // =========================================================================

    // --- Revert: ZeroDepositAmount (Req 3.9) ---
    function test_deposit_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(LiquidityPool.ZeroDepositAmount.selector);
        pool.deposit(0);
    }

    // --- Revert: MarketFinalised — RESOLVED (Req 3.8) ---
    function test_deposit_revertsWhenResolved() public {
        pool.setMarketStatus(MarketFactory.MarketStatus.RESOLVED);

        vm.startPrank(alice);
        collateral.approve(address(pool), 1 ether);
        vm.expectRevert(LiquidityPool.MarketFinalised.selector);
        pool.deposit(1 ether);
        vm.stopPrank();
    }

    // --- Revert: MarketFinalised — CANCELLED (Req 3.8) ---
    function test_deposit_revertsWhenCancelled() public {
        pool.setMarketStatus(MarketFactory.MarketStatus.CANCELLED);

        vm.startPrank(alice);
        collateral.approve(address(pool), 1 ether);
        vm.expectRevert(LiquidityPool.MarketFinalised.selector);
        pool.deposit(1 ether);
        vm.stopPrank();
    }

    // --- Revert: InsufficientLPBalance (Req 3.5) ---
    function test_withdraw_revertsInsufficientLPBalance() public {
        _approveAndDeposit(alice, 10 ether);

        uint256 lpBalance = pool.lpBalanceOf(alice);

        vm.prank(alice);
        vm.expectRevert(LiquidityPool.InsufficientLPBalance.selector);
        pool.withdraw(lpBalance + 1);
    }

    // --- First deposit: 1:1 LP minting (Req 3.2) ---
    function test_deposit_firstDeposit_oneToOneMinting() public {
        uint256 amount = 50 ether;
        _approveAndDeposit(alice, amount);

        assertEq(pool.lpBalanceOf(alice), amount, "first deposit should mint LP 1:1");
        assertEq(pool.totalLiquidity(), amount, "totalLiquidity should equal deposit");
    }

    // --- Subsequent deposit: proportional LP minting (Req 3.3) ---
    function test_deposit_subsequentDeposit_proportionalMinting() public {
        // Alice deposits 100 ether first
        _approveAndDeposit(alice, 100 ether);

        // Bob deposits 50 ether — should get 50% of existing LP supply
        _approveAndDeposit(bob, 50 ether);

        // totalLPSupply after alice = 100; bob gets (50 * 100) / 100 = 50
        assertEq(pool.lpBalanceOf(bob), 50 ether, "subsequent deposit should mint proportional LP");
    }

    // --- LiquidityChanged event on deposit (Req 3.7) ---
    function test_deposit_emitsLiquidityChanged() public {
        uint256 amount = 10 ether;

        vm.startPrank(alice);
        collateral.approve(address(pool), amount);

        vm.expectEmit(true, false, false, true);
        emit LiquidityPool.LiquidityChanged(alice, true, amount, amount); // first deposit: lpMinted == amount
        pool.deposit(amount);
        vm.stopPrank();
    }

    // --- LiquidityChanged event on withdrawal (Req 3.7) ---
    function test_withdraw_emitsLiquidityChanged() public {
        uint256 amount = 10 ether;
        _approveAndDeposit(alice, amount);

        uint256 lpBalance = pool.lpBalanceOf(alice);

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, true);
        emit LiquidityPool.LiquidityChanged(alice, false, amount, lpBalance);
        pool.withdraw(lpBalance);
        vm.stopPrank();
    }

    // --- Withdraw returns correct collateral (Req 3.4) ---
    function test_withdraw_returnsCorrectCollateral() public {
        uint256 amount = 20 ether;
        _approveAndDeposit(alice, amount);

        uint256 balanceBefore = collateral.balanceOf(alice);
        uint256 lpBalance = pool.lpBalanceOf(alice);

        vm.prank(alice);
        pool.withdraw(lpBalance);

        uint256 balanceAfter = collateral.balanceOf(alice);
        assertEq(balanceAfter - balanceBefore, amount, "should receive full collateral back");
    }

    // --- totalFeesCollected is queryable (Req 3.10) ---
    function test_totalFeesCollected_isQueryable() public {
        // Initially zero
        assertEq(pool.totalFeesCollected(), 0);
    }

    // --- getPoolMetrics returns correct values (Req 3.6) ---
    function test_getPoolMetrics_correctValues() public {
        _approveAndDeposit(alice, 100 ether);

        LiquidityPool.PoolMetrics memory metrics = pool.getPoolMetrics();

        assertEq(metrics.totalLiquidity, 100 ether);
        assertEq(metrics.totalLPSupply, 100 ether);
        assertEq(metrics.utilisationBps, 0); // no trading yet
    }

    // --- getPoolMetrics on empty pool returns zeros ---
    function test_getPoolMetrics_emptyPool() public {
        LiquidityPool.PoolMetrics memory metrics = pool.getPoolMetrics();
        assertEq(metrics.totalLiquidity, 0);
        assertEq(metrics.totalLPSupply, 0);
        assertEq(metrics.utilisationBps, 0);
    }

    // --- lpBalanceOf returns correct balance ---
    function test_lpBalanceOf_correctBalance() public {
        assertEq(pool.lpBalanceOf(alice), 0);
        _approveAndDeposit(alice, 30 ether);
        assertEq(pool.lpBalanceOf(alice), 30 ether);
    }

    // --- Partial withdrawal (Req 3.4) ---
    function test_withdraw_partial() public {
        _approveAndDeposit(alice, 100 ether);

        uint256 lpBalance = pool.lpBalanceOf(alice);
        uint256 halfLp = lpBalance / 2;

        vm.prank(alice);
        pool.withdraw(halfLp);

        // Should have received ~50 ether back
        assertEq(pool.lpBalanceOf(alice), lpBalance - halfLp);
        assertEq(pool.totalLiquidity(), 50 ether);
    }
}
