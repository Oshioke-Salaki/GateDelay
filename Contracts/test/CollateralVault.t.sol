// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CollateralVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract CollateralVaultTest is Test {
    CollateralVault internal vault;
    MockToken       internal token;

    address internal alice     = address(0xA11CE);
    address internal bob       = address(0xB0B);
    address internal liquidator = address(0xL1Q);
    address internal market    = address(0xDEAD);
    address internal market2   = address(0xBEEF);

    function setUp() public {
        vault = new CollateralVault();
        token = new MockToken();

        // Register market
        vault.registerMarket(market, address(token));

        // Fund users
        token.mint(alice, 100_000 ether);
        token.mint(bob,   100_000 ether);

        // Approve liquidator
        vault.setLiquidator(liquidator, true);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _deposit(address user, uint256 amount) internal {
        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(market, amount);
        vm.stopPrank();
    }

    // ── Registration ───────────────────────────────────────────────────────────

    function test_registerMarket_storesToken() public {
        assertEq(vault.getCollateralToken(market), address(token));
    }

    function test_registerMarket_revertsOnDuplicate() public {
        vm.expectRevert(CollateralVault.MarketAlreadyRegistered.selector);
        vault.registerMarket(market, address(token));
    }

    function test_registerMarket_revertsZeroAddress() public {
        vm.expectRevert(CollateralVault.ZeroAddress.selector);
        vault.registerMarket(address(0), address(token));
    }

    // ── Deposits ───────────────────────────────────────────────────────────────

    function test_deposit_updatesBalances() public {
        _deposit(alice, 1_000 ether);
        assertEq(vault.getBalance(market, alice), 1_000 ether);
        assertEq(vault.getMarketBalance(market), 1_000 ether);
    }

    function test_deposit_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.deposit(market, 0);
    }

    function test_deposit_revertsUnregisteredMarket() public {
        vm.prank(alice);
        vm.expectRevert(CollateralVault.MarketNotRegistered.selector);
        vault.deposit(market2, 1 ether);
    }

    function test_deposit_revertsWhenPaused() public {
        vault.setPaused(true);
        vm.startPrank(alice);
        token.approve(address(vault), 1 ether);
        vm.expectRevert(CollateralVault.VaultPaused.selector);
        vault.deposit(market, 1 ether);
        vm.stopPrank();
    }

    function testFuzz_deposit_tracksBalance(uint128 amount) public {
        vm.assume(amount > 0);
        vm.assume(uint256(amount) <= 100_000 ether);
        _deposit(alice, uint256(amount));
        assertEq(vault.getBalance(market, alice), uint256(amount));
    }

    // ── Withdrawals ────────────────────────────────────────────────────────────

    function test_withdraw_returnsCollateral() public {
        _deposit(alice, 500 ether);
        uint256 before = token.balanceOf(alice);

        vm.prank(alice);
        vault.withdraw(market, 500 ether);

        assertEq(token.balanceOf(alice) - before, 500 ether);
        assertEq(vault.getBalance(market, alice), 0);
    }

    function test_withdraw_revertsInsufficientBalance() public {
        _deposit(alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(CollateralVault.InsufficientBalance.selector);
        vault.withdraw(market, 101 ether);
    }

    function test_withdraw_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.withdraw(market, 0);
    }

    function test_withdraw_revertsWhenPaused() public {
        _deposit(alice, 100 ether);
        vault.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(CollateralVault.VaultPaused.selector);
        vault.withdraw(market, 100 ether);
    }

    function testFuzz_depositWithdrawRoundTrip(uint128 amount) public {
        vm.assume(amount > 0);
        vm.assume(uint256(amount) <= 100_000 ether);
        uint256 before = token.balanceOf(alice);
        _deposit(alice, uint256(amount));
        vm.prank(alice);
        vault.withdraw(market, uint256(amount));
        assertEq(token.balanceOf(alice), before);
    }

    // ── Liquidation ────────────────────────────────────────────────────────────

    function test_liquidate_seizesCollateral() public {
        _deposit(alice, 1_000 ether);
        uint256 recipientBefore = token.balanceOf(bob);

        vm.prank(liquidator);
        vault.liquidate(market, alice, 400 ether, bob);

        assertEq(vault.getBalance(market, alice), 600 ether);
        assertEq(token.balanceOf(bob) - recipientBefore, 400 ether);
    }

    function test_liquidate_revertsIfNotLiquidator() public {
        _deposit(alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(CollateralVault.NotAuthorized.selector);
        vault.liquidate(market, alice, 50 ether, bob);
    }

    function test_liquidate_revertsInsufficientBalance() public {
        _deposit(alice, 100 ether);
        vm.prank(liquidator);
        vm.expectRevert(CollateralVault.InsufficientBalance.selector);
        vault.liquidate(market, alice, 200 ether, bob);
    }

    function test_liquidate_revertsZeroAmount() public {
        vm.prank(liquidator);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.liquidate(market, alice, 0, bob);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    function test_getBalance_returnsZeroForUnknown() public {
        assertEq(vault.getBalance(market, address(0xCAFE)), 0);
    }

    function test_getMarketBalance_aggregatesDeposits() public {
        _deposit(alice, 300 ether);
        _deposit(bob,   200 ether);
        assertEq(vault.getMarketBalance(market), 500 ether);
    }

    function test_getCollateralToken_returnsToken() public {
        assertEq(vault.getCollateralToken(market), address(token));
    }
}
