// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import "../src/MintingPausable.sol";

/// @notice Pause and unpause coverage for the minting path: what a pause blocks,
///         which recovery actions still work, and what resumes afterwards.
contract MintingPausablePauseTest is Test {
    MintingPausable internal token;

    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter");
    address internal pauser = makeAddr("pauser");
    address internal emergencyPauser = makeAddr("emergencyPauser");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        vm.startPrank(admin);
        token = new MintingPausable("Gate", "GATE");
        token.grantMinterRole(minter);
        token.grantPauserRole(pauser);
        token.grantEmergencyPauserRole(emergencyPauser);
        vm.stopPrank();

        vm.prank(minter);
        token.mint(alice, 100 ether);
        vm.prank(alice);
        token.approve(bob, type(uint256).max);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _pause() internal {
        vm.prank(pauser);
        token.pauseMinting("incident");
    }

    function _emergencyPause() internal {
        vm.prank(emergencyPauser);
        token.emergencyPause();
    }

    function _batch() internal view returns (address[] memory to, uint256[] memory amounts) {
        to = new address[](2);
        to[0] = alice;
        to[1] = bob;
        amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;
    }

    /// @dev Every balance-changing entry point reverts and nothing moves.
    function _assertEverythingBlocked() internal {
        uint256 supply = token.totalSupply();
        uint256 aliceBalance = token.balanceOf(alice);

        vm.prank(minter);
        vm.expectRevert("MintingPausable: minting is paused");
        token.mint(bob, 1 ether);

        (address[] memory to, uint256[] memory amounts) = _batch();
        vm.prank(minter);
        vm.expectRevert("MintingPausable: minting is paused");
        token.mintBatch(to, amounts);

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        token.transfer(bob, 1 ether);

        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        token.transferFrom(alice, bob, 1 ether);

        assertEq(token.totalSupply(), supply);
        assertEq(token.balanceOf(alice), aliceBalance);
        assertEq(token.balanceOf(bob), 0);
    }

    // ── blocked while paused ────────────────────────────────────────────────

    function test_Paused_BlocksMintingAndTransfers() public {
        _pause();
        _assertEverythingBlocked();
    }

    function test_EmergencyPaused_BlocksMintingAndTransfers() public {
        _emergencyPause();
        _assertEverythingBlocked();
    }

    function test_Paused_ApprovalsStillWork() public {
        _pause();
        vm.prank(alice);
        token.approve(bob, 5 ether);
        assertEq(token.allowance(alice, bob), 5 ether);
    }

    function test_Paused_CannotBePausedTwice() public {
        _pause();

        vm.prank(emergencyPauser);
        vm.expectRevert("MintingPausable: already paused");
        token.emergencyPause();

        vm.prank(pauser);
        vm.expectRevert("MintingPausable: already paused");
        token.pauseMinting("again");

        assertEq(token.pauseCount(), 1);
    }

    // ── recovery ────────────────────────────────────────────────────────────

    function test_Recovery_PauserUnpausesAndEverythingResumes() public {
        _pause();
        vm.prank(pauser);
        token.unpauseMinting("resolved");

        vm.prank(minter);
        token.mint(bob, 1 ether);
        (address[] memory to, uint256[] memory amounts) = _batch();
        vm.prank(minter);
        token.mintBatch(to, amounts);
        vm.prank(alice);
        token.transfer(bob, 1 ether);
        vm.prank(bob);
        token.transferFrom(alice, bob, 1 ether);

        assertEq(token.balanceOf(bob), 1 ether + 2 ether + 1 ether + 1 ether);
        assertEq(token.totalSupply(), 100 ether + 1 ether + 3 ether);
        assertFalse(token.isMintingPaused());
    }

    function test_Recovery_AdminCanLiftAnEmergencyPause() public {
        _emergencyPause();

        vm.prank(admin);
        token.unpauseMinting("admin override");

        assertFalse(token.isMintingPaused());
        vm.prank(minter);
        token.mint(bob, 1 ether);
        assertEq(token.balanceOf(bob), 1 ether);
    }

    function test_Recovery_EmergencyPauserCannotUnpause() public {
        _emergencyPause();

        vm.prank(emergencyPauser);
        vm.expectRevert("MintingPausable: caller is not admin or pauser");
        token.unpauseMinting("self-unpause");

        assertTrue(token.isMintingPaused());
    }

    function test_Recovery_OutsidersAndMintersCannotUnpause() public {
        _pause();

        vm.prank(alice);
        vm.expectRevert("MintingPausable: caller is not admin or pauser");
        token.unpauseMinting("nope");

        vm.prank(minter);
        vm.expectRevert("MintingPausable: caller is not admin or pauser");
        token.unpauseMinting("nope");

        assertTrue(token.isMintingPaused());
    }

    function test_Recovery_RolesCanBeRotatedWhilePaused() public {
        _pause();
        address newMinter = makeAddr("newMinter");

        vm.startPrank(admin);
        token.revokeMinterRole(minter);
        token.grantMinterRole(newMinter);
        token.revokePauserRole(pauser);
        vm.stopPrank();

        vm.prank(pauser);
        vm.expectRevert("MintingPausable: caller is not admin or pauser");
        token.unpauseMinting("revoked");

        vm.prank(admin);
        token.unpauseMinting("resolved");

        vm.prank(minter);
        vm.expectRevert("MintingPausable: caller is not minter");
        token.mint(bob, 1 ether);

        vm.prank(newMinter);
        token.mint(bob, 1 ether);
        assertEq(token.balanceOf(bob), 1 ether);
    }

    // ── bookkeeping ─────────────────────────────────────────────────────────

    function test_History_RecordsPauseAndUnpauseTimes() public {
        vm.warp(1_000);
        _pause();
        vm.warp(1_600);
        vm.prank(pauser);
        token.unpauseMinting("resolved");

        (uint256 totalPauses, uint256 lastPauseStart, uint256 lastUnpauseAt) = token.getPauseHistory();
        assertEq(totalPauses, 1);
        assertEq(lastPauseStart, 1_000);
        assertEq(lastUnpauseAt, 1_600);
    }

    function test_History_CountsEveryPauseKind() public {
        _pause();
        vm.prank(pauser);
        token.unpauseMinting("resolved");
        _emergencyPause();

        (bool paused, uint256 pausedSince, uint256 total,) = token.getPauseStatus();
        assertTrue(paused);
        assertEq(pausedSince, block.timestamp);
        assertEq(total, 2);
        assertEq(token.pauseStartTimes(2), block.timestamp);
    }
}
