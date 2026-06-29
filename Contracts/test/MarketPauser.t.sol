// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketPauser.sol";

contract MarketPauserTest is Test {
    MarketPauser pauser;

    address admin = address(0xA11CE);
    address emergencyAdmin = address(0xBEEF);
    address pauser1 = address(0xCAFE);
    address pauser2 = address(0xBABE);
    address emergencyPauser = address(0xF00D);
    address other = address(0xDEAD);

    function setUp() public {
        pauser = new MarketPauser(admin, emergencyAdmin);
        
        // Grant pauser role to pauser1 and pauser2
        vm.prank(admin);
        pauser.grantPauserRole(pauser1);
        
        vm.prank(admin);
        pauser.grantPauserRole(pauser2);
        
        // Grant emergency pauser role to emergencyPauser
        vm.prank(admin);
        pauser.grantEmergencyPauserRole(emergencyPauser);
    }

    // -------------------------------------------------------------------------
    // Role Management Tests
    // -------------------------------------------------------------------------

    function test_AdminCanGrantPauserRole() public {
        vm.prank(admin);
        pauser.grantPauserRole(other);
        assertTrue(pauser.isPauser(other));
    }

    function test_NonAdminCannotGrantPauserRole() public {
        vm.prank(other);
        vm.expectRevert();
        pauser.grantPauserRole(other);
    }

    function test_AdminCanRevokePauserRole() public {
        vm.prank(admin);
        pauser.revokePauserRole(pauser1);
        assertFalse(pauser.isPauser(pauser1));
    }

    function test_NonAdminCannotRevokePauserRole() public {
        vm.prank(other);
        vm.expectRevert();
        pauser.revokePauserRole(pauser1);
    }

    function test_CannotRevokePauserRoleFromNonPauser() public {
        vm.prank(admin);
        vm.expectRevert();
        pauser.revokePauserRole(other);
    }

    function test_AdminCanGrantEmergencyPauserRole() public {
        vm.prank(admin);
        pauser.grantEmergencyPauserRole(other);
        assertTrue(pauser.isEmergencyPauser(other));
    }

    function test_NonAdminCannotGrantEmergencyPauserRole() public {
        vm.prank(other);
        vm.expectRevert();
        pauser.grantEmergencyPauserRole(other);
    }

    function test_AdminCanRevokeEmergencyPauserRole() public {
        vm.prank(admin);
        pauser.revokeEmergencyPauserRole(emergencyPauser);
        assertFalse(pauser.isEmergencyPauser(emergencyPauser));
    }

    function test_NonAdminCannotRevokeEmergencyPauserRole() public {
        vm.prank(other);
        vm.expectRevert();
        pauser.revokeEmergencyPauserRole(emergencyPauser);
    }

    function test_CannotGrantPauserRoleToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert();
        pauser.grantPauserRole(address(0));
    }

    function test_CannotGrantEmergencyPauserRoleToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert();
        pauser.grantEmergencyPauserRole(address(0));
    }

    function test_InitialRolesAreCorrectlyAssigned() public {
        assertTrue(pauser.hasRole(pauser.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pauser.isPauser(admin));
        assertTrue(pauser.isEmergencyPauser(emergencyAdmin));
    }

    function test_CanCheckIfAccountCanPause() public {
        assertTrue(pauser.canPause(pauser1));
        assertTrue(pauser.canPause(emergencyPauser));
        assertTrue(pauser.canPause(admin));
        assertFalse(pauser.canPause(other));
    }

    // -------------------------------------------------------------------------
    // Pause/Unpause Tests
    // -------------------------------------------------------------------------

    function test_PauserCanPauseMarket() public {
        vm.prank(pauser1);
        pauser.pause("Routine maintenance");
        
        assertTrue(pauser.isPaused());
        assertFalse(pauser.isEmergencyPaused());
        assertEq(pauser.getPausedBy(), pauser1);
        assertEq(pauser.getPauseReason(), "Routine maintenance");
        assertFalse(pauser.getLastPauseIsEmergency());
    }

    function test_EmergencyPauserCanPauseMarket() public {
        vm.prank(emergencyPauser);
        pauser.pause("Scheduled update");
        
        assertTrue(pauser.isPaused());
        assertTrue(pauser.isEmergencyPaused());
        assertEq(pauser.getPausedBy(), emergencyPauser);
        assertEq(pauser.getPauseReason(), "Scheduled update");
        assertTrue(pauser.getLastPauseIsEmergency());
    }

    function test_PauserCanUnpauseMarket() public {
        vm.prank(pauser1);
        pauser.pause("Test pause");
        
        vm.prank(pauser1);
        pauser.unpause();
        
        assertFalse(pauser.isPaused());
        assertFalse(pauser.isEmergencyPaused());
    }

    function test_EmergencyPauserCanUnpauseMarket() public {
        vm.prank(pauser1);
        pauser.pause("Test pause");
        
        vm.prank(emergencyPauser);
        pauser.unpause();
        
        assertFalse(pauser.isPaused());
    }

    function test_NonPauserCannotPauseMarket() public {
        vm.prank(other);
        vm.expectRevert();
        pauser.pause("Unauthorized");
    }

    function test_NonPauserCannotUnpauseMarket() public {
        vm.prank(pauser1);
        pauser.pause("Test pause");
        
        vm.prank(other);
        vm.expectRevert();
        pauser.unpause();
    }

    function test_CannotPauseAlreadyPausedMarket() public {
        vm.prank(pauser1);
        pauser.pause("First pause");
        
        vm.prank(pauser2);
        vm.expectRevert();
        pauser.pause("Second pause");
    }

    function test_CannotUnpauseNotPausedMarket() public {
        vm.prank(pauser1);
        vm.expectRevert();
        pauser.unpause();
    }

    function test_PauseRequiresReason() public {
        vm.prank(pauser1);
        vm.expectRevert();
        pauser.pause("");
    }

    // -------------------------------------------------------------------------
    // Emergency Pause Tests
    // -------------------------------------------------------------------------

    function test_EmergencyPauserCanEmergencyPause() public {
        vm.prank(emergencyPauser);
        pauser.emergencyPause();
        
        assertTrue(pauser.isPaused());
        assertTrue(pauser.isEmergencyPaused());
        assertEq(pauser.getPausedBy(), emergencyPauser);
        assertEq(pauser.getPauseReason(), "Emergency pause");
        assertTrue(pauser.getLastPauseIsEmergency());
    }

    function test_NonEmergencyPauserCannotEmergencyPause() public {
        vm.prank(pauser1);
        vm.expectRevert();
        pauser.emergencyPause();
    }

    function test_CannotEmergencyPauseAlreadyPausedMarket() public {
        vm.prank(pauser1);
        pauser.pause("Normal pause");
        
        vm.prank(emergencyPauser);
        vm.expectRevert();
        pauser.emergencyPause();
    }

    function test_EmergencyPauseAfterNormalPause() public {
        vm.prank(pauser1);
        pauser.pause("Normal pause");
        
        vm.prank(pauser1);
        pauser.unpause();
        
        vm.prank(emergencyPauser);
        pauser.emergencyPause();
        
        assertTrue(pauser.isPaused());
        assertTrue(pauser.isEmergencyPaused());
    }

    // -------------------------------------------------------------------------
    // Query Function Tests
    // -------------------------------------------------------------------------

    function testGetLastPauseInfo() public {
        vm.prank(pauser1);
        pauser.pause("Test reason");
        
        (address pausedBy, uint256 pausedAt, string memory reason, bool isEmergency) = 
            pauser.getLastPauseInfo();
        
        assertEq(pausedBy, pauser1);
        assertEq(reason, "Test reason");
        assertFalse(isEmergency);
        assertTrue(pausedAt > 0);
    }

    function testGetTotalPauseCount() public {
        vm.prank(pauser1);
        pauser.pause("First");
        
        vm.prank(pauser1);
        pauser.unpause();
        
        vm.prank(pauser2);
        pauser.pause("Second");
        
        vm.prank(pauser2);
        pauser.unpause();
        
        assertEq(pauser.getTotalPauseCount(), 2);
    }

    function testGetRoleMembers() public {
        address[] memory pausers = pauser.getRoleMembers(pauser.PAUSER_ROLE());
        assertTrue(pausers.length >= 3); // admin, pauser1, pauser2
        
        address[] memory emergencyPausers = pauser.getRoleMembers(pauser.EMERGENCY_PAUSER_ROLE());
        assertTrue(emergencyPausers.length >= 2); // emergencyAdmin, emergencyPauser
    }

    function testGetAccountRoles() public {
        bytes32[] memory roles = pauser.getAccountRoles(admin);
        assertTrue(roles.length >= 2); // Should have at least DEFAULT_ADMIN_ROLE and PAUSER_ROLE
    }

    function testGetRoleDescription() public {
        string memory desc = pauser.getRoleDescription(pauser.PAUSER_ROLE());
        assertTrue(bytes(desc).length > 0);
    }

    // -------------------------------------------------------------------------
    // Event Emission Tests
    // -------------------------------------------------------------------------

    function testPauseEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.MarketPaused(pauser1, "Test", false);
        
        vm.prank(pauser1);
        pauser.pause("Test");
    }

    function testUnpauseEmitsEvent() public {
        vm.prank(pauser1);
        pauser.pause("Test");
        
        vm.expectEmit();
        emit MarketPauser.MarketUnpaused(pauser1);
        
        vm.prank(pauser1);
        pauser.unpause();
    }

    function testEmergencyPauseEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.MarketPaused(emergencyPauser, "Emergency pause", true);
        
        vm.prank(emergencyPauser);
        pauser.emergencyPause();
    }

    function testGrantPauserRoleEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.PauserRoleGranted(other, admin);
        
        vm.prank(admin);
        pauser.grantPauserRole(other);
    }

    function testRevokePauserRoleEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.PauserRoleRevoked(pauser1, admin);
        
        vm.prank(admin);
        pauser.revokePauserRole(pauser1);
    }

    function testGrantEmergencyPauserRoleEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.EmergencyPauserRoleGranted(other, admin);
        
        vm.prank(admin);
        pauser.grantEmergencyPauserRole(other);
    }

    function testRevokeEmergencyPauserRoleEmitsEvent() public {
        vm.expectEmit();
        emit MarketPauser.EmergencyPauserRoleRevoked(emergencyPauser, admin);
        
        vm.prank(admin);
        pauser.revokeEmergencyPauserRole(emergencyPauser);
    }
}
