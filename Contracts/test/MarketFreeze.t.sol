// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketFreeze.sol";

contract MarketFreezeTest is Test {
    MarketFreeze freeze;

    address owner = address(0xA11CE);
    address freezer = address(0xBEEF);
    address other = address(0xCAFE);
    address market = address(0xAAAA);
    address market2 = address(0xBBBB);

    function setUp() public {
        freeze = new MarketFreeze(owner);
        vm.prank(owner);
        freeze.addFreezer(freezer);
    }

    // ------- freezer registry -------

    function test_OwnerAddRemoveFreezer() public {
        address f = address(0xF11);
        vm.prank(owner);
        freeze.addFreezer(f);
        assertTrue(freeze.isFreezer(f));

        vm.prank(owner);
        freeze.removeFreezer(f);
        assertFalse(freeze.isFreezer(f));
    }

    function test_NonOwnerCannotAddFreezer() public {
        vm.prank(other);
        vm.expectRevert();
        freeze.addFreezer(address(0xF1));
    }

    function test_CannotAddZeroFreezer() public {
        vm.prank(owner);
        vm.expectRevert(MarketFreeze.ZeroAddress.selector);
        freeze.addFreezer(address(0));
    }

    function test_CannotAddDuplicateFreezer() public {
        vm.prank(owner);
        vm.expectRevert(MarketFreeze.AlreadyFreezer.selector);
        freeze.addFreezer(freezer);
    }

    function test_CannotRemoveUnknownFreezer() public {
        vm.prank(owner);
        vm.expectRevert(MarketFreeze.NotFreezer.selector);
        freeze.removeFreezer(other);
    }

    function test_GetFreezersList() public {
        vm.prank(owner);
        freeze.addFreezer(other);
        address[] memory list = freeze.getFreezers();
        assertEq(list.length, 2);
    }

    // ------- market-wide freeze -------

    function test_FreezeMarket() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "exploit drill");

        assertTrue(freeze.isMarketFrozen(market));
        assertTrue(freeze.isOperationFrozen(market, freeze.OP_TRADE()));
    }

    function test_NonFreezerCannotFreeze() public {
        vm.prank(other);
        vm.expectRevert(MarketFreeze.NotFreezer.selector);
        freeze.freezeMarket(market, "x");
    }

    function test_OwnerCanFreezeWithoutBeingFreezer() public {
        vm.prank(owner);
        freeze.freezeMarket(market, "ad-hoc");
        assertTrue(freeze.isMarketFrozen(market));
    }

    function test_CannotFreezeZeroMarket() public {
        vm.prank(freezer);
        vm.expectRevert(MarketFreeze.InvalidMarket.selector);
        freeze.freezeMarket(address(0), "x");
    }

    function test_CannotFreezeTwice() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "first");

        vm.prank(freezer);
        vm.expectRevert(abi.encodeWithSelector(MarketFreeze.MarketAlreadyFrozen.selector, freeze.OP_ALL()));
        freeze.freezeMarket(market, "second");
    }

    function test_UnfreezeMarket() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "x");
        vm.prank(freezer);
        freeze.unfreezeMarket(market);

        assertFalse(freeze.isMarketFrozen(market));
        assertFalse(freeze.isOperationFrozen(market, freeze.OP_TRADE()));
    }

    function test_CannotUnfreezeIfNotFrozen() public {
        vm.prank(freezer);
        vm.expectRevert(abi.encodeWithSelector(MarketFreeze.MarketNotFrozen.selector, freeze.OP_ALL()));
        freeze.unfreezeMarket(market);
    }

    // ------- selective operation freeze -------

    function test_SelectiveFreezeOnlyAffectsOneOp() public {
        vm.prank(freezer);
        freeze.freezeOperation(market, freeze.OP_WITHDRAW(), "rate-limit");

        assertTrue(freeze.isOperationFrozen(market, freeze.OP_WITHDRAW()));
        assertFalse(freeze.isOperationFrozen(market, freeze.OP_TRADE()));
        assertFalse(freeze.isMarketFrozen(market));
    }

    function test_OpAllFreezeOverridesOpQuery() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "kill");

        assertTrue(freeze.isOperationFrozen(market, freeze.OP_DEPOSIT()));
        assertTrue(freeze.isOperationFrozen(market, freeze.OP_RESOLVE()));
    }

    function test_UnfreezeSelectiveLeavesOthers() public {
        bytes32 wOp = freeze.OP_WITHDRAW();
        bytes32 tOp = freeze.OP_TRADE();

        vm.startPrank(freezer);
        freeze.freezeOperation(market, wOp, "w");
        freeze.freezeOperation(market, tOp, "t");
        freeze.unfreezeOperation(market, wOp);
        vm.stopPrank();

        assertFalse(freeze.isOperationFrozen(market, wOp));
        assertTrue(freeze.isOperationFrozen(market, tOp));
    }

    function test_FreezeIsolationBetweenMarkets() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "isolated");

        assertTrue(freeze.isMarketFrozen(market));
        assertFalse(freeze.isMarketFrozen(market2));
        assertFalse(freeze.isOperationFrozen(market2, freeze.OP_TRADE()));
    }

    // ------- guards & metadata -------

    function test_RequireOperationAllowedReverts() public {
        vm.prank(freezer);
        freeze.freezeOperation(market, freeze.OP_TRADE(), "halt");

        vm.expectRevert(abi.encodeWithSelector(MarketFreeze.OperationFrozen.selector, freeze.OP_TRADE()));
        freeze.requireOperationAllowed(market, freeze.OP_TRADE());
    }

    function test_RequireOperationAllowedPasses() public view {
        freeze.requireOperationAllowed(market, freeze.OP_TRADE());
    }

    function test_GetFreezeInfoCarriesMetadata() public {
        vm.prank(freezer);
        freeze.freezeMarket(market, "incident-42");

        MarketFreeze.FreezeInfo memory info = freeze.getFreezeInfo(market, freeze.OP_ALL());
        assertTrue(info.frozen);
        assertEq(info.frozenBy, freezer);
        assertEq(info.reason, "incident-42");
        assertGt(uint256(info.frozenAt), 0);
    }

    function test_UnfreezeClearsMetadata() public {
        vm.startPrank(freezer);
        freeze.freezeMarket(market, "x");
        freeze.unfreezeMarket(market);
        vm.stopPrank();

        MarketFreeze.FreezeInfo memory info = freeze.getFreezeInfo(market, freeze.OP_ALL());
        assertFalse(info.frozen);
        assertEq(info.frozenBy, address(0));
    }
}
