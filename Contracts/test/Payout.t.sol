// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Payout.sol";
import "../src/ERC20Token.sol";

contract PayoutTest is Test {
    ERC20Token token;
    Payout     payout;

    address alice = address(0xA);
    address bob   = address(0xB);

    uint256 constant WAD = 1e18;

    function setUp() public {
        token  = new ERC20Token(0);
        payout = new Payout(address(token));
        token.addMinter(address(this));
        // Fund the payout contract so it can transfer on claims
        token.mint(address(payout), 10_000 * WAD);
    }

    // ── WINNER_TAKE_ALL ───────────────────────────────────────────────────────

    function testWinnerTakeAll_CorrectPayout() public {
        payout.registerMarket(1, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(1, alice, 0, 100 * WAD); // alice: 100 YES
        payout.recordShares(1, bob,   1, 200 * WAD); // bob:   200 NO
        payout.resolveMarket(1, 0, 0);               // YES wins

        assertEq(payout.calculatePayout(1, alice), 100 * WAD);
        assertEq(payout.calculatePayout(1, bob),   0);
    }

    function testWinnerTakeAll_Claim() public {
        payout.registerMarket(2, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(2, alice, 0, 50 * WAD);
        payout.resolveMarket(2, 0, 0);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        payout.claim(2);
        assertEq(token.balanceOf(alice), before + 50 * WAD);
        assertEq(uint8(payout.getClaimStatus(2, alice)), uint8(Payout.ClaimStatus.CLAIMED));
    }

    function testWinnerTakeAll_DoubleClaim_Reverts() public {
        payout.registerMarket(3, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(3, alice, 0, 10 * WAD);
        payout.resolveMarket(3, 0, 0);

        vm.startPrank(alice);
        payout.claim(3);
        vm.expectRevert(Payout.AlreadyClaimed.selector);
        payout.claim(3);
        vm.stopPrank();
    }

    function testWinnerTakeAll_NothingToClaim_Reverts() public {
        payout.registerMarket(4, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(4, alice, 1, 10 * WAD); // alice holds NO
        payout.resolveMarket(4, 0, 0);              // YES wins

        vm.prank(alice);
        vm.expectRevert(Payout.NothingToClaim.selector);
        payout.claim(4);
    }

    // ── PROPORTIONAL ─────────────────────────────────────────────────────────

    function testProportional_EqualSplit() public {
        payout.registerMarket(10, Payout.PayoutModel.PROPORTIONAL, 0, 0);
        payout.recordShares(10, alice, 0, 100 * WAD);
        payout.recordShares(10, bob,   0, 100 * WAD);
        payout.recordShares(10, alice, 1, 200 * WAD); // losing side
        payout.resolveMarket(10, 0, 0);

        // totalPool = 400 WAD, winningPool = 200 WAD
        // alice: 100/200 * 400 = 200 WAD
        // bob:   100/200 * 400 = 200 WAD
        assertApproxEqAbs(payout.calculatePayout(10, alice), 200 * WAD, 1e9);
        assertApproxEqAbs(payout.calculatePayout(10, bob),   200 * WAD, 1e9);
    }

    function testProportional_UnequalSplit() public {
        payout.registerMarket(11, Payout.PayoutModel.PROPORTIONAL, 0, 0);
        payout.recordShares(11, alice, 0, 300 * WAD); // 75% of winning pool
        payout.recordShares(11, bob,   0, 100 * WAD); // 25% of winning pool
        payout.recordShares(11, bob,   1, 400 * WAD); // losing side
        payout.resolveMarket(11, 0, 0);

        // totalPool = 800 WAD, winningPool = 400 WAD
        // alice: 300/400 * 800 = 600 WAD
        // bob:   100/400 * 800 = 200 WAD
        assertApproxEqAbs(payout.calculatePayout(11, alice), 600 * WAD, 1e9);
        assertApproxEqAbs(payout.calculatePayout(11, bob),   200 * WAD, 1e9);
    }

    // ── SCALAR ────────────────────────────────────────────────────────────────

    function testScalar_AtFloor() public {
        uint256 floor = 0.2e18;
        uint256 ceil  = 0.8e18;
        payout.registerMarket(20, Payout.PayoutModel.SCALAR, floor, ceil);
        payout.recordShares(20, alice, 0, 100 * WAD);
        payout.resolveMarket(20, 0, floor); // settles at floor

        // payout = 100 * 0.2 = 20 WAD
        assertApproxEqAbs(payout.calculatePayout(20, alice), 20 * WAD, 1e9);
    }

    function testScalar_AtCeil() public {
        uint256 floor = 0.2e18;
        uint256 ceil  = 0.8e18;
        payout.registerMarket(21, Payout.PayoutModel.SCALAR, floor, ceil);
        payout.recordShares(21, alice, 0, 100 * WAD);
        payout.resolveMarket(21, 0, ceil); // settles at ceil

        // payout = 100 * 0.8 = 80 WAD
        assertApproxEqAbs(payout.calculatePayout(21, alice), 80 * WAD, 1e9);
    }

    function testScalar_Midpoint() public {
        uint256 floor = 0.2e18;
        uint256 ceil  = 0.8e18;
        uint256 mid   = 0.5e18;
        payout.registerMarket(22, Payout.PayoutModel.SCALAR, floor, ceil);
        payout.recordShares(22, alice, 0, 100 * WAD);
        payout.resolveMarket(22, 0, mid);

        // payout = 100 * 0.5 = 50 WAD
        assertApproxEqAbs(payout.calculatePayout(22, alice), 50 * WAD, 1e9);
    }

    function testScalar_OutOfRange_Reverts() public {
        payout.registerMarket(23, Payout.PayoutModel.SCALAR, 0.2e18, 0.8e18);
        vm.expectRevert(Payout.InvalidPrice.selector);
        payout.resolveMarket(23, 0, 0.9e18); // above ceil
    }

    // ── Guard rails ───────────────────────────────────────────────────────────

    function testClaimBeforeResolution_Reverts() public {
        payout.registerMarket(30, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(30, alice, 0, 10 * WAD);
        vm.prank(alice);
        vm.expectRevert(Payout.NotResolved.selector);
        payout.claim(30);
    }

    function testDoubleResolve_Reverts() public {
        payout.registerMarket(31, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.resolveMarket(31, 0, 0);
        vm.expectRevert(Payout.AlreadyResolved.selector);
        payout.resolveMarket(31, 0, 0);
    }

    function testUnauthorized_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(Payout.Unauthorized.selector);
        payout.registerMarket(99, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_WinnerTakeAll(uint128 aliceShares, uint128 bobShares) public {
        vm.assume(aliceShares > 0 && bobShares > 0);
        uint256 a = uint256(aliceShares);
        uint256 b = uint256(bobShares);

        // Ensure payout contract has enough balance
        token.mint(address(payout), a + b);

        payout.registerMarket(50, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(50, alice, 0, a);
        payout.recordShares(50, bob,   1, b);
        payout.resolveMarket(50, 0, 0);

        assertEq(payout.calculatePayout(50, alice), a);
        assertEq(payout.calculatePayout(50, bob),   0);
    }
}
