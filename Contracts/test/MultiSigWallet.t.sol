// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet wallet;
    address signer1 = address(0x1);
    address signer2 = address(0x2);
    address signer3 = address(0x3);
    address target = address(0x123);

    function setUp() public {
        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;

        wallet = new MultiSigWallet(signers, 2, 2); // threshold=2, rejectionThreshold=2
    }

    function test_Constructor() public view {
        assertEq(wallet.getSignerCount(), 3);
        assertTrue(wallet.checkSigner(signer1));
        assertTrue(wallet.checkSigner(signer2));
        assertTrue(wallet.checkSigner(signer3));
        assertEq(wallet.threshold(), 2);
        assertEq(wallet.getRejectionThreshold(), 2);
    }

    function test_CreateTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));
        assertEq(txId, 0);
    }

    function test_CreateTransaction_NotSigner() public {
        vm.prank(address(0x999));
        vm.expectRevert(MultiSigWallet.NotSigner.selector);
        wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));
    }

    function test_ApproveTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        assertTrue(wallet.hasApproved(txId, signer1));
    }

    function test_ApproveTransaction_ReachesThreshold() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        MultiSigWallet.Transaction memory tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));
    }

    function test_RevokeApproval_ReturnsReadyToPendingThenReapproveAndExecute() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(txn.approvalCount, 2);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));

        vm.expectEmit(true, true, false, true);
        emit MultiSigWallet.TransactionApprovalRevoked(txId, signer2);
        vm.prank(signer2);
        wallet.revokeApproval(txId);

        txn = wallet.getTransaction(txId);
        assertEq(txn.approvalCount, 1);
        assertFalse(wallet.hasApproved(txId, signer2));
        assertTrue(wallet.hasApproved(txId, signer1));
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.PENDING));

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        txn = wallet.getTransaction(txId);
        assertEq(txn.approvalCount, 2);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));

        vm.prank(signer1);
        wallet.executeTransaction(txId);

        txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
    }

    function test_RevokeApproval_ExecutedImmutable() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);
        vm.prank(signer2);
        wallet.approveTransaction(txId);
        vm.prank(signer1);
        wallet.executeTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.TransactionAlreadyExecuted.selector);
        wallet.revokeApproval(txId);
    }

    function test_RevokeApproval_RejectedImmutable() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.rejectTransaction(txId);
        vm.prank(signer3);
        wallet.rejectTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InvalidTransaction.selector);
        wallet.revokeApproval(txId);
    }

    function test_RevokeApproval_WithoutPriorApproval() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InvalidTransaction.selector);
        wallet.revokeApproval(txId);
    }

    function test_ExecuteTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer1);
        // Calling an EOA (non-contract) with value=0 succeeds in EVM (returns success=true)
        // The transaction executes successfully but no actual function is called
        wallet.executeTransaction(txId);

        MultiSigWallet.Transaction memory tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
    }

    function test_ExecuteTransaction_InsufficientApprovals() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);
    }

    function test_RejectTransaction_RequiresThreshold() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        // First rejection - should not reject yet (threshold=2)
        vm.prank(signer1);
        wallet.rejectTransaction(txId);

        MultiSigWallet.Transaction memory tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.PENDING));
        assertEq(wallet.getRejectionCount(txId), 1);

        // Second rejection - should reject now
        vm.prank(signer2);
        wallet.rejectTransaction(txId);

        tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.REJECTED));
        assertEq(wallet.getRejectionCount(txId), 2);
    }

    function test_RejectTransaction_DuplicateRejection() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.rejectTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InvalidTransaction.selector);
        wallet.rejectTransaction(txId);
    }

    function test_RejectTransaction_NotPending() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);
        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.TransactionNotPending.selector);
        wallet.rejectTransaction(txId);
    }

    function test_AddSigner() public {
        address newSigner = address(0x4);

        vm.prank(signer1);
        wallet.addSigner(newSigner);

        assertTrue(wallet.checkSigner(newSigner));
        assertEq(wallet.getSignerCount(), 4);
    }

    function test_RemoveSigner() public {
        vm.prank(signer1);
        wallet.removeSigner(signer3);

        assertFalse(wallet.checkSigner(signer3));
        assertEq(wallet.getSignerCount(), 2);
    }

    function test_UpdateThreshold() public {
        vm.prank(signer1);
        wallet.updateThreshold(3);

        // Verify by trying to execute with 2 approvals (should fail)
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        MultiSigWallet.Transaction memory tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.PENDING));
    }

    /// @notice SC-013: raising the threshold must invalidate prior APPROVED readiness until
    ///     enough approvals exist under the new policy.
    function test_ThresholdIncrease_ExistingProposalRequiresNewApprovals() public {
        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;
        wallet = new MultiSigWallet(signers, 1, 2);

        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));

        vm.prank(signer1);
        wallet.updateThreshold(2);

        txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.PENDING));

        vm.prank(signer1);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));

        vm.prank(signer1);
        wallet.executeTransaction(txId);

        txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
    }

    function test_UpdateRejectionThreshold() public {
        vm.prank(signer1);
        wallet.updateRejectionThreshold(3);

        assertEq(wallet.getRejectionThreshold(), 3);
    }

    function test_GetSigners() public view {
        address[] memory signers = wallet.getSigners();
        assertEq(signers.length, 3);
    }

    function test_InvalidThreshold() public {
        address[] memory signers = new address[](2);
        signers[0] = address(0x10);
        signers[1] = address(0x11);

        vm.expectRevert(MultiSigWallet.InvalidThreshold.selector);
        new MultiSigWallet(signers, 3, 1);
    }

    function test_InvalidRejectionThreshold() public {
        address[] memory signers = new address[](2);
        signers[0] = address(0x10);
        signers[1] = address(0x11);

        vm.expectRevert(MultiSigWallet.InvalidThreshold.selector);
        new MultiSigWallet(signers, 1, 3);
    }

    function test_DuplicateSigner() public {
        address[] memory signers = new address[](2);
        signers[0] = address(0x10);
        signers[1] = address(0x10);

        vm.expectRevert(MultiSigWallet.DuplicateSigner.selector);
        new MultiSigWallet(signers, 1, 1);
    }

    function test_HasRejected() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        assertFalse(wallet.hasRejected(txId, signer1));
        assertFalse(wallet.hasRejected(txId, signer2));

        vm.prank(signer1);
        wallet.rejectTransaction(txId);

        assertTrue(wallet.hasRejected(txId, signer1));
        assertFalse(wallet.hasRejected(txId, signer2));
    }

    function test_ReceiveEther() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(wallet).call{value: 1 ether}("");
        assertTrue(success);
    }

    function test_RemovedSignerApprovalDoesNotCount() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, "");

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.removeSigner(signer1);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.PENDING));
        assertEq(txn.approvalCount, 1);

        vm.prank(signer2);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);

        vm.prank(signer3);
        wallet.approveTransaction(txId);

        txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.APPROVED));
        assertEq(txn.approvalCount, 2);
    }

    function test_ExecuteRevertsWhenApproverRemovedAfterReady() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, "");

        vm.prank(signer1);
        wallet.approveTransaction(txId);
        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer3);
        wallet.removeSigner(signer1);

        vm.prank(signer2);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);

        vm.prank(signer3);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.executeTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
        assertEq(txn.approvalCount, 2);
    }

    function test_ReaddedSignerMustApproveAgain() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, "");

        vm.prank(signer1);
        wallet.approveTransaction(txId);
        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer3);
        wallet.removeSigner(signer1);

        vm.prank(signer2);
        wallet.addSigner(signer1);

        vm.prank(signer2);
        vm.expectRevert(MultiSigWallet.InsufficientApprovals.selector);
        wallet.executeTransaction(txId);

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.executeTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
    }

    function test_RemovingNonApproverKeepsReadyTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, "");

        vm.prank(signer1);
        wallet.approveTransaction(txId);
        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer1);
        wallet.removeSigner(signer3);

        vm.prank(signer1);
        wallet.executeTransaction(txId);

        MultiSigWallet.Transaction memory txn = wallet.getTransaction(txId);
        assertEq(uint256(txn.status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
        assertEq(txn.approvalCount, 2);
    }
}