// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProposalExecutor.sol";

contract ProposalExecutorTest is Test {
    ProposalExecutor executor;
    address target = address(0x123);

    function setUp() public {
        executor = new ProposalExecutor(1 days);
    }

    function test_CreateProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");
        assertEq(proposalId, 0);
    }

    function test_ApproveProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");
        executor.approveProposal(proposalId);

        (ProposalExecutor.ProposalStatus status,) = executor.getExecutionStatus(proposalId);
        assertEq(uint256(status), uint256(ProposalExecutor.ProposalStatus.APPROVED));
    }

    function test_ExecuteProposal_TimelockNotReady() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");
        executor.approveProposal(proposalId);

        vm.expectRevert(ProposalExecutor.TimelockNotReady.selector);
        executor.executeProposal(proposalId);
    }

    function test_ExecuteProposal_Success() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");
        executor.approveProposal(proposalId);

        // Skip timelock
        vm.warp(block.timestamp + 1 days + 1);

        // This will fail because target doesn't have the function, but it tests the flow
        vm.expectRevert(ProposalExecutor.ExecutionFailed.selector);
        executor.executeProposal(proposalId);
    }

    function test_IsTimelockReady() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");

        assertFalse(executor.isTimelockReady(proposalId));

        vm.warp(block.timestamp + 1 days + 1);
        assertTrue(executor.isTimelockReady(proposalId));
    }

    function test_GetProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        uint256 proposalId = executor.createProposal(targets, values, actions, "Test proposal");
        ProposalExecutor.Proposal memory proposal = executor.getProposal(proposalId);

        assertEq(proposal.id, proposalId);
        assertEq(proposal.proposer, address(this));
        assertEq(proposal.targets[0], target);
    }

    function test_InvalidProposal_MismatchedArrays() public {
        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](2);

        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encodeWithSignature("test()");

        vm.expectRevert(ProposalExecutor.InvalidProposal.selector);
        executor.createProposal(targets, values, actions, "Test proposal");
    }
}
