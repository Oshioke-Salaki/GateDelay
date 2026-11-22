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
    address resolver = address(0xBEEF);
    address evidenceApprover = address(0xE01D);

    uint256 constant WAD = 1e18;
    uint256 constant B = 100 * WAD;
    uint256 marketId;
    uint256 resolutionTime;
    uint256 initialSubsidy;

    function setUp() public {
        token = new ERC20Token(0);
        mm = new MarketMaker(address(token));

        mm.setApprovedResolver(resolver, true);
        mm.setEvidenceApprover(evidenceApprover, true);

        // Fund alice, bob, and the market creator (this contract)
        token.mint(alice, 10_000 * WAD);
        token.mint(bob, 10_000 * WAD);

        initialSubsidy = mm.requiredInitialSubsidy(2, B);
        token.mint(address(this), 10_000 * WAD);
        token.approve(address(mm), initialSubsidy);

        resolutionTime = block.timestamp + 1 days;

        // Create a funded, timed, resolver-gated binary market
        marketId = mm.createMarket("Will flight be delayed?", 2, B, resolutionTime, resolver, initialSubsidy);
    }

    function _approveAndResolve(uint256 mid, uint256 winningOutcome) internal {
        bytes32 evidenceHash = keccak256(abi.encode("flight-report", mid, winningOutcome));
        vm.prank(evidenceApprover);
        mm.approveEvidence(mid, winningOutcome, evidenceHash, "ipfs://evidence-report");

        vm.prank(resolver);
        mm.resolve(mid, winningOutcome, evidenceHash);
    }

    // ── Market creation ───────────────────────────────────────────────────────
    function testCreateMarket() public view {
        (string memory desc, uint256 b, uint256 numOutcomes, bool resolved,, address creator) = mm.markets(marketId);
        MarketMaker.MarketMeta memory meta = mm.getMarketMeta(marketId);

        assertEq(desc, "Will flight be delayed?");
        assertEq(b, B);
        assertEq(numOutcomes, 2);
        assertFalse(resolved);
        assertEq(creator, address(this));
        assertEq(meta.resolutionTime, resolutionTime);
        assertFalse(meta.paused);
        assertEq(meta.resolver, resolver);
        assertEq(meta.factoryMarket, address(0));
        assertEq(mm.getMarketReserve(marketId), initialSubsidy);
        assertEq(mm.totalReservedCollateral(), initialSubsidy);
    }

    function testCreateMarketRequiresMinOutcomes() public {
        vm.expectRevert("MM: need >= 2 outcomes");
        mm.createMarket("bad", 1, B, resolutionTime, resolver, initialSubsidy);
    }

    function testCreateMarketRequiresSufficientSubsidy() public {
        uint256 required = mm.requiredInitialSubsidy(2, B);
        token.approve(address(mm), required - 1);
        vm.expectRevert(abi.encodeWithSelector(MarketMaker.InsufficientSubsidy.selector, required - 1, required));
        mm.createMarket("underfunded", 2, B, resolutionTime, resolver, required - 1);
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
        assertEq(mm.getMarketReserve(marketId), initialSubsidy + cost);
        assertEq(mm.getMarketLiability(marketId), shares);
        assertTrue(mm.isMarketSolvent(marketId));
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
        assertEq(mm.getMarketReserve(marketId), initialSubsidy);
        assertEq(mm.getMarketLiability(marketId), 0);
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

        vm.warp(resolutionTime);
        _approveAndResolve(marketId, 0); // outcome 0 wins

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        mm.redeem(marketId);

        assertEq(token.balanceOf(alice), balBefore + shares);
        assertEq(mm.positions(alice, marketId, 0), 0);
        assertEq(mm.getMarketLiability(marketId), 0);
    }

    function testResolveUnauthorizedOwnerAndCreatorRevert() public {
        vm.warp(resolutionTime);
        bytes32 evidenceHash = keccak256("evidence");
        vm.prank(evidenceApprover);
        mm.approveEvidence(marketId, 0, evidenceHash, "ipfs://evidence");

        // Even owner/creator cannot resolve directly
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, evidenceHash);

        // Random user cannot resolve
        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, evidenceHash);
    }

    function testResolveBeforeResolutionTimeReverts() public {
        bytes32 evidenceHash = keccak256("evidence");
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.ResolutionTooEarly.selector);
        mm.resolve(marketId, 0, evidenceHash);
    }

    function testResolveAlreadyResolved() public {
        vm.warp(resolutionTime);
        _approveAndResolve(marketId, 0);

        bytes32 secondHash = keccak256("second");
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.MarketAlreadyResolved.selector);
        mm.resolve(marketId, 1, secondHash);
    }

    function testRedeemBeforeResolution() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.MarketNotResolved.selector);
        mm.redeem(marketId);
    }

    // ── Multiple outcomes ─────────────────────────────────────────────────────
    function testMultipleOutcomes() public {
        uint256 sub3 = mm.requiredInitialSubsidy(3, B);
        token.approve(address(mm), sub3);
        uint256 mid = mm.createMarket("3-outcome market", 3, B, resolutionTime, resolver, sub3);
        uint256 p0 = mm.getPrice(mid, 0);
        uint256 p1 = mm.getPrice(mid, 1);
        uint256 p2 = mm.getPrice(mid, 2);
        assertApproxEqRel(p0 + p1 + p2, WAD, 1e15);
    }
}
