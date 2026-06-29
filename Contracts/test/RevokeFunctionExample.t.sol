// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RevokeFunction.sol";
import "../contracts/RevokeFunctionExample.sol";

contract RevokeFunctionExampleTest is Test {
    RevokeFunction public revokeFunc;
    RevokeFunctionExample public example;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public admin = address(0x4);

    function setUp() public {
        vm.startPrank(owner);
        revokeFunc = new RevokeFunction();
        example = new RevokeFunctionExample(address(revokeFunc));
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Execute Permission Tests
    // -------------------------------------------------------------------------

    function test_ExecuteWithPermission() public {
        // Grant execute permission
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Execute function
        vm.prank(user1);
        example.execute();

        assertEq(example.totalExecutions(), 1);
        assertEq(example.userExecutions(user1), 1);
    }

    function test_ExecuteWithoutPermission() public {
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.execute();
    }

    function test_CanExecuteQuery() public {
        assertFalse(example.canExecute(user1));

        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        assertTrue(example.canExecute(user1));
    }

    // -------------------------------------------------------------------------
    // Transfer Permission Tests
    // -------------------------------------------------------------------------

    function test_TransferWithPermission() public {
        // Grant transfer permission and mint tokens
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());
        
        vm.prank(owner);
        example.mint(user1, 100);

        // Transfer tokens
        vm.prank(user1);
        example.transfer(user2, 50);

        assertEq(example.balances(user1), 50);
        assertEq(example.balances(user2), 50);
        assertEq(example.totalTransfers(), 1);
    }

    function test_TransferWithoutPermission() public {
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.transfer(user2, 50);
    }

    function test_TransferInsufficientBalance() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());

        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.InsufficientBalance.selector);
        example.transfer(user2, 50);
    }

    function test_TransferZeroAmount() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());

        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.InvalidAmount.selector);
        example.transfer(user2, 0);
    }

    // -------------------------------------------------------------------------
    // Mint Permission Tests
    // -------------------------------------------------------------------------

    function test_MintWithPermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.MINT_PERMISSION());

        vm.prank(user1);
        example.mint(user2, 100);

        assertEq(example.balances(user2), 100);
        assertEq(example.totalMints(), 1);
    }

    function test_MintWithoutPermission() public {
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.mint(user2, 100);
    }

    function test_MintZeroAmount() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.MINT_PERMISSION());

        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.InvalidAmount.selector);
        example.mint(user2, 0);
    }

    // -------------------------------------------------------------------------
    // Burn Permission Tests
    // -------------------------------------------------------------------------

    function test_BurnWithPermission() public {
        // Setup: mint tokens first
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());
        
        vm.prank(owner);
        example.mint(user1, 100);

        // Grant burn permission and burn
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.BURN_PERMISSION());

        vm.prank(user1);
        example.burn(50);

        assertEq(example.balances(user1), 50);
    }

    function test_BurnWithoutPermission() public {
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.burn(50);
    }

    function test_BurnInsufficientBalance() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.BURN_PERMISSION());

        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.InsufficientBalance.selector);
        example.burn(50);
    }

    // -------------------------------------------------------------------------
    // Admin Permission Tests
    // -------------------------------------------------------------------------

    function test_AdminExecuteWithPermissions() public {
        // Grant both required permissions
        vm.prank(owner);
        revokeFunc.grantPermission(admin, revokeFunc.ADMIN_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(admin, revokeFunc.EXECUTE_PERMISSION());

        vm.prank(admin);
        example.adminExecute("Test action");
    }

    function test_AdminExecuteWithoutAllPermissions() public {
        // Grant only admin permission
        vm.prank(owner);
        revokeFunc.grantPermission(admin, revokeFunc.ADMIN_PERMISSION());

        vm.prank(admin);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.adminExecute("Test action");
    }

    function test_AdminTransfer() public {
        // Setup: mint tokens
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());
        
        vm.prank(owner);
        example.mint(user1, 100);

        // Grant admin permission
        vm.prank(owner);
        revokeFunc.grantPermission(admin, revokeFunc.ADMIN_PERMISSION());

        // Admin transfer
        vm.prank(admin);
        example.adminTransfer(user1, user2, 50);

        assertEq(example.balances(user1), 50);
        assertEq(example.balances(user2), 50);
    }

    // -------------------------------------------------------------------------
    // Flexible Execute Tests
    // -------------------------------------------------------------------------

    function test_FlexibleExecuteWithAdminPermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.ADMIN_PERMISSION());

        vm.prank(user1);
        example.flexibleExecute();

        assertEq(example.totalExecutions(), 1);
    }

    function test_FlexibleExecuteWithExecutePermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        vm.prank(user1);
        example.flexibleExecute();

        assertEq(example.totalExecutions(), 1);
    }

    function test_FlexibleExecuteWithoutAnyPermission() public {
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.flexibleExecute();
    }

    // -------------------------------------------------------------------------
    // Contract Revocation Tests
    // -------------------------------------------------------------------------

    function test_ExecuteWhenContractRevoked() public {
        // Grant permission
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Revoke contract
        vm.prank(owner);
        revokeFunc.revokeContract(address(example), "Security issue");

        // Try to execute
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.ContractRevoked.selector);
        example.execute();
    }

    function test_TransferWhenContractRevoked() public {
        // Setup
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());
        
        vm.prank(owner);
        example.mint(user1, 100);

        // Revoke contract
        vm.prank(owner);
        revokeFunc.revokeContract(address(example), "Security issue");

        // Try to transfer
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.ContractRevoked.selector);
        example.transfer(user2, 50);
    }

    function test_IsRevokedQuery() public {
        assertFalse(example.isRevoked());

        vm.prank(owner);
        revokeFunc.revokeContract(address(example), "Test");

        assertTrue(example.isRevoked());
    }

    function test_GetRevocationDetails() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(example), "Security issue");

        RevokeFunction.ContractRevocation memory details = example.getRevocationDetails();
        
        assertTrue(details.isRevoked);
        assertEq(details.reason, "Security issue");
        assertEq(details.revokedBy, owner);
    }

    // -------------------------------------------------------------------------
    // View Function Tests
    // -------------------------------------------------------------------------

    function test_GetUserPermissions() public {
        // Grant multiple permissions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());

        bytes32[] memory permissions = example.getUserPermissions(user1);
        assertEq(permissions.length, 2);
    }

    function test_GetUserPermissionCount() public {
        assertEq(example.getUserPermissionCount(user1), 0);

        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        assertEq(example.getUserPermissionCount(user1), 1);
    }

    function test_IsAdmin() public {
        assertFalse(example.isAdmin(user1));

        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.ADMIN_PERMISSION());

        assertTrue(example.isAdmin(user1));
    }

    function test_GetUserStats() public {
        // Setup: grant permissions and perform actions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());
        
        vm.prank(owner);
        example.mint(user1, 100);

        vm.prank(user1);
        example.execute();
        
        vm.prank(user1);
        example.transfer(user2, 30);

        // Get stats
        (uint256 executions, uint256 transfers, uint256 balance, uint256 permCount) = 
            example.getUserStats(user1);

        assertEq(executions, 1);
        assertEq(transfers, 1);
        assertEq(balance, 70);
        assertEq(permCount, 2);
    }

    function test_GetContractStats() public {
        // Setup and perform actions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());

        vm.prank(user1);
        example.execute();
        
        vm.prank(owner);
        example.mint(user1, 100);

        // Get stats
        (uint256 executions, uint256 transfers, uint256 mints, bool revoked) = 
            example.getContractStats();

        assertEq(executions, 1);
        assertEq(transfers, 0);
        assertEq(mints, 1);
        assertFalse(revoked);
    }

    function test_HasElevatedPrivileges() public {
        assertFalse(example.hasElevatedPrivileges(user1));

        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.ADMIN_PERMISSION());

        assertTrue(example.hasElevatedPrivileges(user1));
    }

    function test_HasFullAccess() public {
        assertFalse(example.hasFullAccess(user1));

        // Grant all permissions
        bytes32[] memory allPerms = new bytes32[](5);
        allPerms[0] = revokeFunc.EXECUTE_PERMISSION();
        allPerms[1] = revokeFunc.TRANSFER_PERMISSION();
        allPerms[2] = revokeFunc.MINT_PERMISSION();
        allPerms[3] = revokeFunc.BURN_PERMISSION();
        allPerms[4] = revokeFunc.ADMIN_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, allPerms);

        assertTrue(example.hasFullAccess(user1));
    }

    // -------------------------------------------------------------------------
    // Revocation History Tests
    // -------------------------------------------------------------------------

    function test_GetUserRevocationHistory() public {
        // Grant and revoke permissions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test revoke");

        RevokeFunction.PartialRevoke[] memory history = example.getUserRevocationHistory(user1);
        
        assertEq(history.length, 1);
        assertEq(history[0].reason, "Test revoke");
    }

    function test_GetUserRecentRevocations() public {
        // Grant and revoke multiple permissions
        bytes32[] memory perms = new bytes32[](3);
        perms[0] = revokeFunc.EXECUTE_PERMISSION();
        perms[1] = revokeFunc.TRANSFER_PERMISSION();
        perms[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, perms);

        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Reason 1");
        
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.TRANSFER_PERMISSION(), "Reason 2");
        
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.MINT_PERMISSION(), "Reason 3");

        RevokeFunction.PartialRevoke[] memory recent = example.getUserRecentRevocations(user1, 2);
        
        assertEq(recent.length, 2);
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    function test_CompleteUserWorkflow() public {
        // 1. Grant permissions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.TRANSFER_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(owner, revokeFunc.MINT_PERMISSION());

        // 2. Mint tokens
        vm.prank(owner);
        example.mint(user1, 1000);

        // 3. Execute function
        vm.prank(user1);
        example.execute();

        // 4. Transfer tokens
        vm.prank(user1);
        example.transfer(user2, 300);

        // 5. Revoke execute permission
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Policy change");

        // 6. Verify user can still transfer but not execute
        vm.prank(user1);
        example.transfer(user2, 200);

        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.execute();

        // 7. Check final state
        assertEq(example.balances(user1), 500);
        assertEq(example.balances(user2), 500);
        assertEq(example.userExecutions(user1), 1);
        assertEq(example.userTransfers(user1), 2);
    }

    function test_AdminWorkflow() public {
        // 1. Setup admin with full permissions
        bytes32[] memory adminPerms = new bytes32[](5);
        adminPerms[0] = revokeFunc.EXECUTE_PERMISSION();
        adminPerms[1] = revokeFunc.TRANSFER_PERMISSION();
        adminPerms[2] = revokeFunc.MINT_PERMISSION();
        adminPerms[3] = revokeFunc.BURN_PERMISSION();
        adminPerms[4] = revokeFunc.ADMIN_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(admin, adminPerms);

        // 2. Admin mints tokens
        vm.prank(admin);
        example.mint(user1, 1000);

        // 3. Admin performs admin transfer
        vm.prank(admin);
        example.adminTransfer(user1, user2, 400);

        // 4. Admin executes admin function
        vm.prank(admin);
        example.adminExecute("System maintenance");

        // 5. Verify admin has full access
        assertTrue(example.hasFullAccess(admin));
        assertTrue(example.hasElevatedPrivileges(admin));
    }

    function test_ContractRevocationWorkflow() public {
        // 1. Setup user with permissions
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // 2. User executes successfully
        vm.prank(user1);
        example.execute();

        // 3. Contract gets revoked
        vm.prank(owner);
        revokeFunc.revokeContract(address(example), "Critical security issue");

        // 4. All operations should fail
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.ContractRevoked.selector);
        example.execute();

        // 5. Verify revocation status
        assertTrue(example.isRevoked());
        
        RevokeFunction.ContractRevocation memory details = example.getRevocationDetails();
        assertEq(details.reason, "Critical security issue");
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    function test_MultipleUsersWithDifferentPermissions() public {
        // User1: Execute only
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // User2: Transfer only
        vm.prank(owner);
        revokeFunc.grantPermission(user2, revokeFunc.TRANSFER_PERMISSION());

        // Admin: All permissions
        bytes32[] memory allPerms = new bytes32[](5);
        allPerms[0] = revokeFunc.EXECUTE_PERMISSION();
        allPerms[1] = revokeFunc.TRANSFER_PERMISSION();
        allPerms[2] = revokeFunc.MINT_PERMISSION();
        allPerms[3] = revokeFunc.BURN_PERMISSION();
        allPerms[4] = revokeFunc.ADMIN_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(admin, allPerms);

        // Verify permissions
        assertTrue(example.canExecute(user1));
        assertFalse(example.canTransfer(user1));
        
        assertFalse(example.canExecute(user2));
        assertTrue(example.canTransfer(user2));
        
        assertTrue(example.hasFullAccess(admin));
    }

    function test_PermissionRevokeAndRegrant() public {
        // Grant permission
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Execute successfully
        vm.prank(user1);
        example.execute();

        // Revoke permission
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Temporary suspension");

        // Execution should fail
        vm.prank(user1);
        vm.expectRevert(RevokeFunctionExample.NotAuthorized.selector);
        example.execute();

        // Regrant permission
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Execute successfully again
        vm.prank(user1);
        example.execute();

        assertEq(example.userExecutions(user1), 2);
    }
}
