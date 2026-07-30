// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MintingPausable.sol";

contract MintingPausableTest is Test {
    MintingPausable public token;

    address public admin = address(1);
    address public minter = address(2);
    address public pauser = address(3);
    address public user = address(4);

    function setUp() public {
        vm.startPrank(admin);
        token = new MintingPausable("MintingToken", "MTK");
        token.grantRole(token.MINTER_ROLE(), minter);
        token.grantRole(token.PAUSER_ROLE(), pauser);
        vm.stopPrank();
    }

    function test_MintingWhenNotPaused() public {
        vm.prank(minter);
        token.mint(user, 1000);
        assertEq(token.balanceOf(user), 1000);
    }

    function test_MintingFailsWhenPaused() public {
        vm.prank(pauser);
        token.pauseMinting("Pause for testing");

        assertTrue(token.isMintingPaused());

        vm.prank(minter);
        vm.expectRevert("MintingPausable: minting is paused");
        token.mint(user, 1000);
    }

    function test_UnpauseAllowsMinting() public {
        vm.prank(pauser);
        token.pauseMinting("Pause for testing");

        vm.prank(admin);
        token.unpauseMinting("Unpause for testing");

        assertFalse(token.isMintingPaused());

        vm.prank(minter);
        token.mint(user, 1000);
        assertEq(token.balanceOf(user), 1000);
    }
}
