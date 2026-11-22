// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/src/RevokeFunction.sol";

contract RevokeFunctionTest is Test {
    RevokeFunction revokeFunc;

    address owner = address(0x1);
    address alice = address(0x2);
    address bob = address(0x3);
    address notOwner = address(0x99);

    bytes32 constant EXECUTE = keccak256("EXECUTE_PERMISSION");
    bytes32 constant TRANSFER = keccak256("TRANSFER_PERMISSION");
    bytes32 constant MINT = keccak256("MINT_PERMISSION");
    bytes32 constant BURN = keccak256("BURN_PERMISSION");
    bytes32 constant ADMIN = keccak256("ADMIN_PERMISSION");

    function setUp() public {
        vm.prank(owner);
        revokeFunc = new RevokeFunction();
    }

    // -----------------------------------------------------------------------
    // grantPermission
    // -----------------------------------------------------------------------

    function test_GrantPermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        assertTrue(revokeFunc.hasPermission(alice, EXECUTE));
        assertEq(revokeFunc.getAccountPermissionCount(alice), 1);
    }

    function test_GrantPermissionRevertsForNonOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", notOwner));
        revokeFunc.grantPermission(alice, EXECUTE);
    }

    function test_GrantPermissionRevertsForZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        revokeFunc.grantPermission(address(0), EXECUTE);
    }

    function test_GrantPermissionRevertsForZeroPermission() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidPermission()"));
        revokeFunc.grantPermission(alice, bytes32(0));
    }

    function test_GrantPermissionRevertsForDuplicate() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("PermissionAlreadyGranted()"));
        revokeFunc.grantPermission(alice, EXECUTE);
    }

    function test_GrantPermissionEmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit RevokeFunction.PermissionGranted(alice, EXECUTE, owner);
        revokeFunc.grantPermission(alice, EXECUTE);
    }

    // -----------------------------------------------------------------------
    // grantPermissions (batch)
    // -----------------------------------------------------------------------

    function test_GrantPermissionsBatch() public {
        bytes32[] memory perms = new bytes32[](2);
        perms[0] = EXECUTE;
        perms[1] = TRANSFER;

        vm.prank(owner);
        revokeFunc.grantPermissions(alice, perms);

        assertTrue(revokeFunc.hasPermission(alice, EXECUTE));
        assertTrue(revokeFunc.hasPermission(alice, TRANSFER));
        assertEq(revokeFunc.getAccountPermissionCount(alice), 2);
    }

    function test_GrantPermissionsSkipsAlreadyGranted() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        bytes32[] memory perms = new bytes32[](2);
        perms[0] = EXECUTE;
        perms[1] = TRANSFER;

        vm.prank(owner);
        revokeFunc.grantPermissions(alice, perms);

        assertEq(revokeFunc.getAccountPermissionCount(alice), 2);
    }

    // -----------------------------------------------------------------------
    // revokePermission
    // -----------------------------------------------------------------------

    function test_RevokePermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        vm.prank(owner);
        revokeFunc.revokePermission(alice, EXECUTE, "test revoke");

        assertFalse(revokeFunc.hasPermission(alice, EXECUTE));
        assertEq(revokeFunc.getAccountPermissionCount(alice), 0);
    }

    function test_RevokePermissionRevertsWhenNotGranted() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("PermissionNotGranted()"));
        revokeFunc.revokePermission(alice, EXECUTE, "not granted");
    }

    function test_RevokePermissionRecordsPartialRevoke() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        vm.prank(owner);
        revokeFunc.revokePermission(alice, EXECUTE, "audit trail");

        assertEq(revokeFunc.getPartialRevokeCount(alice), 1);
        RevokeFunction.PartialRevoke memory pr = revokeFunc.getPartialRevokeByIndex(alice, 0);
        assertEq(pr.permission, EXECUTE);
        assertEq(pr.reason, "audit trail");
        assertEq(pr.revokedBy, owner);
    }

    function test_RevokePermissionEmitsEvents() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit RevokeFunction.PermissionRevoked(alice, EXECUTE, owner, "reason");
        vm.expectEmit(true, true, true, true);
        emit RevokeFunction.PartialRevokeRecorded(alice, EXECUTE, owner, "reason");
        revokeFunc.revokePermission(alice, EXECUTE, "reason");
    }

    // -----------------------------------------------------------------------
    // revokePermissions (batch)
    // -----------------------------------------------------------------------

    function test_RevokePermissionsBatch() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(alice, TRANSFER);

        bytes32[] memory perms = new bytes32[](2);
        perms[0] = EXECUTE;
        perms[1] = TRANSFER;

        vm.prank(owner);
        revokeFunc.revokePermissions(alice, perms, "batch revoke");

        assertFalse(revokeFunc.hasPermission(alice, EXECUTE));
        assertFalse(revokeFunc.hasPermission(alice, TRANSFER));
        assertEq(revokeFunc.getPartialRevokeCount(alice), 2);
    }

    function test_RevokePermissionsRevertsOnEmptyArray() public {
        bytes32[] memory perms = new bytes32[](0);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("CannotRevokeZeroPermissions()"));
        revokeFunc.revokePermissions(alice, perms, "empty");
    }

    // -----------------------------------------------------------------------
    // revokeAllPermissions
    // -----------------------------------------------------------------------

    function test_RevokeAllPermissions() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(alice, TRANSFER);

        vm.prank(owner);
        revokeFunc.revokeAllPermissions(alice, "suspend");

        assertFalse(revokeFunc.hasPermission(alice, EXECUTE));
        assertFalse(revokeFunc.hasPermission(alice, TRANSFER));
        assertEq(revokeFunc.getAccountPermissionCount(alice), 0);
        assertEq(revokeFunc.getPartialRevokeCount(alice), 2);
    }

    function test_RevokeAllPermissionsRevertsWhenNoneGranted() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("NoPermissionsToRevoke()"));
        revokeFunc.revokeAllPermissions(alice, "nothing to revoke");
    }

    // -----------------------------------------------------------------------
    // revokeContract / reinstateContract
    // -----------------------------------------------------------------------

    function test_RevokeContract() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xdead), "vulnerability");

        assertTrue(revokeFunc.isContractRevoked(address(0xdead)));
        assertEq(revokeFunc.getRevokedContractCount(), 1);
    }

    function test_RevokeContractRevertsForZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        revokeFunc.revokeContract(address(0), "reason");
    }

    function test_RevokeContractRevertsForAlreadyRevoked() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xdead), "first");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ContractAlreadyRevoked()"));
        revokeFunc.revokeContract(address(0xdead), "second");
    }

    function test_ReinstateContract() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xdead), "vulnerability");

        vm.prank(owner);
        revokeFunc.reinstateContract(address(0xdead));

        assertFalse(revokeFunc.isContractRevoked(address(0xdead)));
        assertEq(revokeFunc.getRevokedContractCount(), 0);
    }

    function test_ReinstateContractRevertsWhenNotRevoked() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ContractNotRevoked()"));
        revokeFunc.reinstateContract(address(0xdead));
    }

    function test_UpdateRevocationStatus() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xdead), "reason");

        vm.prank(owner);
        revokeFunc.updateRevocationStatus(address(0xdead), RevokeFunction.RevocationStatus.PartiallyRevoked);

        assertEq(
            uint8(revokeFunc.getRevocationStatus(address(0xdead))),
            uint8(RevokeFunction.RevocationStatus.PartiallyRevoked)
        );
    }

    // -----------------------------------------------------------------------
    // Query functions
    // -----------------------------------------------------------------------

    function test_GetAccountPermissions() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(alice, TRANSFER);

        bytes32[] memory perms = revokeFunc.getAccountPermissions(alice);
        assertEq(perms.length, 2);
    }

    function test_GetPermissionHolders() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(bob, EXECUTE);

        address[] memory holders = revokeFunc.getPermissionHolders(EXECUTE);
        assertEq(holders.length, 2);
    }

    function test_GetPermissionHolderCount() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        assertEq(revokeFunc.getPermissionHolderCount(EXECUTE), 1);
    }

    function test_GetAllAccountsWithPermissions() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(bob, TRANSFER);

        address[] memory accounts = revokeFunc.getAllAccountsWithPermissions();
        assertEq(accounts.length, 2);
    }

    function test_GetContractRevocation() public {
        vm.prank(owner);
        vm.warp(100);
        revokeFunc.revokeContract(address(0xdead), "security");

        RevokeFunction.ContractRevocation memory rev = revokeFunc.getContractRevocation(address(0xdead));
        assertTrue(rev.isRevoked);
        assertEq(rev.revokedAt, 100);
        assertEq(rev.revokedBy, owner);
        assertEq(rev.reason, "security");
    }

    function test_GetAllRevokedContracts() public {
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xdead), "r1");
        vm.prank(owner);
        revokeFunc.revokeContract(address(0xbeef), "r2");

        address[] memory revoked = revokeFunc.getAllRevokedContracts();
        assertEq(revoked.length, 2);
    }

    function test_GetRecentPartialRevokes() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);
        vm.prank(owner);
        revokeFunc.grantPermission(alice, TRANSFER);
        vm.prank(owner);
        revokeFunc.grantPermission(alice, MINT);

        vm.prank(owner);
        revokeFunc.revokePermission(alice, EXECUTE, "r1");
        vm.prank(owner);
        revokeFunc.revokePermission(alice, TRANSFER, "r2");
        vm.prank(owner);
        revokeFunc.revokePermission(alice, MINT, "r3");

        RevokeFunction.PartialRevoke[] memory recent = revokeFunc.getRecentPartialRevokes(alice, 2);
        assertEq(recent.length, 2);
        assertEq(recent[0].permission, TRANSFER);
        assertEq(recent[1].permission, MINT);
    }

    function test_GetPartialRevokeByIndexRevertsForOutOfBounds() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("PartialRevokeNotFound()"));
        revokeFunc.getPartialRevokeByIndex(alice, 0);
    }

    // -----------------------------------------------------------------------
    // Utility functions
    // -----------------------------------------------------------------------

    function test_HasAnyPermission() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        bytes32[] memory perms = new bytes32[](2);
        perms[0] = EXECUTE;
        perms[1] = TRANSFER;

        assertTrue(revokeFunc.hasAnyPermission(alice, perms));

        bytes32[] memory none = new bytes32[](1);
        none[0] = MINT;
        assertFalse(revokeFunc.hasAnyPermission(alice, none));
    }

    function test_HasAllPermissions() public {
        vm.prank(owner);
        revokeFunc.grantPermission(alice, EXECUTE);

        bytes32[] memory perms = new bytes32[](2);
        perms[0] = EXECUTE;
        perms[1] = TRANSFER;

        assertFalse(revokeFunc.hasAllPermissions(alice, perms));

        vm.prank(owner);
        revokeFunc.grantPermission(alice, TRANSFER);
        assertTrue(revokeFunc.hasAllPermissions(alice, perms));
    }

    // -----------------------------------------------------------------------
    // Permission descriptions
    // -----------------------------------------------------------------------

    function test_SetAndGetPermissionDescription() public {
        vm.prank(owner);
        revokeFunc.setPermissionDescription(EXECUTE, "Custom desc");

        assertEq(revokeFunc.getPermissionDescription(EXECUTE), "Custom desc");
    }

    function test_DefaultDescriptionsAreSet() public {
        assertTrue(bytes(revokeFunc.getPermissionDescription(EXECUTE)).length > 0);
        assertTrue(bytes(revokeFunc.getPermissionDescription(TRANSFER)).length > 0);
    }
}
