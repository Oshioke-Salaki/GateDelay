// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Test} from "forge-std/Test.sol";
import {MultiSigWallet} from "../src/MultiSigWallet.sol";
contract ProposalExpiryTest is Test {
    MultiSigWallet wallet;
    function setUp() public {
        address[] memory owners = new address[](1);
        owners[0] = address(this);
        wallet = new MultiSigWallet(owners, 1, 1);
    }
    function testPendingBoundary() public {
        uint256 id = wallet.createTransaction(address(123), 0, "");
        uint256 deadline = wallet.getTransaction(id).deadline;
        vm.warp(deadline - 1);
        assertFalse(wallet.isExpired(id));
        vm.warp(deadline);
        assertEq(uint256(wallet.getTransaction(id).status), uint256(MultiSigWallet.TransactionStatus.EXPIRED));
        vm.expectRevert(MultiSigWallet.TransactionExpired.selector);
        wallet.approveTransaction(id);
        vm.warp(deadline + 1);
        vm.expectRevert(MultiSigWallet.TransactionExpired.selector);
        wallet.executeTransaction(id);
    }
    function testApprovedBoundaryAndExecutedOutcome() public {
        uint256 id = wallet.createTransaction(address(123), 0, "");
        wallet.approveTransaction(id);
        uint256 deadline = wallet.getTransaction(id).deadline;
        vm.warp(deadline);
        assertFalse(wallet.hasApproved(id, address(this)));
        vm.expectRevert(MultiSigWallet.TransactionExpired.selector);
        wallet.executeTransaction(id);
        uint256 next = wallet.createTransaction(address(123), 0, "");
        wallet.approveTransaction(next);
        vm.warp(wallet.getTransaction(next).deadline - 1);
        wallet.executeTransaction(next);
        vm.warp(block.timestamp + 2);
        assertFalse(wallet.isExpired(next));
        assertEq(uint256(wallet.getTransaction(next).status), uint256(MultiSigWallet.TransactionStatus.EXECUTED));
    }
}
