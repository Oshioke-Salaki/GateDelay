// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MintingPausable} from "../src/MintingPausable.sol";

contract MintingPausableTest is Test {
    MintingPausable internal token;

    address internal minter = makeAddr("minter");
    address internal pauser = makeAddr("pauser");
    address internal emergencyPauser = makeAddr("emergencyPauser");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        token = new MintingPausable("GateDelay", "GATE");
        token.grantMinterRole(minter);
        token.grantPauserRole(pauser);
        token.grantEmergencyPauserRole(emergencyPauser);
    }

    function test_PauseBlocksSingleAndBatchMinting() public {
        vm.prank(pauser);
        token.pauseMinting("Incident response");

        vm.prank(minter);
        vm.expectRevert(bytes("MintingPausable: minting is paused"));
        token.mint(alice, 1 ether);

        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 1 ether;

        vm.prank(minter);
        vm.expectRevert(bytes("MintingPausable: minting is paused"));
        token.mintBatch(recipients, amounts);

        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_PauseBlocksTransfersUntilAuthorizedUnpause() public {
        vm.prank(minter);
        token.mint(alice, 10 ether);

        vm.prank(pauser);
        token.pauseMinting("Incident response");

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        token.transfer(bob, 1 ether);

        vm.prank(alice);
        vm.expectRevert(bytes("MintingPausable: caller is not admin or pauser"));
        token.unpauseMinting("Unauthorized recovery");

        vm.prank(pauser);
        token.unpauseMinting("Recovery complete");

        vm.prank(alice);
        token.transfer(bob, 1 ether);

        assertEq(token.balanceOf(alice), 9 ether);
        assertEq(token.balanceOf(bob), 1 ether);
    }

    function test_EmergencyPauseCanBeRecoveredByAdminAndMintingResumes() public {
        vm.prank(emergencyPauser);
        token.emergencyPause();

        assertTrue(token.isMintingPaused());

        token.unpauseMinting("Emergency cleared");

        vm.prank(minter);
        token.mint(alice, 2 ether);

        assertFalse(token.isMintingPaused());
        assertEq(token.balanceOf(alice), 2 ether);
    }

    function test_BatchMintWorksAfterUnpause() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        token.unpauseMinting("Maintenance complete");

        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        amounts[0] = 2 ether;
        amounts[1] = 3 ether;

        vm.prank(minter);
        token.mintBatch(recipients, amounts);

        assertEq(token.balanceOf(alice), 2 ether);
        assertEq(token.balanceOf(bob), 3 ether);
    }
}
