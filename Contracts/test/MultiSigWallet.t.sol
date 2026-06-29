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

        wallet = new MultiSigWallet(signers, 2);
    }

    function test_Constructor() public view {
        assertEq(wallet.getSignerCount(), 3);
        assertTrue(wallet.checkSigner(signer1));
        assertTrue(wallet.checkSigner(signer2));
        assertTrue(wallet.checkSigner(signer3));
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

    function test_ExecuteTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.approveTransaction(txId);

        vm.prank(signer2);
        wallet.approveTransaction(txId);

        vm.prank(signer1);
        vm.expectRevert();
        wallet.executeTransaction(txId);
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

    function test_RejectTransaction() public {
        vm.prank(signer1);
        uint256 txId = wallet.createTransaction(target, 0, abi.encodeWithSignature("test()"));

        vm.prank(signer1);
        wallet.rejectTransaction(txId);

        MultiSigWallet.Transaction memory tx = wallet.getTransaction(txId);
        assertEq(uint256(tx.status), uint256(MultiSigWallet.TransactionStatus.REJECTED));
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

    function test_GetSigners() public view {
        address[] memory signers = wallet.getSigners();
        assertEq(signers.length, 3);
    }

    function test_InvalidThreshold() public {
        address[] memory signers = new address[](2);
        signers[0] = address(0x10);
        signers[1] = address(0x11);

        vm.expectRevert(MultiSigWallet.InvalidThreshold.selector);
        new MultiSigWallet(signers, 3);
    }

    function test_DuplicateSigner() public {
        address[] memory signers = new address[](2);
        signers[0] = address(0x10);
        signers[1] = address(0x10);

        vm.expectRevert(MultiSigWallet.DuplicateSigner.selector);
        new MultiSigWallet(signers, 1);
    }

    function test_ReceiveEther() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(wallet).call{value: 1 ether}("");
        assertTrue(success);
    }
}
