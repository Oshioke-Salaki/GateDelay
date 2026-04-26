// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";
import "../src/MarketMaker.sol";

contract MarketMakerTest is Test {
    ERC20Token token;
    MarketMaker mm;

    address alice = address(0xA);
    address bob = address(0xB);

    uint256 constant WAD = 1e18;
    uint256 constant B = 100 * WAD;
    uint256 marketId;

    function setUp() public {
        token = new ERC20Token(0);
        mm = new MarketMaker(address(token));

        // Grant MarketMaker minting rights so it can be funded
        token.addMinter(address(mm));

        // Fund alice and bob
        token.mint(alice, 10_000 * WAD);
        token.mint(bob, 10_000 * WAD);

        // Create a binary market
        marketId = mm.createMarket("Will flight be delayed?", 2, B);
    }

    // ── Market creation ───────────────────────────────────────────────────────
    function testCreateMarket() public view {
(
    string memory desc,
    uint256 b,
    uint256 numOutcomes,
    bool resolved,
    ,
    address creator
) = mm.markets(marketId);

assertEq(desc, "Will flight be delayed?");
assertEq(b, B);
        assertEq(numOutcomes, 2);
        assertFalse(resolved);
        assertEq(creator, address(this));
    }

    function testCreateMarketRequiresMinOutcomes() public {
        vm.expectRevert("MM: need >= 2 outcomes");
        mm.createMarket("bad", 1, B);
    }

    // ── Buy ───────────────────────────────────────────────────────────────────
    function testBuy() public {
        uint256 shares = 10 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, shares);

        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);
        vm.stopPrank();

        assertEq(mm.positions(alice, marketId, 0), shares);
        assertEq(token.balanceOf(alice), 10_000 * WAD - cost);
    }

    function testBuyZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.ZeroAmount.selector);
        mm.buy(marketId, 0, 0);
    }

    // ── Sell ──────────────────────────────────────────────────────────────────
    function testSell() public {
        uint256 shares = 10 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, shares);

        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);

        uint256 balBefore = token.balanceOf(alice);
        mm.sell(marketId, 0, shares);
        vm.stopPrank();

        assertEq(mm.positions(alice, marketId, 0), 0);
        assertGt(token.balanceOf(alice), balBefore);
    }

    function testSellInsufficientShares() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.InsufficientShares.selector);
        mm.sell(marketId, 0, 1 * WAD);
    }

    // ── Price queries ─────────────────────────────────────────────────────────
    function testPricesEqualAtStart() public view {
        uint256 p0 = mm.getPrice(marketId, 0);
        uint256 p1 = mm.getPrice(marketId, 1);
        assertApproxEqRel(p0, WAD / 2, 1e15);
        assertApproxEqRel(p1, WAD / 2, 1e15);
    }

    function testPriceShiftsAfterBuy() public {
        uint256 shares = 50 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, shares);

        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);
        vm.stopPrank();

        assertGt(mm.getPrice(marketId, 0), WAD / 2);
        assertLt(mm.getPrice(marketId, 1), WAD / 2);
    }

    // ── Resolution & redemption ───────────────────────────────────────────────
    function testResolveAndRedeem() public {
        uint256 shares = 10 * WAD;
        uint256 cost = mm.getCostToBuy(marketId, 0, shares);

        vm.startPrank(alice);
        token.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);
        vm.stopPrank();

        mm.resolve(marketId, 0); // outcome 0 wins

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        mm.redeem(marketId);

        assertEq(token.balanceOf(alice), balBefore + shares);
        assertEq(mm.positions(alice, marketId, 0), 0);
    }

    function testResolveUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0);
    }

    function testResolveAlreadyResolved() public {
        mm.resolve(marketId, 0);
        vm.expectRevert(MarketMaker.MarketAlreadyResolved.selector);
        mm.resolve(marketId, 1);
    }

    function testRedeemBeforeResolution() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.MarketNotResolved.selector);
        mm.redeem(marketId);
    }

    // ── Multiple outcomes ─────────────────────────────────────────────────────
    function testMultipleOutcomes() public {
        uint256 mid = mm.createMarket("3-outcome market", 3, B);
        uint256 p0 = mm.getPrice(mid, 0);
        uint256 p1 = mm.getPrice(mid, 1);
        uint256 p2 = mm.getPrice(mid, 2);
        assertApproxEqRel(p0 + p1 + p2, WAD, 1e15);
    }
}
