// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/KYCStorage.sol";

contract KYCStorageTest is Test {
    KYCStorage kyc;

    address owner = address(0xA11CE);
    address verifier = address(0xBEEF);
    address verifier2 = address(0xCAFE);
    address user = address(0xD00D);
    address user2 = address(0xFADE);

    function setUp() public {
        kyc = new KYCStorage(owner);
        vm.prank(owner);
        kyc.addVerifier(verifier);
    }

    // ------- verifier management -------

    function test_OwnerCanAddAndRemoveVerifier() public {
        vm.prank(owner);
        kyc.addVerifier(verifier2);
        assertTrue(kyc.isVerifier(verifier2));

        vm.prank(owner);
        kyc.removeVerifier(verifier2);
        assertFalse(kyc.isVerifier(verifier2));
    }

    function test_NonOwnerCannotAddVerifier() public {
        vm.prank(user);
        vm.expectRevert();
        kyc.addVerifier(verifier2);
    }

    function test_CannotAddZeroVerifier() public {
        vm.prank(owner);
        vm.expectRevert(KYCStorage.ZeroAddress.selector);
        kyc.addVerifier(address(0));
    }

    function test_CannotAddVerifierTwice() public {
        vm.prank(owner);
        vm.expectRevert(KYCStorage.AlreadyVerifier.selector);
        kyc.addVerifier(verifier);
    }

    function test_CannotRemoveUnknownVerifier() public {
        vm.prank(owner);
        vm.expectRevert(KYCStorage.NotVerifier.selector);
        kyc.removeVerifier(verifier2);
    }

    function test_GetVerifiersReturnsRegisteredAccounts() public {
        vm.prank(owner);
        kyc.addVerifier(verifier2);
        address[] memory list = kyc.getVerifiers();
        assertEq(list.length, 2);
    }

    // ------- submission and verification -------

    function test_UserSubmitMarksPending() public {
        vm.prank(user);
        kyc.submit(keccak256("docs"), "US");

        KYCStorage.Record memory rec = kyc.getRecord(user);
        assertEq(uint8(rec.status), uint8(KYCStorage.Status.PENDING));
        assertEq(rec.documentHash, keccak256("docs"));
        assertEq(rec.jurisdiction, "US");
        assertGt(uint256(rec.updatedAt), 0);
    }

    function test_VerifierCanSetVerified() public {
        vm.prank(user);
        kyc.submit(keccak256("docs"), "US");

        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 2, uint64(block.timestamp + 365 days));

        KYCStorage.Record memory rec = kyc.getRecord(user);
        assertEq(uint8(rec.status), uint8(KYCStorage.Status.VERIFIED));
        assertEq(rec.level, 2);
        assertEq(rec.verifier, verifier);
        assertGt(uint256(rec.verifiedAt), 0);
    }

    function test_NonVerifierCannotSetVerification() public {
        vm.prank(user2);
        vm.expectRevert(KYCStorage.NotVerifier.selector);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);
    }

    function test_CannotSetStatusNone() public {
        vm.prank(verifier);
        vm.expectRevert(KYCStorage.InvalidStatus.selector);
        kyc.setVerification(user, KYCStorage.Status.NONE, 1, 0);
    }

    function test_CannotSetInvalidLevel() public {
        vm.prank(verifier);
        vm.expectRevert(KYCStorage.InvalidLevel.selector);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 4, 0);
    }

    function test_CannotSetForZeroAddress() public {
        vm.prank(verifier);
        vm.expectRevert(KYCStorage.ZeroAddress.selector);
        kyc.setVerification(address(0), KYCStorage.Status.VERIFIED, 1, 0);
    }

    function test_RevokeChangesStatus() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);

        vm.prank(verifier);
        kyc.revoke(user, "fraud");

        KYCStorage.Record memory rec = kyc.getRecord(user);
        assertEq(uint8(rec.status), uint8(KYCStorage.Status.REVOKED));
    }

    function test_CannotRevokeUnknownRecord() public {
        vm.prank(verifier);
        vm.expectRevert(KYCStorage.UnknownRecord.selector);
        kyc.revoke(user, "missing");
    }

    // ------- query semantics -------

    function test_StatusOfReportsExpiredAfterTimestamp() public {
        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, expiry);

        assertEq(uint8(kyc.statusOf(user)), uint8(KYCStorage.Status.VERIFIED));

        vm.warp(uint256(expiry));
        assertEq(uint8(kyc.statusOf(user)), uint8(KYCStorage.Status.EXPIRED));
    }

    function test_StatusOfWithoutExpiryStaysVerified() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);
        vm.warp(block.timestamp + 365 days);
        assertEq(uint8(kyc.statusOf(user)), uint8(KYCStorage.Status.VERIFIED));
    }

    function test_IsVerifiedRequiresMinLevel() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);

        assertTrue(kyc.isVerified(user, 1));
        assertFalse(kyc.isVerified(user, 2));
    }

    function test_IsVerifiedFalseAfterExpiry() public {
        uint64 expiry = uint64(block.timestamp + 10);
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 2, expiry);

        vm.warp(uint256(expiry) + 1);
        assertFalse(kyc.isVerified(user, 1));
    }

    function test_IsVerifiedFalseWhenRejected() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.REJECTED, 0, 0);
        assertFalse(kyc.isVerified(user, 0));
    }

    function test_ExpiryOf() public {
        uint64 expiry = uint64(block.timestamp + 5 days);
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, expiry);
        assertEq(kyc.expiryOf(user), expiry);
    }

    function test_UserListAndPagination() public {
        vm.prank(user);
        kyc.submit(keccak256("a"), "US");
        vm.prank(user2);
        kyc.submit(keccak256("b"), "GB");

        assertEq(kyc.userCount(), 2);
        address[] memory page = kyc.listUsers(0, 10);
        assertEq(page.length, 2);

        address[] memory empty = kyc.listUsers(5, 10);
        assertEq(empty.length, 0);

        address[] memory firstOnly = kyc.listUsers(0, 1);
        assertEq(firstOnly.length, 1);
        assertEq(firstOnly[0], user);
    }

    function test_VerifierWriteRegistersUserOnce() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 2, 0);
        assertEq(kyc.userCount(), 1);
    }

    function test_UpdateOverwritesPriorRecord() public {
        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 1, 0);

        vm.prank(verifier);
        kyc.setVerification(user, KYCStorage.Status.VERIFIED, 3, uint64(block.timestamp + 1000));

        KYCStorage.Record memory rec = kyc.getRecord(user);
        assertEq(rec.level, 3);
        assertEq(rec.expiresAt, uint64(block.timestamp + 1000));
    }
}
