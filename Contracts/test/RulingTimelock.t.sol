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
}
