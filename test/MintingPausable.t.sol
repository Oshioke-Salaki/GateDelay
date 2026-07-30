// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MintingPausable.sol";

contract MintingPausableTest is Test {
    MintingPausable token;

    address admin = address(0x1);
    address minter = address(0x2);
    address pauser = address(0x3);
    address emergencyPauser = address(0x4);
    address user1 = address(0x5);
    address user2 = address(0x6);

    function setUp() public {
        vm.prank(admin);
        token = new MintingPausable("Test Token", "TEST");

        vm.prank(admin);
        token.grantMinterRole(minter);

        vm.prank(admin);
        token.grantPauserRole(pauser);

        vm.prank(admin);
        token.grantEmergencyPauserRole(emergencyPauser);
    }

    // ========== Pause Control Tests ==========

    function test_PauseMinting() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        assertTrue(token.isMintingPaused());
    }

    function test_UnpauseMinting() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        vm.prank(pauser);
        token.unpauseMinting("Maintenance complete");

        assertFalse(token.isMintingPaused());
    }

    function test_EmergencyPause() public {
        vm.prank(emergencyPauser);
        token.emergencyPause();

        assertTrue(token.isMintingPaused());
    }

    function test_CannotPauseWhenAlreadyPaused() public {
        vm.prank(pauser);
        token.pauseMinting("First pause");

        vm.prank(pauser);
        vm.expectRevert("MintingPausable: already paused");
        token.pauseMinting("Second pause");
    }

    function test_CannotUnpauseWhenNotPaused() public {
        vm.prank(pauser);
        vm.expectRevert("MintingPausable: not paused");
        token.unpauseMinting("Not paused");
    }

    function test_OnlyPauserCanPause() public {
        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not pauser");
        token.pauseMinting("Unauthorized pause");
    }

    function test_OnlyPauserOrAdminCanUnpause() public {
        vm.prank(pauser);
        token.pauseMinting("Pause");

        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not admin or pauser");
        token.unpauseMinting("Unauthorized unpause");
    }

    function test_AdminCanUnpause() public {
        vm.prank(pauser);
        token.pauseMinting("Pause");

        vm.prank(admin);
        token.unpauseMinting("Admin unpause");

        assertFalse(token.isMintingPaused());
    }

    // ========== Minting Tests ==========

    function test_MintWhenNotPaused() public {
        vm.prank(minter);
        token.mint(user1, 100 ether);

        assertEq(token.balanceOf(user1), 100 ether);
    }

    function test_CannotMintWhenPaused() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        vm.prank(minter);
        vm.expectRevert("MintingPausable: minting is paused");
        token.mint(user1, 100 ether);
    }

    function test_OnlyMinterCanMint() public {
        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not minter");
        token.mint(user1, 100 ether);
    }

    function test_CannotMintToZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert("MintingPausable: cannot mint to zero address");
        token.mint(address(0), 100 ether);
    }

    function test_CannotMintZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert("MintingPausable: amount must be positive");
        token.mint(user1, 0);
    }

    function test_MintBatch() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = admin;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 ether;
        amounts[1] = 200 ether;
        amounts[2] = 300 ether;

        vm.prank(minter);
        token.mintBatch(recipients, amounts);

        assertEq(token.balanceOf(user1), 100 ether);
        assertEq(token.balanceOf(user2), 200 ether);
        assertEq(token.balanceOf(admin), 300 ether);
    }

    function test_CannotMintBatchWhenPaused() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        address[] memory recipients = new address[](1);
        recipients[0] = user1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 ether;

        vm.prank(minter);
        vm.expectRevert("MintingPausable: minting is paused");
        token.mintBatch(recipients, amounts);
    }

    function test_CanMintAfterUnpause() public {
        vm.prank(pauser);
        token.pauseMinting("Maintenance");

        vm.prank(pauser);
        token.unpauseMinting("Resume");

        vm.prank(minter);
        token.mint(user1, 100 ether);

        assertEq(token.balanceOf(user1), 100 ether);
    }

    // ========== Permission Tests ==========

    function test_GrantMinterRole() public {
        vm.prank(admin);
        token.grantMinterRole(user1);

        vm.prank(user1);
        token.mint(user2, 100 ether);

        assertEq(token.balanceOf(user2), 100 ether);
    }

    function test_RevokeMinterRole() public {
        vm.prank(admin);
        token.grantMinterRole(user1);

        vm.prank(admin);
        token.revokeMinterRole(user1);

        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not minter");
        token.mint(user2, 100 ether);
    }

    function test_GrantPauserRole() public {
        vm.prank(admin);
        token.grantPauserRole(user1);

        vm.prank(user1);
        token.pauseMinting("User pause");

        assertTrue(token.isMintingPaused());
    }

    function test_RevokePauserRole() public {
        vm.prank(admin);
        token.grantPauserRole(user1);

        vm.prank(admin);
        token.revokePauserRole(user1);

        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not pauser");
        token.pauseMinting("Unauthorized pause");
    }

    function test_GrantEmergencyPauserRole() public {
        vm.prank(admin);
        token.grantEmergencyPauserRole(user1);

        vm.prank(user1);
        token.emergencyPause();

        assertTrue(token.isMintingPaused());
    }

    function test_RevokeEmergencyPauserRole() public {
        vm.prank(admin);
        token.grantEmergencyPauserRole(user1);

        vm.prank(admin);
        token.revokeEmergencyPauserRole(user1);

        vm.prank(user1);
        vm.expectRevert("MintingPausable: caller is not emergency pauser");
        token.emergencyPause();
    }

    function test_HasMinterRole() public {
        assertTrue(token.hasMinterRole(minter));
        assertFalse(token.hasMinterRole(user1));
    }

    function test_HasPauserRole() public {
        assertTrue(token.hasPauserRole(pauser));
        assertFalse(token.hasPauserRole(user1));
    }

    function test_HasEmergencyPauserRole() public {
        assertTrue(token.hasEmergencyPauserRole(emergencyPauser));
        assertFalse(token.hasEmergencyPauserRole(user1));
    }

    // ========== Status Query Tests ==========

    function test_IsMintingPaused() public {
        assertFalse(token.isMintingPaused());

        vm.prank(pauser);
        token.pauseMinting("Pause");

        assertTrue(token.isMintingPaused());
    }

    function test_GetPauseStatus() public {
        (bool isPaused, uint256 pausedSince, uint256 totalPauses, uint256 timePausedSeconds) =
            token.getPauseStatus();

        assertFalse(isPaused);
        assertEq(pausedSince, 0);
        assertEq(totalPauses, 0);
        assertEq(timePausedSeconds, 0);

        vm.prank(pauser);
        token.pauseMinting("Pause");

        (isPaused, pausedSince, totalPauses, timePausedSeconds) = token.getPauseStatus();

        assertTrue(isPaused);
        assertEq(pausedSince, block.timestamp);
        assertEq(totalPauses, 1);
        assertEq(timePausedSeconds, 0);
    }

    function test_GetPauseStatusAfterDelay() public {
        vm.prank(pauser);
        token.pauseMinting("Pause");

        vm.warp(block.timestamp + 100);

        (bool isPaused, , , uint256 timePausedSeconds) = token.getPauseStatus();

        assertTrue(isPaused);
        assertEq(timePausedSeconds, 100);
    }

    function test_GetPauseHistory() public {
        (uint256 totalPauses, , ) = token.getPauseHistory();
        assertEq(totalPauses, 0);

        vm.prank(pauser);
        token.pauseMinting("First pause");

        (totalPauses, , ) = token.getPauseHistory();
        assertEq(totalPauses, 1);

        vm.prank(pauser);
        token.unpauseMinting("Unpause");

        vm.prank(pauser);
        token.pauseMinting("Second pause");

        (totalPauses, , ) = token.getPauseHistory();
        assertEq(totalPauses, 2);
    }

    function test_GetTimeSincePause() public {
        vm.prank(pauser);
        token.pauseMinting("Pause");

        uint256 timeSince = token.getTimeSincePause();
        assertEq(timeSince, 0);

        vm.warp(block.timestamp + 50);
        timeSince = token.getTimeSincePause();
        assertEq(timeSince, 50);
    }

    function test_CannotGetTimeSincePauseWhenNotPaused() public {
        vm.expectRevert("MintingPausable: not currently paused");
        token.getTimeSincePause();
    }

    function test_GetTimeUntilNextUnpause() public {
        vm.prank(pauser);
        token.pauseMinting("Pause");

        uint256 timeUntil = token.getTimeUntilNextUnpause();
        assertEq(timeUntil, 0);

        vm.warp(block.timestamp + 100);
        timeUntil = token.getTimeUntilNextUnpause();
        assertEq(timeUntil, 100);
    }

    function test_GetTimeUntilNextUnpauseWhenNotPaused() public {
        uint256 timeUntil = token.getTimeUntilNextUnpause();
        assertEq(timeUntil, 0);
    }

    function test_GetPausedReason() public {
        (bool isCurrentlyPaused, , uint256 pauseCountLifetime) = token.getPausedReason();

        assertFalse(isCurrentlyPaused);
        assertEq(pauseCountLifetime, 0);

        vm.prank(pauser);
        token.pauseMinting("Pause");

        (isCurrentlyPaused, uint256 totalTimePaused, pauseCountLifetime) =
            token.getPausedReason();

        assertTrue(isCurrentlyPaused);
        assertEq(totalTimePaused, 0);
        assertEq(pauseCountLifetime, 1);
    }

    // ========== Edge Cases ==========

    function test_MultiplePauseAndUnpauseCycles() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(pauser);
            token.pauseMinting("Pause");
            assertTrue(token.isMintingPaused());

            vm.prank(pauser);
            token.unpauseMinting("Unpause");
            assertFalse(token.isMintingPaused());

            // Mint between cycles
            vm.prank(minter);
            token.mint(user1, 1 ether);
        }

        assertEq(token.balanceOf(user1), 5 ether);
    }

    function test_PauseCountIncrementsCorrectly() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(pauser);
            token.pauseMinting("Pause");

            (, , uint256 pauseCount) = token.getPauseHistory();
            assertEq(pauseCount, i + 1);

            vm.prank(pauser);
            token.unpauseMinting("Unpause");
        }
    }

    function test_EmergencyPauseCountsAsPause() public {
        vm.prank(emergencyPauser);
        token.emergencyPause();

        (, , uint256 pauseCount) = token.getPauseHistory();
        assertEq(pauseCount, 1);
    }

    function test_BatchMintWithValidation() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 ether;
        amounts[1] = 200 ether;

        vm.prank(minter);
        token.mintBatch(recipients, amounts);

        assertEq(token.balanceOf(user1), 100 ether);
        assertEq(token.balanceOf(user2), 200 ether);
    }

    function test_BatchMintLengthMismatch() public {
        address[] memory recipients = new address[](1);
        recipients[0] = user1;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 ether;
        amounts[1] = 200 ether;

        vm.prank(minter);
        vm.expectRevert("MintingPausable: recipients and amounts length mismatch");
        token.mintBatch(recipients, amounts);
    }

    function test_BatchMintEmptyArray() public {
        address[] memory recipients = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(minter);
        vm.expectRevert("MintingPausable: empty batch");
        token.mintBatch(recipients, amounts);
    }

    function test_OnlyAdminCanGrantRoles() public {
        vm.prank(user1);
        vm.expectRevert();
        token.grantMinterRole(user2);
    }
}
