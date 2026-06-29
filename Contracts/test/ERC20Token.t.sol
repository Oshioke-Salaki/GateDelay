// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";

contract ERC20TokenTest is Test {
    ERC20Token token;
    address alice = address(0xA);
    address bob = address(0xB);

    function setUp() public {
        token = new ERC20Token(1000);
    }

    // ── Metadata ──────────────────────────────────────────────────────────────
    function testMetadata() public view {
        assertEq(token.name(), "GateDelay Token");
        assertEq(token.symbol(), "GTD");
        assertEq(token.decimals(), 18);
    }

    // ── Initial supply ────────────────────────────────────────────────────────
    function testInitialSupply() public view {
        assertEq(token.totalSupply(), 1000 * 1e18);
        assertEq(token.balanceOf(address(this)), 1000 * 1e18);
    }

    // ── Transfer ──────────────────────────────────────────────────────────────
    function testTransfer() public {
        token.transfer(alice, 100 * 1e18);
        assertEq(token.balanceOf(alice), 100 * 1e18);
        assertEq(token.balanceOf(address(this)), 900 * 1e18);
    }

    function testTransferInsufficientBalance() public {
        vm.expectRevert(ERC20Token.InsufficientBalance.selector);
        token.transfer(alice, 9999 * 1e18);
    }

    function testTransferZeroAddress() public {
        vm.expectRevert(ERC20Token.ZeroAddress.selector);
        token.transfer(address(0), 1);
    }

    // ── Approve / transferFrom ────────────────────────────────────────────────
    function testApproveAndTransferFrom() public {
        token.approve(alice, 200 * 1e18);
        assertEq(token.allowance(address(this), alice), 200 * 1e18);

        vm.prank(alice);
        token.transferFrom(address(this), bob, 150 * 1e18);
        assertEq(token.balanceOf(bob), 150 * 1e18);
        assertEq(token.allowance(address(this), alice), 50 * 1e18);
    }

    function testTransferFromAllowanceExceeded() public {
        token.approve(alice, 10);
        vm.prank(alice);
        vm.expectRevert(ERC20Token.AllowanceExceeded.selector);
        token.transferFrom(address(this), bob, 11);
    }

    function testInfiniteAllowance() public {
        token.approve(alice, type(uint256).max);
        vm.prank(alice);
        token.transferFrom(address(this), bob, 500 * 1e18);
        // allowance should remain max
        assertEq(token.allowance(address(this), alice), type(uint256).max);
    }

    // ── Mint ──────────────────────────────────────────────────────────────────
    function testMint() public {
        token.mint(alice, 500 * 1e18);
        assertEq(token.balanceOf(alice), 500 * 1e18);
        assertEq(token.totalSupply(), 1500 * 1e18);
    }

    function testMintUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(ERC20Token.Unauthorized.selector);
        token.mint(alice, 1);
    }

    function testMintZeroAddress() public {
        vm.expectRevert(ERC20Token.ZeroAddress.selector);
        token.mint(address(0), 1);
    }

    // ── Burn ──────────────────────────────────────────────────────────────────
    function testBurn() public {
        token.burn(100 * 1e18);
        assertEq(token.totalSupply(), 900 * 1e18);
        assertEq(token.balanceOf(address(this)), 900 * 1e18);
    }

    function testBurnFrom() public {
        token.approve(alice, 200 * 1e18);
        vm.prank(alice);
        token.burnFrom(address(this), 200 * 1e18);
        assertEq(token.totalSupply(), 800 * 1e18);
    }

    function testBurnInsufficientBalance() public {
        vm.expectRevert(ERC20Token.InsufficientBalance.selector);
        token.burn(9999 * 1e18);
    }

    // ── Access control ────────────────────────────────────────────────────────
    function testAddRemoveMinter() public {
        token.addMinter(alice);
        assertTrue(token.minters(alice));

        vm.prank(alice);
        token.mint(bob, 1e18);
        assertEq(token.balanceOf(bob), 1e18);

        token.removeMinter(alice);
        assertFalse(token.minters(alice));

        vm.prank(alice);
        vm.expectRevert(ERC20Token.Unauthorized.selector);
        token.mint(bob, 1e18);
    }

    function testTransferOwnership() public {
        token.transferOwnership(alice);
        assertEq(token.owner(), alice);

        vm.prank(alice);
        token.addMinter(bob);
        assertTrue(token.minters(bob));
    }

    function testTransferOwnershipZeroAddress() public {
        vm.expectRevert(ERC20Token.ZeroAddress.selector);
        token.transferOwnership(address(0));
    }

    // ── Permit (EIP-2612) ─────────────────────────────────────────────────────
    function testPermit() public {
        uint256 privKey = 0xBEEF;
        address signer = vm.addr(privKey);
        token.mint(signer, 100 * 1e18);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(token.PERMIT_TYPEHASH(), signer, bob, 50 * 1e18, token.nonces(signer), deadline))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        token.permit(signer, bob, 50 * 1e18, deadline, v, r, s);

        assertEq(token.allowance(signer, bob), 50 * 1e18);
        assertEq(token.nonces(signer), 1);
    }

    function testPermitExpired() public {
        uint256 privKey = 0xBEEF;
        address signer = vm.addr(privKey);
        uint256 deadline = block.timestamp - 1;
        vm.expectRevert(ERC20Token.PermitExpired.selector);
        token.permit(signer, bob, 1, deadline, 0, bytes32(0), bytes32(0));
    }
}
