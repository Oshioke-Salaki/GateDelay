// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EmergencyStop.sol";

contract EmergencyStopTest is Test {
    EmergencyStop internal emergency;
    
    address internal admin = address(0xA11CE);
    address internal operator = address(0xB0B);
    address internal user = address(0xC0FFEE);

    function setUp() public {
        emergency = new EmergencyStop(admin);
    }

    // -------------------------------------------------------------------------
    // Emergency Stop Activation Tests
    // -------------------------------------------------------------------------

    function test_InitiallyNotActive() public {
        assertFalse(emergency.isEmergencyActive());
    }

    function test_ActivateEmergencyStop() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical vulnerability");
        assertTrue(emergency.isEmergencyActive());
    }

    function test_ActivateEmergencyStopEmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit EmergencyStop.EmergencyStopActivated(admin, "Critical vulnerability");
        emergency.activateEmergencyStop("Critical vulnerability");
    }

    function test_ActivateEmergencyStopStoresReason() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("System compromise");
        assertEq(emergency.getEmergencyReason(), "System compromise");
    }

    function test_ActivateEmergencyStopStoresActivator() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        assertEq(emergency.getEmergencyActivatedBy(), admin);
    }

    function test_ActivateEmergencyStopStoresTimestamp() public {
        vm.prank(admin);
        uint256 blockTime = block.timestamp;
        emergency.activateEmergencyStop("Critical issue");
        assertEq(emergency.getEmergencyActivatedAt(), blockTime);
    }

    function test_ActivateEmergencyStopRejectsNonAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        emergency.activateEmergencyStop("Unauthorized");
    }

    function test_ActivateEmergencyStopRejectsWhenAlreadyActive() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("First activation");
        
        vm.prank(admin);
        vm.expectRevert("Emergency already active");
        emergency.activateEmergencyStop("Second activation");
    }

    function test_ActivateEmergencyStopRejectsEmptyReason() public {
        vm.prank(admin);
        vm.expectRevert("Reason required");
        emergency.activateEmergencyStop("");
    }

    // -------------------------------------------------------------------------
    // Emergency Stop Deactivation Tests
    // -------------------------------------------------------------------------

    function test_DeactivateEmergencyStop() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        assertTrue(emergency.isEmergencyActive());
        
        vm.prank(admin);
        emergency.deactivateEmergencyStop();
        assertFalse(emergency.isEmergencyActive());
    }

    function test_DeactivateEmergencyStopEmitsEvent() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit EmergencyStop.EmergencyStopDeactivated(admin);
        emergency.deactivateEmergencyStop();
    }

    function test_DeactivateEmergencyStopClearsReason() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        emergency.deactivateEmergencyStop();
        assertEq(emergency.getEmergencyReason(), "");
    }

    function test_DeactivateEmergencyStopClearsActivator() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        emergency.deactivateEmergencyStop();
        assertEq(emergency.getEmergencyActivatedBy(), address(0));
    }

    function test_DeactivateEmergencyStopClearsTimestamp() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        emergency.deactivateEmergencyStop();
        assertEq(emergency.getEmergencyActivatedAt(), 0);
    }

    function test_DeactivateEmergencyStopRejectsNonAdmin() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(user);
        vm.expectRevert();
        emergency.deactivateEmergencyStop();
    }

    function test_DeactivateEmergencyStopRejectsWhenNotActive() public {
        vm.prank(admin);
        vm.expectRevert("Emergency not active");
        emergency.deactivateEmergencyStop();
    }

    // -------------------------------------------------------------------------
    // Recovery Management Tests
    // -------------------------------------------------------------------------

    function test_InitiallyNoRecovery() public {
        assertFalse(emergency.isRecoveryInProgress());
    }

    function test_InitiateRecovery() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        emergency.initiateRecovery();
        assertTrue(emergency.isRecoveryInProgress());
    }

    function test_InitiateRecoveryEmitsEvent() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit EmergencyStop.RecoveryInitiated(admin);
        emergency.initiateRecovery();
    }

    function test_InitiateRecoveryRejectsWhenNotEmergency() public {
        vm.prank(admin);
        vm.expectRevert("Emergency not active");
        emergency.initiateRecovery();
    }

    function test_InitiateRecoveryRejectsWhenAlreadyInProgress() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        emergency.initiateRecovery();
        
        vm.prank(admin);
        vm.expectRevert("Recovery already in progress");
        emergency.initiateRecovery();
    }

    function test_CompleteRecovery() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        emergency.initiateRecovery();
        
        vm.prank(admin);
        emergency.completeRecovery();
        assertFalse(emergency.isRecoveryInProgress());
        assertFalse(emergency.isEmergencyActive());
    }

    function test_CompleteRecoveryEmitsEvent() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        emergency.initiateRecovery();
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit EmergencyStop.RecoveryCompleted(admin);
        emergency.completeRecovery();
    }

    function test_CompleteRecoveryClearsEmergencyData() public {
        vm.prank(admin);
        emergency.activateEmergencyStop("Critical issue");
        emergency.initiateRecovery();
        
        vm.prank(admin);
        emergency.completeRecovery();
        assertEq(emergency.getEmergencyReason(), "");
        assertEq(emergency.getEmergencyActivatedBy(), address(0));
        assertEq(emergency.getEmergencyActivatedAt(), 0);
    }

    function test_CompleteRecoveryRejectsWhenNotInProgress() public {
        vm.prank(admin);
        vm.expectRevert("Recovery not in progress");
        emergency.completeRecovery();
    }

    // -------------------------------------------------------------------------
    // Permission Management Tests
    // -------------------------------------------------------------------------

    function test_GrantEmergencyRole() public {
        vm.prank(admin);
        emergency.grantEmergencyRole(operator);
        assertTrue(emergency.hasEmergencyRole(operator));
    }

    function test_RevokeEmergencyRole() public {
        vm.prank(admin);
        emergency.grantEmergencyRole(operator);
        assertTrue(emergency.hasEmergencyRole(operator));
        
        vm.prank(admin);
        emergency.revokeEmergencyRole(operator);
        assertFalse(emergency.hasEmergencyRole(operator));
    }

    function test_GrantRecoveryRole() public {
        vm.prank(admin);
        emergency.grantRecoveryRole(operator);
        assertTrue(emergency.hasRecoveryRole(operator));
    }

    function test_RevokeRecoveryRole() public {
        vm.prank(admin);
        emergency.grantRecoveryRole(operator);
        assertTrue(emergency.hasRecoveryRole(operator));
        
        vm.prank(admin);
        emergency.revokeRecoveryRole(operator);
        assertFalse(emergency.hasRecoveryRole(operator));
    }

    function test_GrantEmergencyRoleRejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("Invalid address");
        emergency.grantEmergencyRole(address(0));
    }

    function test_GrantRecoveryRoleRejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("Invalid address");
        emergency.grantRecoveryRole(address(0));
    }

    function test_GrantEmergencyRoleRejectsNonAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        emergency.grantEmergencyRole(operator);
    }

    function test_GrantRecoveryRoleRejectsNonAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        emergency.grantRecoveryRole(operator);
    }

    // -------------------------------------------------------------------------
    // Status Query Tests
    // -------------------------------------------------------------------------

    function test_HasEmergencyRole() public {
        assertFalse(emergency.hasEmergencyRole(operator));
        
        vm.prank(admin);
        emergency.grantEmergencyRole(operator);
        assertTrue(emergency.hasEmergencyRole(operator));
    }

    function test_HasRecoveryRole() public {
        assertFalse(emergency.hasRecoveryRole(operator));
        
        vm.prank(admin);
        emergency.grantRecoveryRole(operator);
        assertTrue(emergency.hasRecoveryRole(operator));
    }

    function test_OperatorCanActivateEmergency() public {
        vm.prank(admin);
        emergency.grantEmergencyRole(operator);
        
        vm.prank(operator);
        emergency.activateEmergencyStop("Operator activation");
        assertTrue(emergency.isEmergencyActive());
    }

    function test_OperatorCanInitiateRecovery() public {
        vm.prank(admin);
        emergency.grantRecoveryRole(operator);
        emergency.activateEmergencyStop("Critical issue");
        
        vm.prank(operator);
        emergency.initiateRecovery();
        assertTrue(emergency.isRecoveryInProgress());
    }
}
