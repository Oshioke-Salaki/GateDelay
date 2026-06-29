// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RevokeFunction.sol";

contract RevokeFunctionTest is Test {
    RevokeFunction public revokeFunc;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public contract1 = address(0x4);
    address public contract2 = address(0x5);

    // Events to test
    event PermissionGranted(
        address indexed account,
        bytes32 indexed permission,
        address indexed grantor
    );

    event PermissionRevoked(
        address indexed account,
        bytes32 indexed permission,
        address indexed revoker,
        string reason
    );

    event ContractRevoked(
        address indexed contractAddress,
        address indexed revoker,
        uint256 timestamp,
        string reason
    );

    event ContractReinstated(
        address indexed contractAddress,
        address indexed reinstater,
        uint256 timestamp
    );

    event PartialRevokeRecorded(
        address indexed account,
        bytes32 indexed permission,
        address indexed revoker,
        string reason
    );

    function setUp() public {
        vm.prank(owner);
        revokeFunc = new RevokeFunction();
    }

    // -------------------------------------------------------------------------
    // Permission Grant Tests
    // -------------------------------------------------------------------------

    function test_GrantPermission() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit PermissionGranted(user1, revokeFunc.EXECUTE_PERMISSION(), owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
    }

    function test_GrantMultiplePermissions() public {
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.TRANSFER_PERMISSION()));
        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.MINT_PERMISSION()));
        assertEq(revokeFunc.getAccountPermissionCount(user1), 3);
    }

    function test_CannotGrantPermissionToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.InvalidAddress.selector);
        revokeFunc.grantPermission(address(0), revokeFunc.EXECUTE_PERMISSION());
    }

    function test_CannotGrantZeroPermission() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.InvalidPermission.selector);
        revokeFunc.grantPermission(user1, bytes32(0));
    }

    function test_CannotGrantPermissionTwice() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        vm.prank(owner);
        vm.expectRevert(RevokeFunction.PermissionAlreadyGranted.selector);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
    }

    function test_OnlyOwnerCanGrantPermission() public {
        vm.prank(user1);
        vm.expectRevert();
        revokeFunc.grantPermission(user2, revokeFunc.EXECUTE_PERMISSION());
    }

    // -------------------------------------------------------------------------
    // Permission Revoke Tests
    // -------------------------------------------------------------------------

    function test_RevokePermission() public {
        // Grant permission first
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Revoke permission
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit PermissionRevoked(user1, revokeFunc.EXECUTE_PERMISSION(), owner, "Test revoke");
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test revoke");

        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
    }

    function test_RevokeMultiplePermissions() public {
        // Grant permissions
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        // Revoke two permissions
        bytes32[] memory toRevoke = new bytes32[](2);
        toRevoke[0] = revokeFunc.EXECUTE_PERMISSION();
        toRevoke[1] = revokeFunc.TRANSFER_PERMISSION();

        vm.prank(owner);
        revokeFunc.revokePermissions(user1, toRevoke, "Partial revoke test");

        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.TRANSFER_PERMISSION()));
        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.MINT_PERMISSION()));
        assertEq(revokeFunc.getAccountPermissionCount(user1), 1);
    }

    function test_RevokeAllPermissions() public {
        // Grant multiple permissions
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        // Revoke all
        vm.prank(owner);
        revokeFunc.revokeAllPermissions(user1, "Revoke all test");

        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.TRANSFER_PERMISSION()));
        assertFalse(revokeFunc.hasPermission(user1, revokeFunc.MINT_PERMISSION()));
        assertEq(revokeFunc.getAccountPermissionCount(user1), 0);
    }

    function test_CannotRevokeUnassignedPermission() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.PermissionNotGranted.selector);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test");
    }

    function test_CannotRevokeZeroPermissions() public {
        bytes32[] memory permissions = new bytes32[](0);
        
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.CannotRevokeZeroPermissions.selector);
        revokeFunc.revokePermissions(user1, permissions, "Test");
    }

    function test_CannotRevokeAllWhenNoPermissions() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.NoPermissionsToRevoke.selector);
        revokeFunc.revokeAllPermissions(user1, "Test");
    }

    function test_OnlyOwnerCanRevokePermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        vm.prank(user2);
        vm.expectRevert();
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test");
    }

    // -------------------------------------------------------------------------
    // Contract Revocation Tests
    // -------------------------------------------------------------------------

    function test_RevokeContract() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit ContractRevoked(contract1, owner, block.timestamp, "Security issue");
        revokeFunc.revokeContract(contract1, "Security issue");

        assertTrue(revokeFunc.isContractRevoked(contract1));
    }

    function test_RevokeContractDetails() public {
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Security issue");

        RevokeFunction.ContractRevocation memory revocation = revokeFunc.getContractRevocation(contract1);
        
        assertTrue(revocation.isRevoked);
        assertEq(revocation.revokedAt, block.timestamp);
        assertEq(revocation.revokedBy, owner);
        assertEq(revocation.reason, "Security issue");
        assertEq(uint256(revocation.status), uint256(RevokeFunction.RevocationStatus.FullyRevoked));
    }

    function test_CannotRevokeZeroAddressContract() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.InvalidAddress.selector);
        revokeFunc.revokeContract(address(0), "Test");
    }

    function test_CannotRevokeContractTwice() public {
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Security issue");

        vm.prank(owner);
        vm.expectRevert(RevokeFunction.ContractAlreadyRevoked.selector);
        revokeFunc.revokeContract(contract1, "Another issue");
    }

    function test_ReinstateContract() public {
        // Revoke first
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Security issue");

        // Reinstate
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit ContractReinstated(contract1, owner, block.timestamp);
        revokeFunc.reinstateContract(contract1);

        assertFalse(revokeFunc.isContractRevoked(contract1));
    }

    function test_CannotReinstateNonRevokedContract() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.ContractNotRevoked.selector);
        revokeFunc.reinstateContract(contract1);
    }

    function test_UpdateRevocationStatus() public {
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Security issue");

        vm.prank(owner);
        revokeFunc.updateRevocationStatus(contract1, RevokeFunction.RevocationStatus.PartiallyRevoked);

        RevokeFunction.RevocationStatus status = revokeFunc.getRevocationStatus(contract1);
        assertEq(uint256(status), uint256(RevokeFunction.RevocationStatus.PartiallyRevoked));
    }

    function test_CannotUpdateStatusOfNonRevokedContract() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.ContractNotRevoked.selector);
        revokeFunc.updateRevocationStatus(contract1, RevokeFunction.RevocationStatus.PartiallyRevoked);
    }

    function test_OnlyOwnerCanRevokeContract() public {
        vm.prank(user1);
        vm.expectRevert();
        revokeFunc.revokeContract(contract1, "Test");
    }

    // -------------------------------------------------------------------------
    // Partial Revoke Tracking Tests
    // -------------------------------------------------------------------------

    function test_PartialRevokeTracking() public {
        // Grant and revoke permission
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test reason");

        // Check partial revoke was recorded
        assertEq(revokeFunc.getPartialRevokeCount(user1), 1);

        RevokeFunction.PartialRevoke memory partialRevoke = revokeFunc.getPartialRevokeByIndex(user1, 0);
        assertEq(partialRevoke.permission, revokeFunc.EXECUTE_PERMISSION());
        assertEq(partialRevoke.timestamp, block.timestamp);
        assertEq(partialRevoke.revokedBy, owner);
        assertEq(partialRevoke.reason, "Test reason");
    }

    function test_MultiplePartialRevokes() public {
        // Grant multiple permissions
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        // Revoke them one by one
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Reason 1");

        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.TRANSFER_PERMISSION(), "Reason 2");

        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.MINT_PERMISSION(), "Reason 3");

        // Check all partial revokes were recorded
        assertEq(revokeFunc.getPartialRevokeCount(user1), 3);

        RevokeFunction.PartialRevoke[] memory partialRevokes = revokeFunc.getPartialRevokes(user1);
        assertEq(partialRevokes.length, 3);
        assertEq(partialRevokes[0].reason, "Reason 1");
        assertEq(partialRevokes[1].reason, "Reason 2");
        assertEq(partialRevokes[2].reason, "Reason 3");
    }

    function test_GetRecentPartialRevokes() public {
        // Grant and revoke multiple permissions
        bytes32[] memory permissions = new bytes32[](5);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();
        permissions[3] = revokeFunc.BURN_PERMISSION();
        permissions[4] = revokeFunc.ADMIN_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        // Revoke all
        for (uint256 i = 0; i < permissions.length; i++) {
            vm.prank(owner);
            revokeFunc.revokePermission(user1, permissions[i], string(abi.encodePacked("Reason ", i)));
        }

        // Get recent 3
        RevokeFunction.PartialRevoke[] memory recent = revokeFunc.getRecentPartialRevokes(user1, 3);
        assertEq(recent.length, 3);
    }

    function test_CannotGetInvalidPartialRevokeIndex() public {
        vm.prank(owner);
        vm.expectRevert(RevokeFunction.PartialRevokeNotFound.selector);
        revokeFunc.getPartialRevokeByIndex(user1, 0);
    }

    // -------------------------------------------------------------------------
    // Query Function Tests
    // -------------------------------------------------------------------------

    function test_GetAccountPermissions() public {
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        bytes32[] memory accountPerms = revokeFunc.getAccountPermissions(user1);
        assertEq(accountPerms.length, 3);
    }

    function test_GetPermissionHolders() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user2, revokeFunc.EXECUTE_PERMISSION());

        address[] memory holders = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());
        assertEq(holders.length, 2);
        assertEq(revokeFunc.getPermissionHolderCount(revokeFunc.EXECUTE_PERMISSION()), 2);
    }

    function test_GetAllAccountsWithPermissions() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user2, revokeFunc.TRANSFER_PERMISSION());

        address[] memory accounts = revokeFunc.getAllAccountsWithPermissions();
        assertEq(accounts.length, 2);
    }

    function test_GetAllRevokedContracts() public {
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Reason 1");
        
        vm.prank(owner);
        revokeFunc.revokeContract(contract2, "Reason 2");

        address[] memory revoked = revokeFunc.getAllRevokedContracts();
        assertEq(revoked.length, 2);
        assertEq(revokeFunc.getRevokedContractCount(), 2);
    }

    function test_PermissionDescriptions() public {
        string memory desc = revokeFunc.getPermissionDescription(revokeFunc.EXECUTE_PERMISSION());
        assertEq(desc, "Permission to execute functions");

        vm.prank(owner);
        revokeFunc.setPermissionDescription(revokeFunc.EXECUTE_PERMISSION(), "Custom description");

        desc = revokeFunc.getPermissionDescription(revokeFunc.EXECUTE_PERMISSION());
        assertEq(desc, "Custom description");
    }

    // -------------------------------------------------------------------------
    // Utility Function Tests
    // -------------------------------------------------------------------------

    function test_HasAnyPermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        bytes32[] memory permissions = new bytes32[](2);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();

        assertTrue(revokeFunc.hasAnyPermission(user1, permissions));
    }

    function test_HasAnyPermissionFalse() public {
        bytes32[] memory permissions = new bytes32[](2);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();

        assertFalse(revokeFunc.hasAnyPermission(user1, permissions));
    }

    function test_HasAllPermissions() public {
        bytes32[] memory permissions = new bytes32[](2);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        assertTrue(revokeFunc.hasAllPermissions(user1, permissions));
    }

    function test_HasAllPermissionsFalse() public {
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        bytes32[] memory permissions = new bytes32[](2);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();

        assertFalse(revokeFunc.hasAllPermissions(user1, permissions));
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    function test_CompleteWorkflow() public {
        // 1. Grant permissions
        bytes32[] memory permissions = new bytes32[](3);
        permissions[0] = revokeFunc.EXECUTE_PERMISSION();
        permissions[1] = revokeFunc.TRANSFER_PERMISSION();
        permissions[2] = revokeFunc.MINT_PERMISSION();

        vm.prank(owner);
        revokeFunc.grantPermissions(user1, permissions);

        // 2. Partial revoke
        bytes32[] memory toRevoke = new bytes32[](1);
        toRevoke[0] = revokeFunc.EXECUTE_PERMISSION();

        vm.prank(owner);
        revokeFunc.revokePermissions(user1, toRevoke, "Partial revoke");

        // 3. Check status
        assertEq(revokeFunc.getAccountPermissionCount(user1), 2);
        assertEq(revokeFunc.getPartialRevokeCount(user1), 1);

        // 4. Revoke all remaining
        vm.prank(owner);
        revokeFunc.revokeAllPermissions(user1, "Full revoke");

        // 5. Verify
        assertEq(revokeFunc.getAccountPermissionCount(user1), 0);
        assertEq(revokeFunc.getPartialRevokeCount(user1), 3);
    }

    function test_ContractRevocationWorkflow() public {
        // 1. Revoke contract
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Security issue");

        // 2. Update status
        vm.prank(owner);
        revokeFunc.updateRevocationStatus(contract1, RevokeFunction.RevocationStatus.PartiallyRevoked);

        // 3. Verify
        assertTrue(revokeFunc.isContractRevoked(contract1));
        assertEq(
            uint256(revokeFunc.getRevocationStatus(contract1)),
            uint256(RevokeFunction.RevocationStatus.PartiallyRevoked)
        );

        // 4. Reinstate
        vm.prank(owner);
        revokeFunc.reinstateContract(contract1);

        // 5. Verify
        assertFalse(revokeFunc.isContractRevoked(contract1));
    }

    function test_MultipleUsersAndContracts() public {
        // Grant permissions to multiple users
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());
        
        vm.prank(owner);
        revokeFunc.grantPermission(user2, revokeFunc.EXECUTE_PERMISSION());

        // Revoke multiple contracts
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Issue 1");
        
        vm.prank(owner);
        revokeFunc.revokeContract(contract2, "Issue 2");

        // Verify
        assertEq(revokeFunc.getPermissionHolderCount(revokeFunc.EXECUTE_PERMISSION()), 2);
        assertEq(revokeFunc.getRevokedContractCount(), 2);
    }

    // -------------------------------------------------------------------------
    // Edge Case Tests
    // -------------------------------------------------------------------------

    function test_RevokeAndRegrantPermission() public {
        // Grant
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        // Revoke
        vm.prank(owner);
        revokeFunc.revokePermission(user1, revokeFunc.EXECUTE_PERMISSION(), "Test");

        // Regrant
        vm.prank(owner);
        revokeFunc.grantPermission(user1, revokeFunc.EXECUTE_PERMISSION());

        assertTrue(revokeFunc.hasPermission(user1, revokeFunc.EXECUTE_PERMISSION()));
        assertEq(revokeFunc.getPartialRevokeCount(user1), 1); // History preserved
    }

    function test_RevokeContractAndReinstate() public {
        // Revoke
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Test");

        // Reinstate
        vm.prank(owner);
        revokeFunc.reinstateContract(contract1);

        // Revoke again
        vm.prank(owner);
        revokeFunc.revokeContract(contract1, "Test again");

        assertTrue(revokeFunc.isContractRevoked(contract1));
    }

    function test_EmptyPermissionArrayQueries() public {
        bytes32[] memory permissions = revokeFunc.getAccountPermissions(user1);
        assertEq(permissions.length, 0);

        address[] memory holders = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());
        assertEq(holders.length, 0);
    }
}
