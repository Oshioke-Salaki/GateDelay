// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";
import "../src/MarketMaker.sol";
import "../src/Trading.sol";

contract TradingTest is Test {
    ERC20Token  token;
    MarketMaker mm;
    Trading     trading;

    address alice = address(0xA);
    address bob   = address(0xB);

    uint256 constant WAD    = 1e18;
    uint256 constant B      = 100 * WAD;
    uint256 constant FEE    = 30; // 0.3%
    uint256 marketId;

    function setUp() public {
        token   = new ERC20Token(0);
        mm      = new MarketMaker(address(token));
        trading = new Trading(address(mm), FEE);

        token.addMinter(address(mm));
        token.mint(alice, 10_000 * WAD);
        token.mint(bob,   10_000 * WAD);

        // Trading contract needs to be approved as a minter so MM can pull from it
        // (Trading holds MM positions on behalf of traders)
        marketId = mm.createMarket("Flight delayed?", 2, B);
    }

    // ── Fee calculation ───────────────────────────────────────────────────────
    function testFeeAccumulation() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee     = (rawCost * FEE) / 10_000;
        uint256 total   = rawCost + fee;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();

        assertEq(trading.accumulatedFees(), fee);
    }

    // ── Slippage protection ───────────────────────────────────────────────────
    function testBuySlippageReverts() public {
        uint256 shares = 10 * WAD;
        vm.startPrank(alice);
        token.approve(address(trading), 1); // way too low
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, shares, 1);
        vm.stopPrank();
    }

    // ── Zero amount ───────────────────────────────────────────────────────────
    function testBuyZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(Trading.ZeroAmount.selector);
        trading.executeBuy(marketId, 0, 0, 0);
    }

    // ── Fee update ────────────────────────────────────────────────────────────
    function testSetFee() public {
        trading.setFeeBps(50);
        assertEq(trading.feeBps(), 50);
    }

    function testSetFeeExceedsMax() public {
        vm.expectRevert(Trading.InvalidFee.selector);
        trading.setFeeBps(1001);
    }

    function testSetFeeUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Trading.Unauthorized.selector);
        trading.setFeeBps(10);
    }

    // ── Fee withdrawal ────────────────────────────────────────────────────────
    function testWithdrawFees() public {
        uint256 shares  = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 total   = rawCost + (rawCost * FEE) / 10_000;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();

        uint256 fees = trading.accumulatedFees();
        uint256 balBefore = token.balanceOf(address(this));
        trading.withdrawFees(address(this));

        assertEq(token.balanceOf(address(this)), balBefore + fees);
        assertEq(trading.accumulatedFees(), 0);
    }

    function testWithdrawFeesUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Trading.Unauthorized.selector);
        trading.withdrawFees(alice);
    }

    // ── Trade events ──────────────────────────────────────────────────────────
    function testBuyEmitsEvent() public {
        uint256 shares  = 5 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee     = (rawCost * FEE) / 10_000;
        uint256 total   = rawCost + fee;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        vm.expectEmit(true, true, false, false);
        emit Trading.TradeExecuted(alice, marketId, 0, true, shares, total, fee);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();
    }

    // ── Position tracking ─────────────────────────────────────────────────────
    function testPositionTracked() public {
        uint256 shares  = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 total   = rawCost + (rawCost * FEE) / 10_000;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();

        assertEq(trading.getPosition(alice, marketId, 0), shares);
    }
}
