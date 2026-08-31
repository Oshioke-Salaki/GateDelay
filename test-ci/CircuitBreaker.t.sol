// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/src/CircuitBreaker.sol";

contract CircuitBreakerTest is Test {
    CircuitBreaker circuitBreaker;

    address admin = address(0x1);
    address breaker = address(0x2);
    address monitor = address(0x3);

    function setUp() public {
        vm.prank(admin);
        circuitBreaker = new CircuitBreaker();

        vm.prank(admin);
        circuitBreaker.grantBreakerRole(breaker);

        vm.prank(admin);
        circuitBreaker.grantMonitorRole(monitor);
    }

    function test_RecordSuccessIncrementsCounter() public {
        vm.prank(monitor);
        circuitBreaker.recordSuccess();
        assertEq(circuitBreaker.successCount(), 1);
    }

    function test_TriggerBreakOpensCircuit() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(monitor);
            circuitBreaker.recordFailure("test failure");
        }

        assertEq(uint256(circuitBreaker.currentState()), uint256(CircuitBreaker.State.Open));
    }
}
