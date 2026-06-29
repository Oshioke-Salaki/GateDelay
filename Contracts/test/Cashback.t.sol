// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CashbackContract.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract CashbackTest is Test {
    CashbackContract cashback;
    ERC20PresetMinterPauser token;

    bytes32 constant TIER1 = keccak256("TIER1");
    bytes32 constant TIER2 = keccak256("TIER2");

    address alice = address(0xA1);
    address bob = address(0xB2);
    address feeEngine = address(0xFEE);

    function setUp() public {
        token = new ERC20PresetMinterPauser("TestToken", "TT", address(this));
        cashback = new CashbackContract(address(token), address(this));

        // Fund cashback contract
        token.mint(address(this), 1_000_000 ether);
        token.approve(address(cashback), 1_000_000 ether);
        cashback.fund(1_000_000 ether);

        // Setup tiers
        cashback.defineTier(TIER1, 500); // 5%
        cashback.defineTier(TIER2, 1000); // 10%

        // Setup authorization
        cashback.setAuthorized(feeEngine, true);

        // Assign user tiers
        cashback.assignUserTier(alice, TIER1);
        cashback.assignUserTier(bob, TIER2);

        // no need to fund users for recordCashback; it's feeAmount input only
    }

    function test_recordCashback_accruesCorrectly() public {
        vm.prank(feeEngine);
        cashback.recordCashback(alice, 1000 ether); // cashback = 50 ether

        vm.prank(feeEngine);
        cashback.recordCashback(bob, 1000 ether); // cashback = 100 ether

        assertEq(cashback.getAccrued(alice), 50 ether);
        assertEq(cashback.getAccrued(bob), 100 ether);
    }

    function test_claim_transfersAndResets() public {
        vm.startPrank(feeEngine);
        cashback.recordCashback(alice, 1000 ether);
        vm.stopPrank();

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        cashback.claim();
        uint256 afterBal = token.balanceOf(alice);

        assertEq(afterBal - before, 50 ether);
        assertEq(cashback.getAccrued(alice), 0);
    }

    function test_claim_revertsWhenNothing() public {
        vm.prank(alice);
        vm.expectRevert();
        cashback.claim();
    }

    function test_recordCashback_revertsWhenUnauthorized() public {
        vm.prank(address(this));
        vm.expectRevert();
        cashback.recordCashback(alice, 100 ether);
    }
}

