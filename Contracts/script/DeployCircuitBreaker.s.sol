// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CircuitBreaker.sol";

contract DeployCircuitBreaker is Script {
    function run() external returns (CircuitBreaker circuitBreaker) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        circuitBreaker = new CircuitBreaker();
        vm.stopBroadcast();

        address deployer = vm.addr(deployerPrivateKey);
        console.log("CircuitBreaker deployed at:", address(circuitBreaker));
        console.log("Admin, breaker, and monitor:", deployer);
    }
}