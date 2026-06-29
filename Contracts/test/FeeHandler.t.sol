// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FeeHandler} from "../contracts/FeeHandler.sol";

// ─── Mock ERC20 ────────────────────────────────────────────────────────────────

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── FeeHandlerTest ────────────────────────────────────────────────────────────

contract FeeHandlerTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address payer = makeAddr("payer");

    // ── Contracts ─────────────────────────────────────────────────────────────
    FeeHandler handler;
    MockERC20 token;

    // ── Fee structure ids ─────────────────────────────────────────────────────
    bytes32 constant TRADING = keccak256("TRADING");
    bytes32 constant WITHDRAWAL = keccak256("WITHDRAWAL");

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        handler = new FeeHandler();
        token = new MockERC20("Test Token", "TT");

        token.mint(payer, 1_000_000 ether);
        vm.prank(payer);
        token.approve(address(handler), type(uint256).max);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _single(bytes32 id, uint256 feeBps, address recipient) internal {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](1);
        r[0] = FeeHandler.FeeRecipient({account: recipient, shareBps: 10_000});
        handler.setFeeStructure(id, feeBps, r);
    }

    function _split5050(bytes32 id, uint256 feeBps) internal {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](2);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 5_000});
        r[1] = FeeHandler.FeeRecipient({account: bob, shareBps: 5_000});
        handler.setFeeStructure(id, feeBps, r);
    }

    // ── setFeeStructure ───────────────────────────────────────────────────────

    function test_setFeeStructure_ownerCanCreate() public {
        _single(TRADING, 30, alice);

        (uint256 feeBps, bool active, FeeHandler.FeeRecipient[] memory r) = handler.getFeeStructure(TRADING);

        assertEq(feeBps, 30);
        assertTrue(active);
        assertEq(r.length, 1);
        assertEq(r[0].account, alice);
        assertEq(r[0].shareBps, 10_000);
    }

    function test_setFeeStructure_revertsOnFeeTooHigh() public {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](1);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 10_000});
        vm.expectRevert(FeeHandler.FeeTooHigh.selector);
        handler.setFeeStructure(TRADING, 1_001, r);
    }

    function test_setFeeStructure_revertsOnInvalidShareSum() public {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](2);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 4_000});
        r[1] = FeeHandler.FeeRecipient({account: bob, shareBps: 4_000}); // sum = 8 000
        vm.expectRevert(FeeHandler.InvalidRecipients.selector);
        handler.setFeeStructure(TRADING, 30, r);
    }

    function test_setFeeStructure_revertsOnZeroAddress() public {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](1);
        r[0] = FeeHandler.FeeRecipient({account: address(0), shareBps: 10_000});
        vm.expectRevert(FeeHandler.ZeroAddress.selector);
        handler.setFeeStructure(TRADING, 30, r);
    }

    function test_setFeeStructure_revertsForNonOwner() public {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](1);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 10_000});
        vm.prank(alice);
        vm.expectRevert();
        handler.setFeeStructure(TRADING, 30, r);
    }

    function test_setFeeStructure_replacesRecipients() public {
        _single(TRADING, 30, alice);
        _split5050(TRADING, 50);

        (,, FeeHandler.FeeRecipient[] memory r) = handler.getFeeStructure(TRADING);
        assertEq(r.length, 2);
        assertEq(r[0].account, alice);
        assertEq(r[1].account, bob);
    }

    // ── calculateFee ──────────────────────────────────────────────────────────

    function test_calculateFee_correctAmount() public {
        _single(TRADING, 30, alice); // 0.30 %
        // 0.30 % of 10 000 ether = 30 ether
        assertEq(handler.calculateFee(10_000 ether, TRADING), 30 ether);
    }

    function test_calculateFee_multipleStructures() public {
        _single(TRADING, 30, alice); // 0.30 %
        _single(WITHDRAWAL, 50, bob); // 0.50 %

        assertEq(handler.calculateFee(10_000 ether, TRADING), 30 ether);
        assertEq(handler.calculateFee(10_000 ether, WITHDRAWAL), 50 ether);
    }

    function test_calculateFee_revertsOnInactiveStructure() public {
        vm.expectRevert(abi.encodeWithSelector(FeeHandler.StructureNotActive.selector, TRADING));
        handler.calculateFee(1 ether, TRADING);
    }

    // ── collectAndDistribute ──────────────────────────────────────────────────

    function test_collectAndDistribute_singleRecipient() public {
        _single(TRADING, 30, alice); // 0.30 %
        uint256 aliceBefore = token.balanceOf(alice);

        vm.prank(payer);
        uint256 fee = handler.collectAndDistribute(address(token), 10_000 ether, TRADING);

        assertEq(fee, 30 ether);
        assertEq(token.balanceOf(alice) - aliceBefore, 30 ether);
    }

    function test_collectAndDistribute_split5050() public {
        _split5050(TRADING, 100); // 1 %

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 10_000 ether, TRADING);

        // fee = 100 ether split 50 / 50
        assertEq(token.balanceOf(alice), 50 ether);
        assertEq(token.balanceOf(bob), 50 ether);
    }

    function test_collectAndDistribute_threeRecipients() public {
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](3);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 5_000}); // 50 %
        r[1] = FeeHandler.FeeRecipient({account: bob, shareBps: 3_000}); // 30 %
        r[2] = FeeHandler.FeeRecipient({account: charlie, shareBps: 2_000}); // 20 %
        handler.setFeeStructure(TRADING, 100, r); // 1 %

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 10_000 ether, TRADING);

        // fee = 100 ether
        assertEq(token.balanceOf(alice), 50 ether);
        assertEq(token.balanceOf(bob), 30 ether);
        assertEq(token.balanceOf(charlie), 20 ether);
    }

    function test_collectAndDistribute_pullsExactFeeFromPayer() public {
        _single(TRADING, 30, alice);
        uint256 payerBefore = token.balanceOf(payer);

        vm.prank(payer);
        uint256 fee = handler.collectAndDistribute(address(token), 10_000 ether, TRADING);

        assertEq(payerBefore - token.balanceOf(payer), fee, "payer spent exactly the fee");
    }

    function test_collectAndDistribute_revertsOnInactiveStructure() public {
        vm.expectRevert(abi.encodeWithSelector(FeeHandler.StructureNotActive.selector, TRADING));
        vm.prank(payer);
        handler.collectAndDistribute(address(token), 1 ether, TRADING);
    }

    // ── distribute ────────────────────────────────────────────────────────────

    function test_distribute_usesPreTransferredFunds() public {
        _single(TRADING, 30, alice);
        uint256 feeAmount = 50 ether;
        token.mint(address(handler), feeAmount);

        uint256 aliceBefore = token.balanceOf(alice);
        handler.distribute(address(token), feeAmount, TRADING);

        assertEq(token.balanceOf(alice) - aliceBefore, feeAmount);
    }

    function test_distribute_revertsOnInactiveStructure() public {
        token.mint(address(handler), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(FeeHandler.StructureNotActive.selector, TRADING));
        handler.distribute(address(token), 1 ether, TRADING);
    }

    // ── Fee tracking ──────────────────────────────────────────────────────────

    function test_tracking_accumulatesAcrossMultipleCalls() public {
        _single(TRADING, 30, alice);

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 10_000 ether, TRADING); // fee = 30

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 5_000 ether, TRADING); // fee = 15

        assertEq(handler.getCollectedFees(TRADING, address(token)), 45 ether);
        assertEq(handler.getTotalCollectedFees(address(token)), 45 ether);
    }

    function test_tracking_separateByStructure() public {
        _single(TRADING, 30, alice);
        _single(WITHDRAWAL, 50, bob);

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 10_000 ether, TRADING); // fee = 30

        vm.prank(payer);
        handler.collectAndDistribute(address(token), 2_000 ether, WITHDRAWAL); // fee = 10

        assertEq(handler.getCollectedFees(TRADING, address(token)), 30 ether);
        assertEq(handler.getCollectedFees(WITHDRAWAL, address(token)), 10 ether);
        assertEq(handler.getTotalCollectedFees(address(token)), 40 ether);
    }

    // ── Deactivation ──────────────────────────────────────────────────────────

    function test_deactivate_preventsCollection() public {
        _single(TRADING, 30, alice);
        handler.deactivateFeeStructure(TRADING);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(FeeHandler.StructureNotActive.selector, TRADING));
        handler.collectAndDistribute(address(token), 1 ether, TRADING);
    }

    function test_deactivate_revertsForNonOwner() public {
        _single(TRADING, 30, alice);
        vm.prank(alice);
        vm.expectRevert();
        handler.deactivateFeeStructure(TRADING);
    }

    function test_deactivate_canBeReactivated() public {
        _single(TRADING, 30, alice);
        handler.deactivateFeeStructure(TRADING);
        // Reactivate by calling setFeeStructure again
        _single(TRADING, 30, alice);

        vm.prank(payer);
        uint256 fee = handler.collectAndDistribute(address(token), 10_000 ether, TRADING);
        assertEq(fee, 30 ether);
    }

    // ── Fuzz tests ────────────────────────────────────────────────────────────

    function testFuzz_calculateFee_neverExceedsGross(uint256 gross, uint256 feeBps) public {
        feeBps = bound(feeBps, 1, handler.MAX_FEE_BPS());
        gross = bound(gross, 1, type(uint128).max);

        _single(TRADING, feeBps, alice);
        uint256 fee = handler.calculateFee(gross, TRADING);
        assertLe(fee, gross, "fee must not exceed gross");
    }

    function testFuzz_distribute_totalEqualsInput(uint256 feeAmount) public {
        feeAmount = bound(feeAmount, 2, type(uint128).max);

        // 3-recipient split: 50 / 30 / 20
        FeeHandler.FeeRecipient[] memory r = new FeeHandler.FeeRecipient[](3);
        r[0] = FeeHandler.FeeRecipient({account: alice, shareBps: 5_000});
        r[1] = FeeHandler.FeeRecipient({account: bob, shareBps: 3_000});
        r[2] = FeeHandler.FeeRecipient({account: charlie, shareBps: 2_000});
        handler.setFeeStructure(TRADING, 30, r);

        token.mint(address(handler), feeAmount);
        handler.distribute(address(token), feeAmount, TRADING);

        uint256 received = token.balanceOf(alice) + token.balanceOf(bob) + token.balanceOf(charlie);
        assertEq(received, feeAmount, "all fee tokens must be distributed");
    }

    function testFuzz_collectAndDistribute_noContractResidue(uint256 gross) public {
        gross = bound(gross, 1 ether, 100_000 ether);
        _split5050(TRADING, 30);

        token.mint(payer, gross);
        vm.prank(payer);
        token.approve(address(handler), gross);

        uint256 contractBefore = token.balanceOf(address(handler));

        vm.prank(payer);
        handler.collectAndDistribute(address(token), gross, TRADING);

        // Handler should hold no residue after distribution
        assertEq(token.balanceOf(address(handler)), contractBefore, "no tokens left in handler");
    }
}
