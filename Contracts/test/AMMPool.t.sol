// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AMMPool} from "../contracts/AMMPool.sol";
import {UD60x18, unwrap} from "@prb/math/src/UD60x18.sol";

// ─── Mock ERC20 ────────────────────────────────────────────────────────────────

contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) {
        _dec = dec;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── AMMPoolTest ───────────────────────────────────────────────────────────────

contract AMMPoolTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address owner = address(this);
    address feeRecipient = makeAddr("feeRecipient");
    address lp = makeAddr("lp");
    address trader = makeAddr("trader");

    // ── Tokens ────────────────────────────────────────────────────────────────
    MockERC20 tokenA; // 18 decimals — will be sorted to token0 or token1
    MockERC20 tokenB; // 18 decimals

    // ── Pool ──────────────────────────────────────────────────────────────────
    AMMPool pool;

    // ── Shorthand references after sorting ────────────────────────────────────
    MockERC20 t0;
    MockERC20 t1;

    uint256 constant FEE_BPS = 30; // 0.30 %
    uint256 constant PROTOCOL_SHARE = 50; // 50 % of fee goes to protocol

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);

        pool = new AMMPool(address(tokenA), address(tokenB), FEE_BPS, PROTOCOL_SHARE, feeRecipient);

        // Resolve canonical ordering.
        t0 = MockERC20(pool.token0());
        t1 = MockERC20(pool.token1());

        // Seed actors.
        t0.mint(lp, 1_000_000 ether);
        t1.mint(lp, 1_000_000 ether);
        t0.mint(trader, 10_000 ether);
        t1.mint(trader, 10_000 ether);

        // Approve pool from lp and trader.
        vm.startPrank(lp);
        t0.approve(address(pool), type(uint256).max);
        t1.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(trader);
        t0.approve(address(pool), type(uint256).max);
        t1.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    // ── Helper: seed initial liquidity ────────────────────────────────────────

    function _seedLiquidity(uint256 amount0, uint256 amount1) internal returns (uint256 liquidity) {
        vm.prank(lp);
        (,, liquidity) = pool.addLiquidity(amount0, amount1, 0, 0, lp);
    }

    // ── Pair management ───────────────────────────────────────────────────────

    function test_pairTokensAreSet() public view {
        assertTrue(pool.token0() != address(0));
        assertTrue(pool.token1() != address(0));
        assertTrue(pool.token0() < pool.token1(), "token0 must be < token1");
        assertTrue(pool.token0() != pool.token1(), "tokens must differ");
    }

    function test_constructor_revertsOnIdenticalTokens() public {
        vm.expectRevert(AMMPool.IdenticalTokens.selector);
        new AMMPool(address(tokenA), address(tokenA), 30, 50, feeRecipient);
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(AMMPool.ZeroAddress.selector);
        new AMMPool(address(0), address(tokenB), 30, 50, feeRecipient);
    }

    function test_constructor_revertsOnFeeTooHigh() public {
        vm.expectRevert(AMMPool.FeeTooHigh.selector);
        new AMMPool(address(tokenA), address(tokenB), 301, 50, feeRecipient);
    }

    // ── Liquidity provision ───────────────────────────────────────────────────

    function test_addLiquidity_firstDeposit_mintsLPTokens() public {
        uint256 amount0 = 100 ether;
        uint256 amount1 = 100 ether;

        vm.prank(lp);
        (uint256 a0, uint256 a1, uint256 liq) = pool.addLiquidity(amount0, amount1, 0, 0, lp);

        assertEq(a0, amount0);
        assertEq(a1, amount1);
        assertGt(liq, 0, "LP tokens minted");
        assertGt(pool.balanceOf(lp), 0, "LP balance > 0");
        // MINIMUM_LIQUIDITY is permanently locked
        assertEq(pool.totalSupply(), pool.balanceOf(lp) + pool.MINIMUM_LIQUIDITY());
    }

    function test_addLiquidity_subsequentDeposit_maintainsRatio() public {
        _seedLiquidity(100 ether, 200 ether); // 1:2 ratio

        uint256 lpBefore = pool.balanceOf(lp);

        vm.prank(lp);
        // Offer 50:150 — pool accepts 50:100 (bounded by the smaller ratio side)
        (uint256 a0, uint256 a1,) = pool.addLiquidity(50 ether, 150 ether, 0, 0, lp);

        // Pool should have maintained the 1:2 ratio
        assertEq(a1, a0 * 2, "ratio must be maintained");
        assertGt(pool.balanceOf(lp), lpBefore, "LP tokens increased");
    }

    function test_addLiquidity_revertsOnSlippage() public {
        _seedLiquidity(100 ether, 200 ether);

        vm.prank(lp);
        vm.expectRevert(AMMPool.SlippageExceeded.selector);
        // Ask for more token1 than the ratio allows
        pool.addLiquidity(50 ether, 50 ether, 50 ether, 150 ether, lp);
    }

    function test_removeLiquidity_returnsProportionalTokens() public {
        _seedLiquidity(100 ether, 100 ether);

        uint256 lpBalance = pool.balanceOf(lp);
        uint256 half = lpBalance / 2;

        vm.prank(lp);
        (uint256 a0, uint256 a1) = pool.removeLiquidity(half, 0, 0, lp);

        assertGt(a0, 0);
        assertGt(a1, 0);
        // Returned roughly half of reserves (minus rounding)
        assertApproxEqRel(a0, 50 ether, 1e16); // within 1 %
        assertApproxEqRel(a1, 50 ether, 1e16);
    }

    function test_removeLiquidity_revertsOnSlippage() public {
        _seedLiquidity(100 ether, 100 ether);
        uint256 liq = pool.balanceOf(lp);

        vm.prank(lp);
        vm.expectRevert(AMMPool.SlippageExceeded.selector);
        pool.removeLiquidity(liq, 200 ether, 0, lp); // impossibly high min
    }

    // ── Swap prices ───────────────────────────────────────────────────────────

    function test_getAmountOut_decreasesWithLargerInput() public {
        _seedLiquidity(1_000 ether, 1_000 ether);
        (uint112 r0, uint112 r1,) = pool.getReserves();

        uint256 out1 = pool.getAmountOut(1 ether, r0, r1);
        uint256 out2 = pool.getAmountOut(10 ether, r0, r1);
        uint256 out3 = pool.getAmountOut(100 ether, r0, r1);

        // Each larger input should yield more output but with increasing slippage
        assertGt(out2, out1);
        assertGt(out3, out2);
        // Price impact: out3 / 100 < out1 / 1  (larger trades get worse rate)
        assertLt(out3 / 100, out1);
    }

    function test_getAmountOut_revertsOnZeroInput() public {
        _seedLiquidity(100 ether, 100 ether);
        (uint112 r0, uint112 r1,) = pool.getReserves();
        vm.expectRevert(AMMPool.InsufficientInputAmount.selector);
        pool.getAmountOut(0, r0, r1);
    }

    function test_getAmountIn_isInverseOfGetAmountOut() public {
        _seedLiquidity(1_000 ether, 1_000 ether);
        (uint112 r0, uint112 r1,) = pool.getReserves();

        uint256 amountIn = 10 ether;
        uint256 amountOut = pool.getAmountOut(amountIn, r0, r1);
        uint256 computed = pool.getAmountIn(amountOut, r0, r1);

        // getAmountIn rounds up by 1 — allow a 1-unit tolerance
        assertApproxEqAbs(computed, amountIn, 1);
    }

    // ── Price queries (PRBMath) ───────────────────────────────────────────────

    function test_getPrice0_returnsCorrectSpotPrice() public {
        // 1:2 pool: 1 token0 = 2 token1
        _seedLiquidity(100 ether, 200 ether);
        UD60x18 price = pool.getPrice0();
        // price should be 2.0 (within 0.01 %)
        assertApproxEqRel(unwrap(price), 2e18, 1e14);
    }

    function test_getPrice1_returnsCorrectSpotPrice() public {
        // 1:2 pool: 1 token1 = 0.5 token0
        _seedLiquidity(100 ether, 200 ether);
        UD60x18 price = pool.getPrice1();
        assertApproxEqRel(unwrap(price), 0.5e18, 1e14);
    }

    function test_getPrice0_revertsOnEmptyPool() public {
        vm.expectRevert(AMMPool.InsufficientLiquidity.selector);
        pool.getPrice0();
    }

    // ── Swap execution ────────────────────────────────────────────────────────

    function test_swapExactInput_token0ForToken1() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        uint256 amountIn = 10 ether;
        uint256 t1Before = t1.balanceOf(trader);

        vm.prank(trader);
        uint256 amountOut = pool.swapExactInput(address(t0), amountIn, 1, trader);

        assertGt(amountOut, 0);
        assertEq(t1.balanceOf(trader) - t1Before, amountOut, "trader received t1");
    }

    function test_swapExactInput_token1ForToken0() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        uint256 amountIn = 10 ether;
        uint256 t0Before = t0.balanceOf(trader);

        vm.prank(trader);
        uint256 amountOut = pool.swapExactInput(address(t1), amountIn, 1, trader);

        assertGt(amountOut, 0);
        assertEq(t0.balanceOf(trader) - t0Before, amountOut);
    }

    function test_swapExactInput_revertsOnSlippage() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        vm.prank(trader);
        vm.expectRevert(AMMPool.SlippageExceeded.selector);
        pool.swapExactInput(address(t0), 10 ether, type(uint256).max, trader);
    }

    function test_swapExactInput_revertsOnInvalidToken() public {
        _seedLiquidity(100 ether, 100 ether);
        vm.prank(trader);
        vm.expectRevert(AMMPool.InvalidToken.selector);
        pool.swapExactInput(address(0xdead), 1 ether, 0, trader);
    }

    function test_swapExactOutput_token0ForExactToken1() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        uint256 amountOut = 5 ether;
        uint256 t1Before = t1.balanceOf(trader);
        uint256 t0Before = t0.balanceOf(trader);

        vm.prank(trader);
        uint256 amountIn = pool.swapExactOutput(address(t1), amountOut, type(uint256).max, trader);

        assertGt(amountIn, 0);
        assertEq(t1.balanceOf(trader) - t1Before, amountOut, "received exact output");
        assertEq(t0Before - t0.balanceOf(trader), amountIn, "spent correct input");
    }

    function test_swapExactOutput_revertsOnSlippage() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        vm.prank(trader);
        vm.expectRevert(AMMPool.SlippageExceeded.selector);
        pool.swapExactOutput(address(t1), 5 ether, 1 wei, trader); // maxIn too low
    }

    // ── Constant product invariant ─────────────────────────────────────────────

    function test_kNeverDecreasesAfterSwap() public {
        _seedLiquidity(1_000 ether, 1_000 ether);
        (uint112 r0Before, uint112 r1Before,) = pool.getReserves();
        uint256 kBefore = uint256(r0Before) * uint256(r1Before);

        vm.prank(trader);
        pool.swapExactInput(address(t0), 10 ether, 1, trader);

        (uint112 r0After, uint112 r1After,) = pool.getReserves();
        uint256 kAfter = uint256(r0After) * uint256(r1After);

        assertGe(kAfter, kBefore, "k must not decrease after swap");
    }

    // ── Fee collection ────────────────────────────────────────────────────────

    function test_protocolFeesAccumulate() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        vm.prank(trader);
        pool.swapExactInput(address(t0), 100 ether, 1, trader);

        assertGt(pool.protocolFees0(), 0, "protocol fees should accumulate");
    }

    function test_collectProtocolFees_sendsToRecipient() public {
        _seedLiquidity(1_000 ether, 1_000 ether);

        vm.prank(trader);
        pool.swapExactInput(address(t0), 100 ether, 1, trader);

        uint256 fees0 = pool.protocolFees0();
        uint256 before0 = t0.balanceOf(feeRecipient);

        pool.collectProtocolFees();

        assertEq(t0.balanceOf(feeRecipient) - before0, fees0);
        assertEq(pool.protocolFees0(), 0, "fees reset after collection");
    }

    function test_lpsFeeEarnedViaGrowingK() public {
        _seedLiquidity(1_000 ether, 1_000 ether);
        uint256 lpTokens = pool.balanceOf(lp);

        // Several swaps to accumulate LP fees
        vm.startPrank(trader);
        for (uint256 i; i < 5; i++) {
            pool.swapExactInput(address(t0), 10 ether, 1, trader);
            pool.swapExactInput(address(t1), 10 ether, 1, trader);
        }
        vm.stopPrank();

        // Remove liquidity — LP should get back more than deposited (fee income)
        uint256 t0Before = t0.balanceOf(lp);
        uint256 t1Before = t1.balanceOf(lp);

        vm.prank(lp);
        pool.removeLiquidity(lpTokens, 0, 0, lp);

        uint256 t0Received = t0.balanceOf(lp) - t0Before;
        uint256 t1Received = t1.balanceOf(lp) - t1Before;

        // LP should receive more than their original 1 000 ether each
        assertGt(t0Received + t1Received, 2_000 ether, "LPs earned fees");
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function test_setFeeRate_ownerCanUpdate() public {
        pool.setFeeRate(100);
        assertEq(pool.feeRateBps(), 100);
    }

    function test_setFeeRate_revertsAboveMax() public {
        vm.expectRevert(AMMPool.FeeTooHigh.selector);
        pool.setFeeRate(301);
    }

    function test_setFeeRate_revertsForNonOwner() public {
        vm.prank(trader);
        vm.expectRevert();
        pool.setFeeRate(10);
    }

    function test_setProtocolShare_ownerCanUpdate() public {
        pool.setProtocolShare(100);
        assertEq(pool.protocolSharePct(), 100);
    }

    function test_setProtocolShare_revertsAbove100() public {
        vm.expectRevert(AMMPool.InvalidProtocolShare.selector);
        pool.setProtocolShare(101);
    }

    function test_setFeeRecipient_ownerCanUpdate() public {
        address newRecipient = makeAddr("newRecipient");
        pool.setFeeRecipient(newRecipient);
        assertEq(pool.feeRecipient(), newRecipient);
    }

    function test_setFeeRecipient_revertsOnZeroAddress() public {
        vm.expectRevert(AMMPool.ZeroAddress.selector);
        pool.setFeeRecipient(address(0));
    }

    // ── Fuzz tests ────────────────────────────────────────────────────────────

    function testFuzz_swapExactInput_kNeverDecreases(uint256 amountIn) public {
        _seedLiquidity(1_000 ether, 1_000 ether);
        amountIn = bound(amountIn, 1 ether, 100 ether);

        (uint112 r0, uint112 r1,) = pool.getReserves();
        uint256 kBefore = uint256(r0) * uint256(r1);

        t0.mint(trader, amountIn);
        vm.prank(trader);
        pool.swapExactInput(address(t0), amountIn, 1, trader);

        (uint112 r0After, uint112 r1After,) = pool.getReserves();
        uint256 kAfter = uint256(r0After) * uint256(r1After);

        assertGe(kAfter, kBefore);
    }

    function testFuzz_addRemoveLiquidity_noValueLeak(uint256 amount) public {
        amount = bound(amount, 1 ether, 10_000 ether);

        // First LP seeds the pool
        _seedLiquidity(1_000 ether, 1_000 ether);

        // Second LP adds and immediately removes
        t0.mint(address(this), amount);
        t1.mint(address(this), amount);
        t0.approve(address(pool), amount);
        t1.approve(address(pool), amount);

        (,, uint256 liq) = pool.addLiquidity(amount, amount, 0, 0, address(this));

        uint256 t0Before = t0.balanceOf(address(this));
        uint256 t1Before = t1.balanceOf(address(this));

        pool.removeLiquidity(liq, 0, 0, address(this));

        uint256 t0After = t0.balanceOf(address(this));
        uint256 t1After = t1.balanceOf(address(this));

        // Cannot withdraw more than deposited
        assertLe(t0After - t0Before + (t1After - t1Before), amount * 2);
    }
}
