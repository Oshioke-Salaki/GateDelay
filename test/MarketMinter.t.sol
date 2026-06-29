// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketMinter.sol";
import "../Contracts/src/ERC20Token.sol";

contract MarketMinterTest is Test {
    ERC20Token token;
    MarketMinter controller;

    address admin = address(0xA);
    address minter = address(0xB);
    address recipient = address(0xC);

    uint256 constant CAP = 1000 ether;
    uint256 constant PER_MINT = 500 ether;

    function setUp() public {
        vm.startPrank(admin);
        token = new ERC20Token(0);
        controller = new MarketMinter(address(token));
        // grant the controller minter rights on the token
        token.addMinter(address(controller));
        // register a minter in the controller with caps
        controller.registerMinter(minter, CAP, PER_MINT);
        vm.stopPrank();
    }

    function test_authorised_mint_success() public {
        uint256 amount = 200 ether;

        vm.prank(minter);
        controller.mint(recipient, amount);

        assertEq(token.balanceOf(recipient), amount);
        assertEq(controller.mintedTotal(minter), amount);
    }

    function test_perMint_cap_enforced() public {
        // attempt to mint more than per-call cap
        vm.prank(minter);
        vm.expectRevert(MarketMinter.ExceedsPerMintCap.selector);
        controller.mint(recipient, PER_MINT + 1);
    }

    function test_total_cap_enforced_across_calls() public {
        // first mint up to per-call cap
        vm.prank(minter);
        controller.mint(recipient, PER_MINT);

        // second mint that would exceed total cap
        vm.prank(minter);
        vm.expectRevert(MarketMinter.ExceedsTotalCap.selector);
        controller.mint(recipient, PER_MINT + 1);
    }

    function test_queries_and_remaining() public {
        // before minting
        assertTrue(controller.isMinter(minter));
        assertEq(controller.mintCap(minter), CAP);
        assertEq(controller.perMintCap(minter), PER_MINT);

        vm.prank(minter);
        controller.mint(recipient, 300 ether);

        assertEq(controller.mintedTotal(minter), 300 ether);
        assertEq(controller.remainingCap(minter), CAP - 300 ether);
    }
}
