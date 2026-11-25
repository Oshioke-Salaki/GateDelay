// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";
import "../src/MarketMaker.sol";

/// @notice Emergency trading halt (#1376): who can halt/resume, what is blocked,
///         and that resolution and redemption keep working while halted.
contract MarketMakerEmergencyHaltTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant B = 100 * WAD;

    ERC20Token token;
    MarketMaker mm;

    address resolver = address(0xBEEF);
    address evidenceApprover = address(0xE11D);
    address guardian = address(0x6A2D);
    address alice = address(0xA11CE);
    address wrapper = address(0x3A11);

    uint256 marketId;
    uint256 resolutionTime;

    function setUp() public {
        token = new ERC20Token(0);
        mm = new MarketMaker(address(token));
        mm.setApprovedResolver(resolver, true);
        mm.setEvidenceApprover(evidenceApprover, true);
        mm.setPauseGuardian(guardian);
        mm.setApprovedWrapper(wrapper, true);

        token.mint(address(this), 10_000 * WAD);
        token.mint(alice, 10_000 * WAD);
        token.mint(wrapper, 10_000 * WAD);
        token.approve(address(mm), type(uint256).max);
        vm.prank(alice);
        token.approve(address(mm), type(uint256).max);
        vm.prank(wrapper);
        token.approve(address(mm), type(uint256).max);

        resolutionTime = block.timestamp + 1 days;
        marketId = mm.createMarket("halt", 2, B, resolutionTime, resolver, mm.requiredInitialSubsidy(2, B));

        vm.prank(alice);
        mm.buy(marketId, 0, 10 * WAD);
    }

    // ── Authorization ─────────────────────────────────────────────────────────

    function testOwnerAndGuardianCanHalt() public {
        vm.expectEmit(true, false, false, false);
        emit MarketMaker.TradingHalted(guardian);
        vm.prank(guardian);
        mm.haltTrading();
        assertTrue(mm.tradingHalted());

        mm.resumeTrading();
        mm.haltTrading();
        assertTrue(mm.tradingHalted());
    }

    function testOthersCannotHalt() public {
        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.haltTrading();
    }

    function testClearedGuardianCannotHalt() public {
        mm.setPauseGuardian(address(0));
        vm.prank(guardian);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.haltTrading();
    }

    function testOnlyOwnerCanResume() public {
        mm.haltTrading();
        vm.prank(guardian);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resumeTrading();

        mm.resumeTrading();
        assertFalse(mm.tradingHalted());
    }

    function testOnlyOwnerSetsGuardian() public {
        vm.prank(guardian);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.setPauseGuardian(alice);
    }

    // ── Blocked while halted ──────────────────────────────────────────────────

    function testHaltBlocksTradingAndCreation() public {
        mm.haltTrading();

        vm.startPrank(alice);
        vm.expectRevert(MarketMaker.TradingIsHalted.selector);
        mm.buy(marketId, 0, WAD);
        vm.expectRevert(MarketMaker.TradingIsHalted.selector);
        mm.sell(marketId, 0, WAD);
        vm.stopPrank();

        vm.startPrank(wrapper);
        vm.expectRevert(MarketMaker.TradingIsHalted.selector);
        mm.buyFor(marketId, alice, 0, WAD, type(uint256).max);
        vm.expectRevert(MarketMaker.TradingIsHalted.selector);
        mm.sellFor(marketId, alice, 0, WAD, 0);
        vm.stopPrank();

        uint256 sub = mm.requiredInitialSubsidy(2, B);
        vm.expectRevert(MarketMaker.TradingIsHalted.selector);
        mm.createMarket("new", 2, B, resolutionTime, resolver, sub);
    }

    function testResumeRestoresTrading() public {
        mm.haltTrading();
        mm.resumeTrading();
        vm.prank(alice);
        mm.sell(marketId, 0, WAD);
        assertEq(mm.positions(alice, marketId, 0), 9 * WAD);
    }

    // ── Safe exit preserved while halted ──────────────────────────────────────

    function testResolutionRedemptionAndResidualWorkWhileHalted() public {
        mm.haltTrading();

        // Topping up a reserve only adds safety, so it stays allowed.
        mm.fundMarket(marketId, WAD);

        vm.warp(resolutionTime);
        bytes32 evidenceHash = keccak256("evidence");
        vm.prank(evidenceApprover);
        mm.approveEvidence(marketId, 0, evidenceHash, "ipfs://evidence");
        vm.prank(resolver);
        mm.resolve(marketId, 0, evidenceHash);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = mm.redeem(marketId);
        assertEq(payout, 10 * WAD);
        assertEq(token.balanceOf(alice) - before, 10 * WAD);

        assertGt(mm.withdrawResidualReserve(marketId, address(this)), 0);
        assertTrue(mm.tradingHalted(), "halt is untouched by the exit path");
    }
}
