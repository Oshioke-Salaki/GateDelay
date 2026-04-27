// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Timelock.sol";

contract TimelockTest is Test {
    Timelock timelock;
    address target = address(0x123);

    function setUp() public {
        timelock = new Timelock(1 days);
    }

    function test_QueueOperation() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        assertNotEq(operationId, bytes32(0));
    }

    function test_QueueOperation_InvalidDelay() public {
        bytes memory data = abi.encodeWithSignature("test()");

        vm.expectRevert(Timelock.InvalidDelay.selector);
        timelock.queueOperation(target, 0, data, 12 hours);
    }

    function test_QueueOperation_ZeroTarget() public {
        bytes memory data = abi.encodeWithSignature("test()");

        vm.expectRevert(Timelock.InvalidOperation.selector);
        timelock.queueOperation(address(0), 0, data, 1 days);
    }

    function test_QueueOperation_AlreadyQueued() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        vm.expectRevert(Timelock.OperationAlreadyQueued.selector);
        timelock.queueOperation(target, 0, data, 1 days);
    }

    function test_ExecuteOperation_DelayNotPassed() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        vm.expectRevert(Timelock.DelayNotPassed.selector);
        timelock.executeOperation(operationId);
    }

    function test_IsOperationReady() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        assertFalse(timelock.isOperationReady(operationId));

        vm.warp(block.timestamp + 1 days + 1);
        assertTrue(timelock.isOperationReady(operationId));
    }

    function test_GetOperationReadyTime() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        uint256 readyTime = timelock.getOperationReadyTime(operationId);
        assertEq(readyTime, block.timestamp + 1 days);
    }

    function test_GetOperation() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        Timelock.Operation memory operation = timelock.getOperation(operationId);
        assertEq(operation.target, target);
        assertEq(operation.value, 0);
        assertEq(operation.delay, 1 days);
        assertEq(uint256(operation.status), uint256(Timelock.OperationStatus.QUEUED));
    }

    function test_UpdateMinDelay() public {
        timelock.updateMinDelay(2 days);
        // Can't directly check minDelay, but we can verify it works by trying to queue with new delay
        bytes memory data = abi.encodeWithSignature("test()");

        vm.expectRevert(Timelock.InvalidDelay.selector);
        timelock.queueOperation(target, 0, data, 1 days);
    }

    function test_CancelOperation() public {
        bytes memory data = abi.encodeWithSignature("test()");
        bytes32 operationId = timelock.queueOperation(target, 0, data, 1 days);

        timelock.cancelOperation(operationId);

        Timelock.Operation memory operation = timelock.getOperation(operationId);
        assertEq(uint256(operation.status), uint256(Timelock.OperationStatus.CANCELLED));
    }

    function test_OperationNotFound() public {
        bytes32 operationId = keccak256(abi.encodePacked("nonexistent"));

        vm.expectRevert(Timelock.OperationNotFound.selector);
        timelock.getOperation(operationId);
    }
}
