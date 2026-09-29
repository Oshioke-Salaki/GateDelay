// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";
import "../src/MarketMaker.sol";
import "../src/Trading.sol";

contract TradingTest is Test {
    event TradeExecuted(
        address indexed trader,
        uint256 indexed marketId,
        uint256 outcome,
        bool isBuy,
        uint256 shares,
        uint256 collateralAmount,
        uint256 fee,
        uint256 rebate,
        address indexed referrer
    );

    ERC20Token token;
    MarketMaker mm;
    Trading trading;

    address alice = address(0xA);
    address bob = address(0xB);

    uint256 constant WAD = 1e18;
    uint256 constant B = 100 * WAD;
    uint256 constant FEE = 30; // 0.3%
    uint256 marketId;

    function setUp() public {
        token = new ERC20Token(0);
        mm = new MarketMaker(address(token));
        trading = new Trading(address(mm), FEE, 0, address(this)); // 0 rebate, this as commission recipient

        token.addMinter(address(mm));
        token.mint(alice, 10_000 * WAD);
        token.mint(bob, 10_000 * WAD);

        // Trading contract needs to be approved as a minter so MM can pull from it
        // (Trading holds MM positions on behalf of traders)
        marketId = mm.createMarket("Flight delayed?", 2, B);
    }

    // ── Fee calculation ───────────────────────────────────────────────────────
    function testFeeAccumulation() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();

        assertEq(trading.accumulatedCommission(), fee);
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
        trading.setFeeSplit(50, 0);
        assertEq(trading.feeBps(), 50);
    }

    function testSetFeeExceedsMax() public {
        vm.expectRevert(Trading.InvalidFee.selector);
        trading.setFeeSplit(1001, 0);
    }

    function testSetFeeUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Trading.Unauthorized.selector);
        trading.setFeeSplit(10, 0);
    }

    function testSetCommissionRecipientUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Trading.Unauthorized.selector);
        trading.setCommissionRecipient(bob);
    }

    // ── Fee withdrawal ────────────────────────────────────────────────────────
    function testWithdrawFees() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 total = rawCost + (rawCost * FEE) / 10_000;

        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();

        uint256 fees = trading.accumulatedCommission();
        uint256 balBefore = token.balanceOf(address(this));
        trading.withdrawFees(address(this));

        assertEq(token.balanceOf(address(this)), balBefore + fees);
        assertEq(trading.accumulatedCommission(), 0);
    }

    function testWithdrawFeesUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Trading.Unauthorized.selector);
        trading.withdrawFees(alice);
    }

    // ── Trade events ──────────────────────────────────────────────────────────
    function testBuyEmitsEvent() public {
        uint256 shares = 5 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        uint256 rebate = 0; // No referrer set
        address referrer = address(0);

        vm.startPrank(alice);
        token.approve(address(trading), total);
        vm.expectEmit(true, true, false, false);
        emit TradeExecuted(alice, marketId, 0, true, shares, total, fee, rebate, referrer);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();
    }

    // ── Slippage protection — comprehensive tests ───────────────────────────────
    
    function testBuySlippageExactCost() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total); // exact cost should work
        vm.stopPrank();
    }

    function testBuySlippageOneWeiOver() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee + 1; // 1 wei over
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total); // 1 wei over should work
        vm.stopPrank();
    }

    function testBuySlippageOneWeiUnder() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total - 1); // 1 wei under
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, shares, total - 1);
        vm.stopPrank();
    }

    function testBuySlippageWithReferrer() public {
        uint256 shares = 5 * WAD;
        
        // Set up referrer with 50% rebate (feeBps=30, rebateBps=15)
        trading.setFeeSplit(30, 15);
        
        vm.prank(alice);
        trading.setMyMarketReferrer(bob);
        
        // Get cost with new fee parameters
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * 30) / 10_000;
        uint256 total = rawCost + fee;
        uint256 expectedRebate = (fee * 15) / 30; // rebate = fee * rebateBps / feeBps
        address referrer = bob;
        
        uint256 bobBalanceBefore = token.balanceOf(bob);
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        vm.expectEmit(true, true, false, false);
        emit TradeExecuted(alice, marketId, 0, true, shares, total, fee, expectedRebate, referrer);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();
        
        // Check rebate was sent to referrer
        assertEq(token.balanceOf(bob) - bobBalanceBefore, expectedRebate);
        
        // Reset fee
        trading.setFeeSplit(FEE, 0);
    }

    function testBuySlippageWithReferrerUnderMax() public {
        uint256 shares = 5 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        // Set up referrer with 50% rebate
        trading.setFeeSplit(FEE, 15); // 50% rebate
        
        vm.prank(alice);
        trading.setMyMarketReferrer(bob);
        
        uint256 rebate = (fee * 15) / 30;
        address referrer = bob;
        
        vm.startPrank(alice);
        token.approve(address(trading), total - 1); // under max by 1 wei
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, shares, total - 1);
        vm.stopPrank();
        
        // Reset fee
        trading.setFeeSplit(FEE, 0);
    }

    // ── Sell slippage protection ──────────────────────────────────────────────
    
    function testSellSlippageReverts() public {
        // First buy some shares
        uint256 buyShares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, buyShares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, buyShares, total);
        vm.stopPrank();
        
        // Now try to sell with minProceeds too high
        uint256 sellShares = 5 * WAD;
        uint256 expectedProceeds = mm.getCostToBuy(marketId, 0, sellShares); // proxy for proceeds
        
        vm.startPrank(alice);
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeSell(marketId, 0, sellShares, expectedProceeds + 1); // minProceeds too high
        vm.stopPrank();
    }

    function testSellSlippageExactProceeds() public {
        // First buy some shares
        uint256 buyShares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, buyShares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, buyShares, total);
        vm.stopPrank();
        
        // Now sell with exact minProceeds
        uint256 sellShares = 5 * WAD;
        uint256 expectedProceeds = mm.getCostToBuy(marketId, 0, sellShares);
        
        vm.startPrank(alice);
        trading.executeSell(marketId, 0, sellShares, expectedProceeds); // exact should work
        vm.stopPrank();
    }

    function testSellSlippageOneWeiUnder() public {
        // First buy some shares
        uint256 buyShares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, buyShares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, buyShares, total);
        vm.stopPrank();
        
        // Now sell with minProceeds 1 wei under expected
        uint256 sellShares = 5 * WAD;
        uint256 expectedProceeds = mm.getCostToBuy(marketId, 0, sellShares);
        
        vm.startPrank(alice);
        trading.executeSell(marketId, 0, sellShares, expectedProceeds - 1); // 1 wei under
        vm.stopPrank();
    }

    // ── Large trade slippage ──────────────────────────────────────────────────
    
    function testBuyLargeTradeSlippage() public {
        // Buy a large amount that significantly moves the price
        uint256 largeShares = 50 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, largeShares);
        uint256 fee = (rawCost * FEE) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, largeShares, total);
        vm.stopPrank();
        
        // Verify price moved significantly
        uint256 priceAfter = mm.getPrice(marketId, 0);
        assertGt(priceAfter, WAD / 2);
    }

    function testConsecutiveBuysSlippage() public {
        uint256 shares = 5 * WAD;
        
        // First buy
        uint256 rawCost1 = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee1 = (rawCost1 * FEE) / 10_000;
        uint256 total1 = rawCost1 + fee1;
        
        vm.startPrank(alice);
        token.approve(address(trading), total1);
        trading.executeBuy(marketId, 0, shares, total1);
        vm.stopPrank();
        
        // Second buy - price has moved, cost should be higher
        uint256 rawCost2 = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee2 = (rawCost2 * FEE) / 10_000;
        uint256 total2 = rawCost2 + fee2;
        
        assertGt(rawCost2, rawCost1); // price moved up
        
        vm.startPrank(alice);
        token.approve(address(trading), total2);
        trading.executeBuy(marketId, 0, shares, total2);
        vm.stopPrank();
    }

    // ── Max cost edge cases ───────────────────────────────────────────────────
    
    function testBuyMaxCostZero() public {
        vm.prank(alice);
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, 10 * WAD, 0);
    }

    function testBuyMaxCostOneWei() public {
        vm.startPrank(alice);
        token.approve(address(trading), 1);
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, 10 * WAD, 1);
        vm.stopPrank();
    }

    function testBuyMaxCostEqualsFeeOnly() public {
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * FEE) / 10_000;
        
        // Try with maxCost = fee only (less than rawCost)
        vm.startPrank(alice);
        token.approve(address(trading), fee);
        vm.expectRevert(Trading.SlippageExceeded.selector);
        trading.executeBuy(marketId, 0, shares, fee);
        vm.stopPrank();
    }

    function testBuyMaxCostWithHighFee() public {
        // Set fee to 10% (1000 bps)
        trading.setFeeSplit(1000, 0);
        
        uint256 shares = 10 * WAD;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 fee = (rawCost * 1000) / 10_000;
        uint256 total = rawCost + fee;
        
        vm.startPrank(alice);
        token.approve(address(trading), total);
        trading.executeBuy(marketId, 0, shares, total);
        vm.stopPrank();
        
        // Reset fee
        trading.setFeeSplit(FEE, 0);
    }

    // ── MarketMaker direct slippage tests ─────────────────────────────────────
    
    function testMarketMakerBuySlippage() public {
        uint256 shares = 10 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, shares);
        
        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);
        vm.stopPrank();
        
        // Verify position
        assertEq(mm.positions(alice, marketId, 0), shares);
    }

    function testMarketMakerSellSlippage() public {
        // Buy first
        uint256 buyShares = 10 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, buyShares);
        
        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, buyShares);
        vm.stopPrank();
        
        // Sell
        uint256 sellShares = 5 * WAD;
        uint256 proceeds = mm.getCostToBuy(marketId, 0, sellShares);
        
        uint256 balBefore = token.balanceOf(alice);
        vm.startPrank(alice);
        mm.sell(marketId, 0, sellShares);
        vm.stopPrank();
        
        assertGt(token.balanceOf(alice), balBefore);
    }
}