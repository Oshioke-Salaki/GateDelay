// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WithdrawalShares} from "../contracts/WithdrawalShares.sol";

// ─── Mock underlying token ────────────────────────────────────────────────────

contract MockUnderlying is ERC20 {
    constructor() ERC20("USD Collateral", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract WithdrawalSharesTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockUnderlying  usdc;
    WithdrawalShares ws;

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        usdc = new MockUnderlying();
        ws   = new WithdrawalShares(owner, address(usdc));

        _mintAndApprove(alice, 10_000 ether);
        _mintAndApprove(bob,   10_000 ether);
    }

    function _mintAndApprove(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(ws), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deployment
    // ─────────────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(ws.name(), "Withdrawal Shares");
        assertEq(ws.symbol(), "WS");
        assertEq(ws.totalSupply(), 0);
        assertEq(ws.totalUnderlying(), 0);
        assertEq(address(ws.underlying()), address(usdc));
        assertFalse(ws.paused());
    }

    function test_RevertOnZeroUnderlying() public {
        vm.expectRevert(WithdrawalShares.ZeroAddress.selector);
        new WithdrawalShares(owner, address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deposit & share calculation
    // ─────────────────────────────────────────────────────────────────────────

    function test_FirstDepositorGetsOneToOneShares() public {
        vm.prank(alice);
        uint256 shares = ws.deposit(1_000 ether);
        assertEq(shares, 1_000 ether);
        assertEq(ws.balanceOf(alice), 1_000 ether);
        assertEq(ws.totalUnderlying(), 1_000 ether);
    }

    function test_SecondDepositorProportionalShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        // Bob deposits same amount → same shares (pool unchanged ratio)
        vm.prank(bob);
        uint256 shares = ws.deposit(1_000 ether);
        assertEq(shares, 1_000 ether);
        assertEq(ws.totalSupply(), 2_000 ether);
        assertEq(ws.totalUnderlying(), 2_000 ether);
    }

    function test_DepositRevertsWhenPaused() public {
        vm.prank(owner);
        ws.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.ContractPaused.selector);
        ws.deposit(100 ether);
    }

    function test_DepositRevertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.ZeroAmount.selector);
        ws.deposit(0);
    }

    function test_PreviewDepositMatchesMint() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        // Second deposit: preview should equal actual minted
        uint256 preview = ws.previewDeposit(500 ether);
        vm.prank(bob);
        uint256 actual = ws.deposit(500 ether);
        assertEq(preview, actual);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Redemption request
    // ─────────────────────────────────────────────────────────────────────────

    function test_RequestRedemptionLocksShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(400 ether);

        // Shares should be locked (held by contract)
        assertEq(ws.balanceOf(alice), 600 ether);
        assertEq(ws.balanceOf(address(ws)), 400 ether);

        WithdrawalShares.RedemptionRecord memory r = ws.getRedemption(id);
        assertEq(r.id, id);
        assertEq(r.user, alice);
        assertEq(r.shares, 400 ether);
        assertEq(r.underlyingAmount, 400 ether); // 1:1 at this point
        assertEq(uint8(r.status), uint8(WithdrawalShares.RedemptionStatus.PENDING));
    }

    function test_RequestRevertsOnInsufficientShares() public {
        vm.prank(alice);
        ws.deposit(100 ether);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.InsufficientShares.selector);
        ws.requestRedemption(200 ether);
    }

    function test_RequestRevertsWhenPaused() public {
        vm.prank(alice);
        ws.deposit(100 ether);

        vm.prank(owner);
        ws.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.ContractPaused.selector);
        ws.requestRedemption(50 ether);
    }

    function test_RequestRevertsOnZeroShares() public {
        vm.prank(alice);
        ws.deposit(100 ether);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.ZeroAmount.selector);
        ws.requestRedemption(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Redemption tracking
    // ─────────────────────────────────────────────────────────────────────────

    function test_RedemptionHistoryTracked() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        ws.requestRedemption(300 ether);

        vm.prank(alice);
        ws.requestRedemption(200 ether);

        uint256[] memory ids = ws.userRedemptionIds(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Execute redemption (share burning)
    // ─────────────────────────────────────────────────────────────────────────

    function test_ExecuteRedemptionBurnsSharesAndTransfers() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(1_000 ether);

        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ws.executeRedemption(id);

        assertEq(usdc.balanceOf(alice) - usdcBefore, 1_000 ether);
        assertEq(ws.totalSupply(), 0);
        assertEq(ws.totalUnderlying(), 0);
        assertEq(uint8(ws.statusOf(id)), uint8(WithdrawalShares.RedemptionStatus.EXECUTED));
    }

    function test_OwnerCanExecuteRedemption() public {
        vm.prank(alice);
        ws.deposit(500 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(500 ether);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(owner);
        ws.executeRedemption(id);
        assertEq(usdc.balanceOf(alice) - before, 500 ether);
    }

    function test_ExecuteRevertsIfNotOwnerOfRedemption() public {
        vm.prank(alice);
        ws.deposit(500 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(300 ether);

        vm.prank(bob);
        vm.expectRevert(WithdrawalShares.NotRedemptionOwner.selector);
        ws.executeRedemption(id);
    }

    function test_CannotExecuteTwice() public {
        vm.prank(alice);
        ws.deposit(100 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(100 ether);

        vm.prank(alice);
        ws.executeRedemption(id);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.RedemptionNotPending.selector);
        ws.executeRedemption(id);
    }

    function test_ExecuteRevertsOnUnknown() public {
        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.UnknownRedemption.selector);
        ws.executeRedemption(999);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Cancel redemption
    // ─────────────────────────────────────────────────────────────────────────

    function test_CancelRedemptionRestoresShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(600 ether);
        assertEq(ws.balanceOf(alice), 400 ether);

        vm.prank(alice);
        ws.cancelRedemption(id);

        assertEq(ws.balanceOf(alice), 1_000 ether);
        assertEq(uint8(ws.statusOf(id)), uint8(WithdrawalShares.RedemptionStatus.CANCELLED));
    }

    function test_CancelRevertsIfNotOwner() public {
        vm.prank(alice);
        ws.deposit(200 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(100 ether);

        vm.prank(bob);
        vm.expectRevert(WithdrawalShares.NotRedemptionOwner.selector);
        ws.cancelRedemption(id);
    }

    function test_CannotCancelExecuted() public {
        vm.prank(alice);
        ws.deposit(100 ether);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(100 ether);

        vm.prank(alice);
        ws.executeRedemption(id);

        vm.prank(alice);
        vm.expectRevert(WithdrawalShares.RedemptionNotPending.selector);
        ws.cancelRedemption(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Share transfers (ERC-20 compliance)
    // ─────────────────────────────────────────────────────────────────────────

    function test_TransferShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        ws.transfer(bob, 400 ether);

        assertEq(ws.balanceOf(alice), 600 ether);
        assertEq(ws.balanceOf(bob),   400 ether);
    }

    function test_TransferFromShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        ws.approve(bob, 500 ether);

        vm.prank(bob);
        ws.transferFrom(alice, bob, 300 ether);

        assertEq(ws.balanceOf(alice), 700 ether);
        assertEq(ws.balanceOf(bob),   300 ether);
    }

    function test_BobCanRedeemTransferredShares() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        vm.prank(alice);
        ws.transfer(bob, 500 ether);

        vm.prank(bob);
        uint256 id = ws.requestRedemption(500 ether);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        ws.executeRedemption(id);

        assertGt(usdc.balanceOf(bob) - before, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Queries
    // ─────────────────────────────────────────────────────────────────────────

    function test_SharePrice_InitiallyOneToOne() public view {
        assertEq(ws.sharePrice(), 1e18);
    }

    function test_SharePrice_AfterDeposit() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);
        assertEq(ws.sharePrice(), 1e18);
    }

    function test_PreviewRedemptionMatchesActual() public {
        vm.prank(alice);
        ws.deposit(1_000 ether);

        uint256 preview = ws.previewRedemption(400 ether);
        assertEq(preview, 400 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_DepositAndFullRedemption(uint256 amount) public {
        amount = bound(amount, 1 ether, 5_000 ether);
        _mintAndApprove(alice, amount);

        vm.prank(alice);
        uint256 shares = ws.deposit(amount);

        vm.prank(alice);
        uint256 id = ws.requestRedemption(shares);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        ws.executeRedemption(id);

        // User should receive at least as much as they deposited (no fee here).
        assertEq(usdc.balanceOf(alice) - before, amount);
    }
}
