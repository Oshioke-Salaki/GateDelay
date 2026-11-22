// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RulingTimelock.sol";

contract DummyTarget {
    uint256 public last;

    function doSet(uint256 v) external returns (uint256) {
        last = v;
        return last;
    }

    function willRevert() external pure {
        revert("target fail");
    }
}

contract RulingTimelockTest is Test {
    RulingTimelock timelock;
    DummyTarget target;

    function setUp() public {
        timelock = new RulingTimelock();
        target = new DummyTarget();
    }

    function testScheduleAndExecute() public {
        bytes32 id = keccak256(abi.encodePacked("r1"));
        bytes memory data = abi.encodeWithSelector(
            DummyTarget.doSet.selector,
            42
        );
        uint256 delay = 1 days;

        timelock.scheduleRuling(id, address(target), data, delay);

        // cannot execute early
        vm.expectRevert(bytes("Not ready"));
        timelock.executeRuling(id);

        // advance time and execute
        vm.warp(block.timestamp + delay + 1);
        timelock.executeRuling(id);

        (, , uint256 unlockTime, , , bool executed, , , ) = timelock.getRuling(
            id
        );
        assertTrue(executed);
        assertGt(unlockTime, 0);
        assertEq(target.last(), 42);
    }

    function testCancelPreventsExecution() public {
        bytes32 id = keccak256(abi.encodePacked("r2"));
        bytes memory data = abi.encodeWithSelector(
            DummyTarget.doSet.selector,
            7
        );
        uint256 delay = 100;
        timelock.scheduleRuling(id, address(target), data, delay);

        timelock.cancelRuling(id);

        vm.warp(block.timestamp + delay + 1);
        vm.expectRevert(bytes("Canceled"));
        timelock.executeRuling(id);
    }

    function testExecutionFailureRecorded() public {
        bytes32 id = keccak256(abi.encodePacked("r3"));
        bytes memory data = abi.encodeWithSelector(
            DummyTarget.willRevert.selector
        );
        uint256 delay = 1;
        timelock.scheduleRuling(id, address(target), data, delay);

        vm.warp(block.timestamp + delay + 1);
        timelock.executeRuling(id);

        (
            ,
            ,
            ,
            ,
            ,
            bool executed,
            ,
            bool failed,
            bytes memory failureData
        ) = timelock.getRuling(id);
        assertFalse(executed);
        assertTrue(failed);
        assertTrue(failureData.length > 0);
    }

    // -------------------------------------------------------------------------
    // #966 – Ruling timelock lifecycle tests
    // -------------------------------------------------------------------------

    function test_timelockLifecycle_nonOwnerCannotSchedule() public {
        bytes32 id = keccak256(abi.encodePacked("r4"));
        bytes memory data = abi.encodeWithSelector(DummyTarget.doSet.selector, 1);

        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes("Not owner"));
        timelock.scheduleRuling(id, address(target), data, 1 days);
    }

    function test_timelockLifecycle_duplicateIdIsRejected() public {
        bytes32 id = keccak256(abi.encodePacked("r5"));
        bytes memory data = abi.encodeWithSelector(DummyTarget.doSet.selector, 99);

        timelock.scheduleRuling(id, address(target), data, 1 hours);

        vm.expectRevert(bytes("Already scheduled"));
        timelock.scheduleRuling(id, address(target), data, 1 hours);
    }

    function test_timelockLifecycle_isReadyReflectsTimelockState() public {
        bytes32 id = keccak256(abi.encodePacked("r6"));
        bytes memory data = abi.encodeWithSelector(DummyTarget.doSet.selector, 7);
        uint256 delay = 2 hours;

        assertFalse(timelock.isReady(id));

        timelock.scheduleRuling(id, address(target), data, delay);

        // Not ready before unlock time
        assertFalse(timelock.isReady(id));

        // Ready once unlock time is reached
        vm.warp(block.timestamp + delay);
        assertTrue(timelock.isReady(id));

        // Not ready after execution
        timelock.executeRuling(id);
        assertFalse(timelock.isReady(id));
    }
}
